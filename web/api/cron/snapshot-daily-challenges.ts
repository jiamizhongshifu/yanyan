/**
 * Vercel Cron — 每天 23:55 北京(15:55 UTC)落库当日挑战快照
 *
 * 设计目标:即使用户当天没打开 app,server 端可观测的挑战(拍餐/控糖/打卡)
 * 也应记入 user_daily_challenges,让"洞悉"页玻璃瓶能跨日累积。
 *
 * 触发对象:今日有过 meals 或 next_morning symptoms 的用户(server 已知活跃)。
 *   - 没拍照也没打卡 → 没必要写一行 'none'(用户根本没参与,强写会污染数据)
 *
 * 写入策略:ON CONFLICT (user_id, date) DO NOTHING — 已有客户端实时上报的快照
 *   不被覆盖(客户端的 water/steps 数据更全;cron 仅做兜底)。
 *
 * 字段计算(仅 server-side 可见的 3/5 项):
 *   - meals      ≥ 2  ✓ 拍餐
 *   - low_sugar  Σsugar_grams ≤ 25 g(且至少 1 餐有糖分估算)
 *   - checkin    今日 next_morning symptoms 存在
 *   - water/steps:cron 不知 → 仅靠这 3 项算 tier:≥3 = great / 1-2 = nice / 0 = none
 *     (永远不写 perfect — 因为 perfect 需要客户端真实上报至少 4 项)
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { withClient } from '../../server/db/client';

const DAILY_SUGAR_GOAL_G = 25;

interface ServerChallengeState {
  userId: string;
  date: string;
  mealsCount: number;
  totalSugarG: number | null;
  hasCheckin: boolean;
  fireLevel: '平' | '微火' | '中火' | '大火' | null;
}

interface RunResult {
  scanned: number;
  inserted: number;
  skipped: number; // 已有客户端 row → 不覆盖
  errors: string[];
}

async function gatherTodayState(): Promise<ServerChallengeState[]> {
  return withClient(async (c) => {
    // 获取今日 UTC 日期(Vercel cron 在 UTC 触发;客户端用 local date,但 server 一致用 UTC date 简化)
    const r = await c.query<{
      user_id: string;
      date: string;
      meals_count: string;
      sugar_grams_sum: string | null;
      sugar_grams_known: string;
      has_checkin: boolean;
      fire_level: '平' | '微火' | '中火' | '大火' | null;
    }>(
      `WITH today AS (SELECT CURRENT_DATE AS d),
            meal_agg AS (
              SELECT user_id,
                     COUNT(*)::int AS meals_count,
                     COALESCE(SUM(sugar_grams), 0) AS sugar_grams_sum,
                     COUNT(*) FILTER (WHERE sugar_grams IS NOT NULL)::int AS sugar_grams_known
                FROM meals, today
               WHERE ate_at::date = today.d
               GROUP BY user_id
            ),
            sym AS (
              SELECT DISTINCT s.user_id
                FROM symptoms s, today
               WHERE s.recorded_for_date = today.d AND s.source = 'next_morning'
            ),
            score AS (
              SELECT y.user_id, y.level
                FROM yan_score_daily y, today
               WHERE y.date = today.d
            ),
            active AS (
              SELECT user_id FROM meal_agg
              UNION
              SELECT user_id FROM sym
            )
       SELECT a.user_id,
              (SELECT d::text FROM today)             AS date,
              COALESCE(m.meals_count, 0)::text         AS meals_count,
              m.sugar_grams_sum::text                  AS sugar_grams_sum,
              COALESCE(m.sugar_grams_known, 0)::text   AS sugar_grams_known,
              EXISTS (SELECT 1 FROM sym WHERE user_id = a.user_id) AS has_checkin,
              s.level                                   AS fire_level
         FROM active a
         LEFT JOIN meal_agg m ON m.user_id = a.user_id
         LEFT JOIN score s    ON s.user_id = a.user_id`
    );

    return r.rows.map((row) => ({
      userId: row.user_id,
      date: row.date,
      mealsCount: Number(row.meals_count),
      totalSugarG: Number(row.sugar_grams_known) > 0 ? Number(row.sugar_grams_sum) : null,
      hasCheckin: row.has_checkin,
      fireLevel: row.fire_level
    }));
  });
}

function computeTier(s: ServerChallengeState): {
  tier: 'great' | 'nice' | 'none';
  count: number;
  keys: string[];
} {
  const keys: string[] = [];
  if (s.mealsCount >= 2) keys.push('meals');
  if (s.totalSugarG !== null && s.totalSugarG <= DAILY_SUGAR_GOAL_G) keys.push('low_sugar');
  if (s.hasCheckin) keys.push('checkin');
  // water/steps 由客户端补;cron 永远写不到 perfect tier
  const count = keys.length;
  const tier: 'great' | 'nice' | 'none' = count >= 3 ? 'great' : count >= 1 ? 'nice' : 'none';
  return { tier, count, keys };
}

export async function runCron(): Promise<RunResult> {
  const states = await gatherTodayState();
  let inserted = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (const s of states) {
    try {
      const { tier, count, keys } = computeTier(s);
      if (tier === 'none') continue; // 完全没参与 → 不写
      const r = await withClient((c) =>
        c.query<{ inserted: number }>(
          `INSERT INTO user_daily_challenges
              (user_id, date, tier, completed_count, completed_keys, fire_level, updated_at)
            VALUES ($1, $2, $3, $4, $5::jsonb, $6, now())
            ON CONFLICT (user_id, date) DO NOTHING
            RETURNING 1 AS inserted`,
          [s.userId, s.date, tier, count, JSON.stringify(keys), s.fireLevel]
        )
      );
      if (r.rowCount && r.rowCount > 0) inserted++;
      else skipped++;
    } catch (err) {
      errors.push(`${s.userId}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
  return { scanned: states.length, inserted, skipped, errors };
}

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  const isVercelCron = req.headers['x-vercel-cron'] === '1';
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = (req.headers.authorization ?? '').replace(/^Bearer\s+/i, '');
  const authorized = isVercelCron || (cronSecret && authHeader === cronSecret);
  if (!authorized) {
    res.status(401).json({ ok: false, error: 'unauthorized' });
    return;
  }

  try {
    const result = await runCron();
    res.status(200).json({ ok: true, ...result });
  } catch (err) {
    res.status(500).json({ ok: false, error: err instanceof Error ? err.message : String(err) });
  }
}

export const _runForTesting = runCron;
