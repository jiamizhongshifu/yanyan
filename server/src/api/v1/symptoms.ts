/**
 * /api/v1/symptoms 路由
 *
 * POST /symptoms/checkin              { recordedForDate?, payload }   — Step 1 盲打卡提交
 * GET  /symptoms/yesterday/compare    ?today=YYYY-MM-DD               — Step 2 对照展示用,返回昨日完整 payload
 *
 * Step 1 写入,客户端在 Step 2 才调 GET — 严格区分,防客户端意外早调污染数据。
 */

import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { withClient } from '../../db/client';
import { requireUser } from '../../auth';
import {
  PgSymptomStore,
  submitMorningCheckin,
  getYesterdayForCompare,
  todayDateString,
  SYMPTOM_DIMENSIONS,
  type SymptomStore
} from '../../services/symptoms';

// 单维度 entry — 客户端可能传 engaged + severity null(用户勾了没滑)
const DimensionEntrySchema = z.object({
  engaged: z.boolean(),
  severity: z.number().int().min(1).max(7).nullable()
});

const PayloadSchema = z.record(z.enum(SYMPTOM_DIMENSIONS), DimensionEntrySchema);

const CheckinBody = z.object({
  recordedForDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  payload: PayloadSchema
});

const YesterdayQuery = z.object({
  today: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional()
});

export interface RegisterSymptomsOptions {
  deps?: {
    store?: SymptomStore;
    getUserDek?: (userId: string) => Promise<string | null>;
  };
}

async function defaultGetUserDek(userId: string): Promise<string | null> {
  return await withClient(async (c) => {
    const r = await c.query<{ dek_ciphertext_b64: string }>(
      `SELECT dek_ciphertext_b64 FROM users WHERE id = $1 AND deleted_at IS NULL`,
      [userId]
    );
    return r.rowCount === 0 ? null : r.rows[0].dek_ciphertext_b64;
  });
}

export async function registerSymptomsRoutes(app: FastifyInstance, opts: RegisterSymptomsOptions = {}): Promise<void> {
  const store = opts.deps?.store ?? new PgSymptomStore();
  const getUserDek = opts.deps?.getUserDek ?? defaultGetUserDek;
  const deps = { store, getUserDek };

  app.post('/symptoms/checkin', async (req, reply) => {
    const user = requireUser(req, reply);
    if (!user) return;
    const parsed = CheckinBody.safeParse(req.body);
    if (!parsed.success) {
      reply.code(400);
      return { ok: false, error: 'invalid_body', issues: parsed.error.issues };
    }
    try {
      const date = parsed.data.recordedForDate ?? todayDateString();
      const id = await submitMorningCheckin(deps, {
        userId: user.userId,
        recordedForDate: date,
        payload: parsed.data.payload,
        source: 'next_morning'
      });
      return { ok: true, id, recordedForDate: date };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'unknown';
      if (message === 'user_not_initialized') {
        reply.code(403);
        return { ok: false, error: 'user_not_initialized' };
      }
      throw err;
    }
  });

  app.get('/symptoms/yesterday/compare', async (req, reply) => {
    const user = requireUser(req, reply);
    if (!user) return;
    const parsed = YesterdayQuery.safeParse(req.query);
    if (!parsed.success) {
      reply.code(400);
      return { ok: false, error: 'invalid_query', issues: parsed.error.issues };
    }
    const today = parsed.data.today ?? todayDateString();
    const result = await getYesterdayForCompare(deps, user.userId, today);
    if (!result) {
      // 没昨日数据:Day 1 用户场景 — UI 显示"今天是第一次,无昨日对照"
      return { ok: true, hasYesterday: false };
    }
    return { ok: true, hasYesterday: true, ...result };
  });
}
