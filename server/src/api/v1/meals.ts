/**
 * /api/v1/meals 路由
 *
 * POST /meals               { storageKey, ateAt? } → 触发识别 + 入库 + 返回结果
 * POST /meals/:id/feedback  { itemName, kind } → 误识别 / 反例 入队
 */

import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { withClient } from '../../db/client';
import { requireUser } from '../../auth';
import {
  PgFoodClassifierStore,
  type FoodClassifierStore
} from '../../services/classifier';
import {
  appendMealFeedback,
  createMeal,
  PgMealStore,
  type MealStore
} from '../../services/meals';
import {
  HedgedFoodRecognizer,
  DevLlmFoodRecognizer,
  type LlmFoodRecognizer
} from '../../services/recognition';
import { buildQwenVisionFromEnv } from '../../services/llm/qwen-vision';

const CreateMealBody = z.object({
  storageKey: z.string().min(1),
  ateAt: z.string().datetime().optional()
});

const FeedbackBody = z.object({
  itemName: z.string().min(1),
  kind: z.enum(['misrecognized', 'no_reaction'])
});

export interface RegisterMealsOptions {
  deps?: {
    mealStore?: MealStore;
    classifierStore?: FoodClassifierStore;
    recognizer?: LlmFoodRecognizer;
    onMissingFood?: (name: string) => void;
    /** 测试时注入,用 userId → DEK 密文(模拟 users.dek_ciphertext_b64 取值) */
    getUserDek?: (userId: string) => Promise<string | null>;
  };
}

function buildDefaultRecognizer(): LlmFoodRecognizer {
  const qwen = buildQwenVisionFromEnv();
  if (qwen) {
    // hedged 包住,即使 Qwen 失败也走 dev fixture(Beta 期 robustness;DEV fixture key 命中即兜底)
    return new HedgedFoodRecognizer([qwen, new DevLlmFoodRecognizer()]);
  }
  return new HedgedFoodRecognizer([new DevLlmFoodRecognizer()]);
}

async function defaultGetUserDek(userId: string): Promise<string | null> {
  return await withClient(async (client) => {
    const r = await client.query<{ dek_ciphertext_b64: string }>(
      `SELECT dek_ciphertext_b64 FROM users WHERE id = $1 AND deleted_at IS NULL`,
      [userId]
    );
    if (r.rowCount === 0) return null;
    return r.rows[0].dek_ciphertext_b64;
  });
}

export async function registerMealsRoutes(app: FastifyInstance, opts: RegisterMealsOptions = {}): Promise<void> {
  const mealStore = opts.deps?.mealStore ?? new PgMealStore();
  const classifierStore = opts.deps?.classifierStore ?? new PgFoodClassifierStore();
  // 默认 recognizer:有 DASHSCOPE_API_KEY 就用 Qwen-VL,否则 fallback Dev fixture
  const recognizer =
    opts.deps?.recognizer ?? buildDefaultRecognizer();
  const onMissingFood = opts.deps?.onMissingFood;
  const getUserDek = opts.deps?.getUserDek ?? defaultGetUserDek;

  app.post('/meals', async (req, reply) => {
    const user = requireUser(req, reply);
    if (!user) return;
    const parsed = CreateMealBody.safeParse(req.body);
    if (!parsed.success) {
      reply.code(400);
      return { ok: false, error: 'invalid_body', issues: parsed.error.issues };
    }
    const dekCiphertextB64 = await getUserDek(user.userId);
    if (!dekCiphertextB64) {
      reply.code(403);
      return { ok: false, error: 'user_not_initialized', message: '用户未初始化,请重新登录或完成 onboarding' };
    }

    let outcome;
    try {
      outcome = await createMeal(
        { mealStore, classifierStore, recognizer, onMissingFood },
        {
          userId: user.userId,
          userDekCiphertextB64: dekCiphertextB64,
          storageKey: parsed.data.storageKey,
          ateAt: parsed.data.ateAt ? new Date(parsed.data.ateAt) : undefined
        }
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : 'unknown';
      if (message.includes('storageKey 必须以')) {
        reply.code(403);
        return { ok: false, error: 'forbidden_storage_key', message };
      }
      throw err;
    }

    if (outcome.kind === 'recognition_failed') {
      reply.code(503);
      return { ok: false, error: 'recognition_failed', message: '识别忙,稍后再试' };
    }
    if (outcome.kind === 'low_confidence') {
      reply.code(422);
      return {
        ok: false,
        error: 'low_confidence',
        message: '看不太清,要不要补一张?',
        overallConfidence: outcome.overallConfidence
      };
    }
    return { ok: true, ...outcome.result };
  });

  app.post<{ Params: { id: string } }>('/meals/:id/feedback', async (req, reply) => {
    const user = requireUser(req, reply);
    if (!user) return;
    const parsed = FeedbackBody.safeParse(req.body);
    if (!parsed.success) {
      reply.code(400);
      return { ok: false, error: 'invalid_body', issues: parsed.error.issues };
    }
    const entry = await appendMealFeedback(
      { mealStore, classifierStore, recognizer, onMissingFood },
      {
        userId: user.userId,
        mealId: req.params.id,
        itemName: parsed.data.itemName,
        kind: parsed.data.kind
      }
    );
    return { ok: true, entry };
  });
}
