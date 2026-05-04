/**
 * /api/v1/recommend 路由 (plan U13a)
 *
 * GET /recommend/today  → 今日推荐(避开列表 + 3 餐建议 + 文案)
 *
 * 群体维度,不个体化(plan 边界)。
 */

import type { FastifyInstance } from 'fastify';
import { requireUser } from '../../auth';
import { PgFoodClassifierStore, type FoodClassifierStore } from '../../services/classifier';
import { PgMealStore, type MealStore } from '../../services/meals';
import { buildTodayRecommendation } from '../../services/recommend';

export interface RegisterRecommendOptions {
  deps?: {
    mealStore?: MealStore;
    classifierStore?: FoodClassifierStore;
    now?: () => Date;
  };
}

export async function registerRecommendRoutes(
  app: FastifyInstance,
  opts: RegisterRecommendOptions = {}
): Promise<void> {
  const mealStore = opts.deps?.mealStore ?? new PgMealStore();
  const classifierStore = opts.deps?.classifierStore ?? new PgFoodClassifierStore();
  const now = opts.deps?.now ?? (() => new Date());

  app.get('/recommend/today', async (req, reply) => {
    const user = requireUser(req, reply);
    if (!user) return;
    const result = await buildTodayRecommendation(
      { mealStore, classifierStore, now },
      user.userId
    );
    return { ok: true, recommendation: result };
  });
}
