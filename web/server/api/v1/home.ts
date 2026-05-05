/**
 * /api/v1/home/today + /api/v1/users/me/progress
 *
 * 主屏聚合(plan U10):
 *   - GET /home/today:今日餐食列表(简化字段,id/ateAt/level/fireScore/photoOssKey)
 *   - GET /users/me/progress:累计打卡天数 + 阈值标志(R20b 21 天 / R24 30 天)
 *
 * /yan-score/today 已存在(U7+U8),不在此重复;前端并行调用即可。
 */

import type { FastifyInstance } from 'fastify';
import { requireUser } from '../../auth';
import { withClient } from '../../db/client';
import {
  PgMealStore,
  scoreToLevel,
  type MealStore
} from '../../services/meals';
import {
  PgSymptomStore,
  todayDateString,
  type SymptomStore
} from '../../services/symptoms';

const TREND_THRESHOLD_DAYS = 21; // R20b
const PROFILE_PDF_DAY = 30; // R24

export interface RegisterHomeOptions {
  deps?: {
    mealStore?: MealStore;
    symptomStore?: SymptomStore;
    /** 注入 now 便于测试 */
    now?: () => Date;
  };
}

export async function registerHomeRoutes(app: FastifyInstance, opts: RegisterHomeOptions = {}): Promise<void> {
  const mealStore = opts.deps?.mealStore ?? new PgMealStore();
  const symptomStore = opts.deps?.symptomStore ?? new PgSymptomStore();
  const now = opts.deps?.now ?? (() => new Date());

  app.get<{ Querystring: { date?: string } }>('/home/today', async (req, reply) => {
    const user = requireUser(req, reply);
    if (!user) return;
    const dateRe = /^\d{4}-\d{2}-\d{2}$/;
    const date = req.query.date && dateRe.test(req.query.date) ? req.query.date : todayDateString(now());
    const meals = await mealStore.listByDate(user.userId, date);
    return {
      ok: true,
      date,
      meals: meals.map((m) => ({
        id: m.id,
        ateAt: m.ateAt,
        photoOssKey: m.photoOssKey,
        fireScore: m.fireScore,
        sugarGrams: m.sugarGrams,
        level: m.fireScore !== null ? scoreToLevel(m.fireScore) : null,
        tcmLabelsSummary: m.tcmLabelsSummary
      }))
    };
  });

  app.get('/users/me/progress', async (req, reply) => {
    const user = requireUser(req, reply);
    if (!user) return;
    const cumulativeCheckinDays = await symptomStore.countDistinctCheckinDates(user.userId);
    return {
      ok: true,
      cumulativeCheckinDays,
      thresholds: {
        trendLineDays: TREND_THRESHOLD_DAYS,
        profilePdfDay: PROFILE_PDF_DAY
      },
      flags: {
        canDrawTrend: cumulativeCheckinDays >= TREND_THRESHOLD_DAYS,
        eligibleForProfilePdf: cumulativeCheckinDays >= PROFILE_PDF_DAY
      }
    };
  });

  /** GET /home/month?year=&month= — 当月汇总(餐数 / 拍餐天 / 打卡天 / 累计步数) */
  app.get<{ Querystring: { year?: string; month?: string } }>('/home/month', async (req, reply) => {
    const user = requireUser(req, reply);
    if (!user) return;
    const today = now();
    const year = Number(req.query.year ?? today.getFullYear());
    const month = Number(req.query.month ?? today.getMonth() + 1);
    if (!Number.isFinite(year) || !Number.isFinite(month) || month < 1 || month > 12) {
      reply.code(400);
      return { ok: false, error: 'invalid_query' };
    }
    const start = `${year}-${String(month).padStart(2, '0')}-01`;
    const endDate = new Date(year, month, 0);
    const end = `${endDate.getFullYear()}-${String(endDate.getMonth() + 1).padStart(2, '0')}-${String(endDate.getDate()).padStart(2, '0')}`;

    const summary = await withClient(async (c) => {
      const r = await c.query<{
        total_meals: string;
        photo_days: string;
        checkin_days: string;
        total_steps: string;
      }>(
        `SELECT
          (SELECT COUNT(*)::text FROM meals
            WHERE user_id = $1 AND ate_at::date BETWEEN $2 AND $3) AS total_meals,
          (SELECT COUNT(DISTINCT ate_at::date)::text FROM meals
            WHERE user_id = $1 AND ate_at::date BETWEEN $2 AND $3) AS photo_days,
          (SELECT COUNT(DISTINCT recorded_for_date)::text FROM symptoms
            WHERE user_id = $1 AND recorded_for_date BETWEEN $2 AND $3
              AND source = 'next_morning') AS checkin_days,
          (SELECT COALESCE(SUM(steps), 0)::text FROM user_health_daily
            WHERE user_id = $1 AND date BETWEEN $2 AND $3) AS total_steps`,
        [user.userId, start, end]
      );
      const row = r.rows[0];
      return {
        totalMeals: Number(row.total_meals),
        photoDays: Number(row.photo_days),
        checkinDays: Number(row.checkin_days),
        totalSteps: Number(row.total_steps)
      };
    });
    return { ok: true, year, month, ...summary };
  });
}
