/**
 * 用户健康数据服务 — 步数 / 静息心率(供 Apple Health 快捷指令 / 手动录入)
 */
import { withClient } from '../../db/client';

export interface HealthDailyRow {
  date: string;
  steps: number | null;
  restingHr: number | null;
  waterCups: number | null;
  source: string;
  updatedAt: string;
}

export interface HealthStore {
  upsert(p: {
    userId: string;
    date: string;
    steps?: number | null;
    restingHr?: number | null;
    waterCups?: number | null;
    source: string;
  }): Promise<void>;
  findByDate(userId: string, date: string): Promise<HealthDailyRow | null>;
  listMonth(userId: string, year: number, month: number): Promise<HealthDailyRow[]>;
}

interface RowFromDb {
  date: string;
  steps: number | null;
  resting_hr: number | null;
  water_cups: number | null;
  source: string;
  updated_at: Date;
}

function toRow(r: RowFromDb): HealthDailyRow {
  return {
    date: r.date,
    steps: r.steps,
    restingHr: r.resting_hr,
    waterCups: r.water_cups,
    source: r.source,
    updatedAt: r.updated_at instanceof Date ? r.updated_at.toISOString() : String(r.updated_at)
  };
}

export class PgHealthStore implements HealthStore {
  async upsert(p: {
    userId: string;
    date: string;
    steps?: number | null;
    restingHr?: number | null;
    waterCups?: number | null;
    source: string;
  }): Promise<void> {
    await withClient((c) =>
      c.query(
        `INSERT INTO user_health_daily (user_id, date, steps, resting_hr, water_cups, source, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, now())
         ON CONFLICT (user_id, date) DO UPDATE SET
           steps       = COALESCE(EXCLUDED.steps, user_health_daily.steps),
           resting_hr  = COALESCE(EXCLUDED.resting_hr, user_health_daily.resting_hr),
           water_cups  = COALESCE(EXCLUDED.water_cups, user_health_daily.water_cups),
           source      = EXCLUDED.source,
           updated_at  = now()`,
        [p.userId, p.date, p.steps ?? null, p.restingHr ?? null, p.waterCups ?? null, p.source]
      )
    );
  }

  async findByDate(userId: string, date: string): Promise<HealthDailyRow | null> {
    return withClient(async (c) => {
      const r = await c.query<RowFromDb>(
        `SELECT (date)::text AS date, steps, resting_hr, water_cups, source, updated_at
           FROM user_health_daily WHERE user_id = $1 AND date = $2`,
        [userId, date]
      );
      return r.rowCount === 0 ? null : toRow(r.rows[0]);
    });
  }

  async listMonth(userId: string, year: number, month: number): Promise<HealthDailyRow[]> {
    const start = `${year}-${String(month).padStart(2, '0')}-01`;
    const endDate = new Date(year, month, 0);
    const end = `${endDate.getFullYear()}-${String(endDate.getMonth() + 1).padStart(2, '0')}-${String(endDate.getDate()).padStart(2, '0')}`;
    return withClient(async (c) => {
      const r = await c.query<RowFromDb>(
        `SELECT (date)::text AS date, steps, resting_hr, water_cups, source, updated_at
           FROM user_health_daily
          WHERE user_id = $1 AND date >= $2 AND date <= $3
          ORDER BY date ASC`,
        [userId, start, end]
      );
      return r.rows.map(toRow);
    });
  }
}
