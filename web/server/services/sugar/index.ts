/**
 * 糖分量化服务 — 今日摄入 / 7 天均值 baseline / 减糖等价勋章
 *
 * baseline:用户头 7 天 daily sugar 均值;少于 3 天数据 → 默认 45g(中国成年人均值上限,
 * 中国营养学会 2022《居民膳食指南》:添加糖每天不超过 25g,2010 年代实际人均 ~30-50g)
 *
 * 勋章映射:
 *   - 🍭 棒棒糖 = 6g
 *   - 🍫 巧克力 = 12g(典型 25g 装一块)
 *   - 🥤 可乐    = 35g(330ml 听装)
 *   - 🧋 奶茶    = 50g(全糖大杯)
 *
 * 规则:某天 saved = max(0, baseline - daily_sugar);把 saved 折算成最大可"装满"的勋章组合。
 * 例 saved=72g → 1 奶茶(50)+ 1 巧克力(12)+ ……→ 简单贪心从大到小取。
 */

import { withClient } from '../../db/client';

export interface SugarTodayPayload {
  todayGrams: number | null;
  /** 用户已观测到的最近 7 天均值(用于个性化 baseline);< 3 天 = null,前端用默认 45g */
  sevenDayAvg: number | null;
  baselineDailyG: number;
  /** 今日相比 baseline 减少了多少 g(负数 = 比 baseline 多吃了) */
  todaySavedG: number;
  /** 当月累计 saved(g) — 用于计算月度勋章 */
  monthSavedG: number;
  /** 当月勋章 — 由 monthSavedG 折算 */
  monthlyBadges: SugarBadge[];
}

export interface SugarBadge {
  kind: 'lollipop' | 'chocolate' | 'cola' | 'milktea';
  emoji: string;
  label: string;
  gramsEach: number;
  count: number;
}

export const DEFAULT_BASELINE_G = 45;

const BADGE_DEFS: Array<Omit<SugarBadge, 'count'>> = [
  { kind: 'milktea', emoji: '🧋', label: '奶茶', gramsEach: 50 },
  { kind: 'cola', emoji: '🥤', label: '可乐', gramsEach: 35 },
  { kind: 'chocolate', emoji: '🍫', label: '巧克力', gramsEach: 12 },
  { kind: 'lollipop', emoji: '🍭', label: '棒棒糖', gramsEach: 6 }
];

/** 贪心折算:从大到小依次塞,余 < 6g 不再折算 */
export function gramsToBadges(savedGrams: number): SugarBadge[] {
  let remaining = Math.max(0, Math.floor(savedGrams));
  const out: SugarBadge[] = [];
  for (const def of BADGE_DEFS) {
    const count = Math.floor(remaining / def.gramsEach);
    if (count > 0) {
      out.push({ ...def, count });
      remaining -= count * def.gramsEach;
    } else {
      out.push({ ...def, count: 0 });
    }
  }
  return out.filter((b) => b.count > 0);
}

export interface SugarStore {
  /** 返回 [date asc, totalSugarG] — 仅含 sugar_grams 非 null 的天 */
  dailySumsBetween(userId: string, sinceDate: string, untilDate: string): Promise<Array<{ date: string; totalG: number }>>;
}

export class PgSugarStore implements SugarStore {
  async dailySumsBetween(userId: string, sinceDate: string, untilDate: string): Promise<Array<{ date: string; totalG: number }>> {
    return await withClient(async (c) => {
      const r = await c.query<{ date: string; total: string }>(
        `SELECT (ate_at::date)::text AS date, COALESCE(SUM(sugar_grams), 0)::text AS total
           FROM meals
          WHERE user_id = $1
            AND ate_at::date >= $2
            AND ate_at::date <= $3
            AND sugar_grams IS NOT NULL
          GROUP BY (ate_at::date)
          ORDER BY (ate_at::date) ASC`,
        [userId, sinceDate, untilDate]
      );
      return r.rows.map((row) => ({ date: row.date, totalG: Number(row.total) }));
    });
  }
}

export interface ComputeSugarDeps {
  store: SugarStore;
  now?: () => Date;
}

function isoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
}

function daysAgo(d: Date, n: number): Date {
  const x = new Date(d);
  x.setDate(d.getDate() - n);
  return x;
}

function firstOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

export async function computeSugarToday(deps: ComputeSugarDeps, userId: string): Promise<SugarTodayPayload> {
  const now = (deps.now ?? (() => new Date()))();
  const todayStr = isoDate(now);
  const sevenDayStart = isoDate(daysAgo(now, 7));
  const monthStart = isoDate(firstOfMonth(now));

  // 一次取整月内所有日 sum,7 天均值 + 今天 + 月累计都从这里派生
  const monthRows = await deps.store.dailySumsBetween(userId, monthStart, todayStr);
  const byDate = new Map(monthRows.map((r) => [r.date, r.totalG]));
  const todayGrams = byDate.has(todayStr) ? byDate.get(todayStr)! : null;

  // 7 天均值:取过去 7 天里所有有数据的日期 avg
  const recent7 = monthRows.filter((r) => r.date >= sevenDayStart && r.date < todayStr);
  const sevenDayAvg = recent7.length >= 3
    ? Math.round((recent7.reduce((s, r) => s + r.totalG, 0) / recent7.length) * 10) / 10
    : null;

  const baseline = sevenDayAvg ?? DEFAULT_BASELINE_G;

  // 今日 saved
  const todaySavedG = todayGrams === null ? 0 : Math.max(0, Math.round((baseline - todayGrams) * 10) / 10);

  // 月累计 saved:每个有数据的天 = max(0, baseline - daily)
  let monthSavedG = 0;
  for (const r of monthRows) {
    monthSavedG += Math.max(0, baseline - r.totalG);
  }
  monthSavedG = Math.round(monthSavedG * 10) / 10;

  return {
    todayGrams,
    sevenDayAvg,
    baselineDailyG: baseline,
    todaySavedG,
    monthSavedG,
    monthlyBadges: gramsToBadges(monthSavedG)
  };
}
