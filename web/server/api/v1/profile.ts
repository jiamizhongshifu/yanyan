/**
 * /api/v1/profile 路由 (plan U13b)
 *
 * GET /profile/v05 → 返回结构化档案数据;
 *   累计 < 30 天 → 200 + ok:false reason:not_eligible(便于前端展示进度卡)
 *   累计 >= 30 天 → 200 + ok:true + data
 *
 * v1 客户端在 /profile-pdf 路由用 window.print() 转 PDF;
 * 服务端 puppeteer 渲染 + OSS 签名 URL 留到 Phase 2(原 plan 路径,小程序 → H5 pivot 后简化)。
 */

import type { FastifyInstance } from 'fastify';
import { requireUser } from '../../auth';
import { PgFoodClassifierStore, type FoodClassifierStore } from '../../services/classifier';
import { PgMealStore, type MealStore } from '../../services/meals';
import { PgSymptomStore, type SymptomStore } from '../../services/symptoms';
import { buildProfileV05 } from '../../services/profile';

export interface RegisterProfileOptions {
  deps?: {
    mealStore?: MealStore;
    symptomStore?: SymptomStore;
    classifierStore?: FoodClassifierStore;
    now?: () => Date;
  };
}

export async function registerProfileRoutes(
  app: FastifyInstance,
  opts: RegisterProfileOptions = {}
): Promise<void> {
  const mealStore = opts.deps?.mealStore ?? new PgMealStore();
  const symptomStore = opts.deps?.symptomStore ?? new PgSymptomStore();
  const classifierStore = opts.deps?.classifierStore ?? new PgFoodClassifierStore();
  const now = opts.deps?.now ?? (() => new Date());

  app.get('/profile/v05', async (req, reply) => {
    const user = requireUser(req, reply);
    if (!user) return;
    const result = await buildProfileV05(
      { mealStore, symptomStore, classifierStore, now },
      user.userId
    );
    if (!result.ok) {
      return {
        ok: false,
        reason: result.reason,
        cumulativeCheckinDays: result.cumulativeCheckinDays,
        required: result.required
      };
    }
    return { ok: true, data: result.data };
  });
}
