/**
 * Yan-Score 历史拉取 + 缓存
 *
 * 从 yan_score_daily 表读取;表里没有的天数 → 走 computeYanScoreForDay 实时算 + 回写缓存。
 * 今日不写缓存(数据未完整,凌晨 cron 写;其余日期算完即写,后续读直接命中)。
 */

import { withClient } from '../../db/client';
import { computeYanScoreForDay, type ScoreDeps } from './index';
import type { FireLevel, YanScoreResult } from './types';

export interface YanScoreHistoryEntry {
  date: string; // YYYY-MM-DD
  total: number | null;
  level: FireLevel | null;
  partScores: { food: number | null; symptom: number | null; env: number | null; activity: number | null };
  cached: boolean;
}

interface CachedRow {
  date: string;
  food_part: string | null;
  symptom_part: string | null;
  env_part: string | null;
  activity_part: string | null;
  total: string | null;
  level: FireLevel | null;
}

function isoDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function todayStr(now: Date): string {
  return isoDate(now);
}

function* iterDates(since: string, until: string): Generator<string> {
  const s = new Date(since);
  const e = new Date(until);
  const cur = new Date(s);
  while (cur <= e) {
    yield isoDate(cur);
    cur.setDate(cur.getDate() + 1);
  }
}

async function loadCachedRange(userId: string, since: string, until: string): Promise<Map<string, CachedRow>> {
  return withClient(async (c) => {
    const r = await c.query<CachedRow>(
      `SELECT (date)::text AS date, food_part, symptom_part, env_part, activity_part, total, level
         FROM yan_score_daily
        WHERE user_id = $1 AND date >= $2 AND date <= $3
        ORDER BY date ASC`,
      [userId, since, until]
    );
    return new Map(r.rows.map((row) => [row.date, row]));
  });
}

async function upsertCache(userId: string, date: string, result: YanScoreResult | null, partScores: YanScoreHistoryEntry['partScores']): Promise<void> {
  await withClient((c) =>
    c.query(
      `INSERT INTO yan_score_daily
          (user_id, date, food_part, symptom_part, env_part, activity_part, total, level, breakdown)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb)
        ON CONFLICT (user_id, date) DO UPDATE SET
          food_part     = EXCLUDED.food_part,
          symptom_part  = EXCLUDED.symptom_part,
          env_part      = EXCLUDED.env_part,
          activity_part = EXCLUDED.activity_part,
          total         = EXCLUDED.total,
          level         = EXCLUDED.level,
          breakdown     = EXCLUDED.breakdown,
          computed_at   = now()`,
      [
        userId,
        date,
        partScores.food,
        partScores.symptom,
        partScores.env,
        partScores.activity,
        result?.score ?? null,
        result?.level ?? null,
        JSON.stringify(result?.breakdown ?? {})
      ]
    )
  );
}

export interface FetchHistoryOpts {
  /** 注入测试用 */
  now?: () => Date;
}

export async function fetchYanScoreHistory(
  deps: ScoreDeps,
  userId: string,
  since: string,
  until: string,
  opts: FetchHistoryOpts = {}
): Promise<YanScoreHistoryEntry[]> {
  const now = (opts.now ?? (() => new Date()))();
  const today = todayStr(now);
  const cached = await loadCachedRange(userId, since, until);

  const entries: YanScoreHistoryEntry[] = [];
  for (const date of iterDates(since, until)) {
    const c = cached.get(date);
    if (c && c.total !== null) {
      entries.push({
        date,
        total: Number(c.total),
        level: c.level,
        partScores: {
          food: c.food_part === null ? null : Number(c.food_part),
          symptom: c.symptom_part === null ? null : Number(c.symptom_part),
          env: c.env_part === null ? null : Number(c.env_part),
          activity: c.activity_part === null ? null : Number(c.activity_part)
        },
        cached: true
      });
      continue;
    }

    // miss → compute
    try {
      const computed = await computeYanScoreForDay(deps, userId, date);
      entries.push({
        date,
        total: computed.result?.score ?? null,
        level: computed.result?.level ?? null,
        partScores: computed.partScores,
        cached: false
      });
      // 不缓存今日(数据可能还在变);其余日子算完写回
      if (date !== today) {
        await upsertCache(userId, date, computed.result, computed.partScores);
      }
    } catch (err) {
      entries.push({
        date,
        total: null,
        level: null,
        partScores: { food: null, symptom: null, env: null, activity: null },
        cached: false
      });
      // eslint-disable-next-line no-console
      console.warn(`[yan-score-history] compute fail ${userId}/${date}:`, err instanceof Error ? err.message : err);
    }
  }
  return entries;
}
