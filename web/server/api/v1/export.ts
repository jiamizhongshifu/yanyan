/**
 * /api/v1/users/me/export — 导出用户数据 CSV(仅日级汇总,不含解密的餐照详情)
 *
 * v1 输出列(按日聚合):
 *   date, fire_level, fire_score, sugar_grams, meal_count, has_checkin,
 *   tier, completed_count, water_cups(本地), steps, resting_hr
 *
 * 不导出:
 *   - meals.recognized_items_ciphertext(用户隐私,需 envelope 解密)
 *   - symptoms blind_input/severity ciphertext(同上)
 *
 * 用户想导出原始数据可走「撤回同意」走 KMS 退役流程,这是合规层面的另一通路。
 */

import type { FastifyInstance } from 'fastify';
import { requireUser } from '../../auth';
import { withClient } from '../../db/client';

interface DailyRow {
  date: string;
  fire_level: string | null;
  fire_score: string | null;
  sugar_grams: string | null;
  meal_count: string;
  has_checkin: boolean;
  tier: string | null;
  completed_count: string | null;
  steps: string | null;
  resting_hr: string | null;
}

function escapeCsv(v: string | number | null | undefined): string {
  if (v === null || v === undefined || v === '') return '';
  const s = String(v);
  // 含逗号 / 引号 / 换行 → 加引号 + 转义
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export async function registerExportRoutes(app: FastifyInstance): Promise<void> {
  app.get('/users/me/export', async (req, reply) => {
    const user = requireUser(req, reply);
    if (!user) return;

    const rows = await withClient(async (c) => {
      const r = await c.query<DailyRow>(
        `WITH dates AS (
            SELECT DISTINCT date FROM (
              SELECT (ate_at::date)::text AS date FROM meals WHERE user_id = $1
              UNION
              SELECT recorded_for_date::text FROM symptoms WHERE user_id = $1
              UNION
              SELECT date::text FROM yan_score_daily WHERE user_id = $1
              UNION
              SELECT date::text FROM user_daily_challenges WHERE user_id = $1
              UNION
              SELECT date::text FROM user_health_daily WHERE user_id = $1
            ) all_dates
          ),
          meal_agg AS (
            SELECT (ate_at::date)::text AS date,
                   COUNT(*)::text AS meal_count,
                   COALESCE(SUM(sugar_grams), 0)::text AS sugar_grams
              FROM meals WHERE user_id = $1
             GROUP BY (ate_at::date)
          ),
          sym AS (
            SELECT DISTINCT recorded_for_date::text AS date
              FROM symptoms WHERE user_id = $1 AND source = 'next_morning'
          )
          SELECT d.date,
                 ys.level::text AS fire_level,
                 ys.total::text AS fire_score,
                 m.sugar_grams,
                 COALESCE(m.meal_count, '0') AS meal_count,
                 EXISTS (SELECT 1 FROM sym WHERE sym.date = d.date) AS has_checkin,
                 c.tier,
                 c.completed_count::text AS completed_count,
                 h.steps::text AS steps,
                 h.resting_hr::text AS resting_hr
            FROM dates d
            LEFT JOIN yan_score_daily ys ON ys.user_id = $1 AND ys.date::text = d.date
            LEFT JOIN meal_agg m ON m.date = d.date
            LEFT JOIN user_daily_challenges c ON c.user_id = $1 AND c.date::text = d.date
            LEFT JOIN user_health_daily h ON h.user_id = $1 AND h.date::text = d.date
           ORDER BY d.date ASC`,
        [user.userId]
      );
      return r.rows;
    });

    const header = [
      'date',
      'fire_level',
      'fire_score',
      'sugar_grams',
      'meal_count',
      'has_checkin',
      'tier',
      'completed_count',
      'steps',
      'resting_hr'
    ];

    const lines = [header.join(',')];
    for (const r of rows) {
      lines.push(
        [
          r.date,
          r.fire_level,
          r.fire_score,
          r.sugar_grams,
          r.meal_count,
          r.has_checkin ? 'true' : 'false',
          r.tier,
          r.completed_count,
          r.steps,
          r.resting_hr
        ]
          .map(escapeCsv)
          .join(',')
      );
    }
    const csv = lines.join('\n');
    const today = new Date().toISOString().slice(0, 10);

    reply.header('Content-Type', 'text/csv; charset=utf-8');
    reply.header('Content-Disposition', `attachment; filename="soak-export-${today}.csv"`);
    return csv;
  });
}
