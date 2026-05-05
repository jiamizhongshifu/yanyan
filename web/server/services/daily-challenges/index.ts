/**
 * 每日挑战历史服务
 *
 * - upsert(userId, date, snapshot):覆盖式写入(同一天后写覆盖前写)
 * - listMonth(userId, year, month):返回该月所有挑战快照
 * - aggregateMonth(rows):汇总成 { perfect, great, nice } 计数
 *
 * 设计:不是事件流。每天 1 行,客户端在挑战值变化时调 upsert(节流由前端做)。
 */

import { withClient } from '../../db/client';

export type DayTier = 'perfect' | 'great' | 'nice' | 'none';
export type FireLevel = '平' | '微火' | '中火' | '大火';

export interface DailyChallengeSnapshot {
  date: string; // YYYY-MM-DD
  tier: DayTier;
  completedCount: number;
  completedKeys: string[];
  fireLevel: FireLevel | null;
  updatedAt: string;
}

export interface UpsertParams {
  userId: string;
  date: string;
  tier: DayTier;
  completedCount: number;
  completedKeys: string[];
  fireLevel: FireLevel | null;
}

export interface DailyChallengeStore {
  upsert(p: UpsertParams): Promise<void>;
  listMonth(userId: string, year: number, month: number): Promise<DailyChallengeSnapshot[]>;
}

interface RowFromDb {
  date: string;
  tier: DayTier;
  completed_count: number;
  completed_keys: string[];
  fire_level: FireLevel | null;
  updated_at: Date;
}

function toSnapshot(r: RowFromDb): DailyChallengeSnapshot {
  return {
    date: r.date,
    tier: r.tier,
    completedCount: r.completed_count,
    completedKeys: r.completed_keys,
    fireLevel: r.fire_level,
    updatedAt: r.updated_at instanceof Date ? r.updated_at.toISOString() : String(r.updated_at)
  };
}

export class PgDailyChallengeStore implements DailyChallengeStore {
  async upsert(p: UpsertParams): Promise<void> {
    await withClient((c) =>
      c.query(
        `INSERT INTO user_daily_challenges
            (user_id, date, tier, completed_count, completed_keys, fire_level, updated_at)
          VALUES ($1, $2, $3, $4, $5, $6, now())
          ON CONFLICT (user_id, date) DO UPDATE SET
            tier            = EXCLUDED.tier,
            completed_count = EXCLUDED.completed_count,
            completed_keys  = EXCLUDED.completed_keys,
            fire_level      = EXCLUDED.fire_level,
            updated_at      = now()`,
        [p.userId, p.date, p.tier, p.completedCount, JSON.stringify(p.completedKeys), p.fireLevel]
      )
    );
  }

  async listMonth(userId: string, year: number, month: number): Promise<DailyChallengeSnapshot[]> {
    const start = `${year}-${String(month).padStart(2, '0')}-01`;
    // 月末 = 下月第 1 天 - 1 天,简化用 32 天后取月内
    const endDate = new Date(year, month, 0); // month 1-12 → Date month 0-based 取下月-1天
    const end = `${endDate.getFullYear()}-${String(endDate.getMonth() + 1).padStart(2, '0')}-${String(endDate.getDate()).padStart(2, '0')}`;
    return await withClient(async (c) => {
      const r = await c.query<RowFromDb>(
        `SELECT (date)::text AS date, tier, completed_count, completed_keys, fire_level, updated_at
           FROM user_daily_challenges
          WHERE user_id = $1 AND date >= $2 AND date <= $3
          ORDER BY date ASC`,
        [userId, start, end]
      );
      return r.rows.map(toSnapshot);
    });
  }
}

export interface MonthAggregate {
  perfect: number;
  great: number;
  nice: number;
  none: number;
  /** 当月所有快照,前端可直接用于月历 / 趋势 */
  days: DailyChallengeSnapshot[];
}

export function aggregateMonth(rows: DailyChallengeSnapshot[]): MonthAggregate {
  let perfect = 0;
  let great = 0;
  let nice = 0;
  let none = 0;
  for (const r of rows) {
    if (r.tier === 'perfect') perfect++;
    else if (r.tier === 'great') great++;
    else if (r.tier === 'nice') nice++;
    else none++;
  }
  return { perfect, great, nice, none, days: rows };
}
