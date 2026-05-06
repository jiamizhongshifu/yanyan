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
import { SupabaseRestUserStore } from '../../services/users/store-rest';
import type { UserStore } from '../../services/users/store';
import { getTextClient, type LlmTextClient } from '../../services/llm/deepseek';
import { buildTodayRecommendation } from '../../services/recommend';

export interface RegisterRecommendOptions {
  deps?: {
    mealStore?: MealStore;
    classifierStore?: FoodClassifierStore;
    userStore?: UserStore;
    llm?: LlmTextClient;
    now?: () => Date;
  };
}

export async function registerRecommendRoutes(
  app: FastifyInstance,
  opts: RegisterRecommendOptions = {}
): Promise<void> {
  const mealStore = opts.deps?.mealStore ?? new PgMealStore();
  const classifierStore = opts.deps?.classifierStore ?? new PgFoodClassifierStore();
  const userStore = opts.deps?.userStore ?? new SupabaseRestUserStore();
  // DEEPSEEK_API_KEY 配置时启用 LLM 个性化;否则只用 template
  const llm = opts.deps?.llm ?? (process.env.DEEPSEEK_API_KEY ? getTextClient() : undefined);
  const now = opts.deps?.now ?? (() => new Date());

  app.get('/recommend/today', async (req, reply) => {
    const user = requireUser(req, reply);
    if (!user) return;
    const result = await buildTodayRecommendation(
      { mealStore, classifierStore, userStore, llm, now },
      user.userId
    );
    return { ok: true, recommendation: result };
  });
}
