/**
 * /api/v1/foods 食物分类查询路由
 *
 * 端点:
 *   GET /foods/:name/classification
 *     - 命中:返回完整 FoodClassification(含中医 + 西方双层)
 *     - 未命中:404 + 异步进入回填队列
 *
 * 注:v1 前端只渲染中医层(tcmLabel / tcmProperty / citations),
 * 西方层(diiScore / agesScore / gi)由 U8 Yan-Score 算法 + Phase 3 出海版本消费。
 * 但 API 一次性返回双层,客户端按需渲染。
 */

import type { FastifyInstance } from 'fastify';
import {
  PgFoodClassifierStore,
  getClassification,
  type FoodClassifierStore
} from '../../services/classifier';

export interface RegisterFoodsOptions {
  deps?: {
    store?: FoodClassifierStore;
    onMissingFood?: (name: string) => void;
  };
}

export async function registerFoodsRoutes(app: FastifyInstance, opts: RegisterFoodsOptions = {}): Promise<void> {
  const store = opts.deps?.store ?? new PgFoodClassifierStore();
  const onMissingFood = opts.deps?.onMissingFood;

  app.get<{ Params: { name: string } }>('/foods/:name/classification', async (req, reply) => {
    const decoded = decodeURIComponent(req.params.name);
    const result = await getClassification({ store, onMissingFood }, decoded);
    if (!result) {
      reply.code(404);
      return {
        ok: false,
        error: 'food_not_found',
        message: '该食物暂未收录,我们会尽快补充。'
      };
    }
    return { ok: true, data: result };
  });
}
