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

  app.get('/home/today', async (req, reply) => {
    const user = requireUser(req, reply);
    if (!user) return;
    const date = todayDateString(now());
    const meals = await mealStore.listByDate(user.userId, date);
    return {
      ok: true,
      date,
      meals: meals.map((m) => ({
        id: m.id,
        ateAt: m.ateAt,
        photoOssKey: m.photoOssKey,
        fireScore: m.fireScore,
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

  // U3 撤回流程曾依赖 withClient(我们这里不需要,但 import 保持检查通过)
  void withClient;
}
