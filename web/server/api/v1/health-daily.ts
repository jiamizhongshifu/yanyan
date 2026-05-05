/**
 * /api/v1/users/me/health/*  — 步数 / 静息心率
 *
 * 三个数据来源:
 *   - source='shortcut':iOS 快捷指令(用户配的,每日推送)
 *   - source='manual'  :用户在 Today 页手动录入
 *   - source='import'  :未来 Apple Health export.zip 解析(留接口)
 */

import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { requireUser } from '../../auth';
import { PgHealthStore, type HealthStore } from '../../services/health';

const UpsertBody = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  steps: z.number().int().min(0).max(200000).optional(),
  restingHr: z.number().int().min(20).max(220).optional(),
  source: z.enum(['shortcut', 'manual', 'import']).optional()
});

const TodayQuery = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional()
});

export interface RegisterHealthDailyOptions {
  deps?: {
    store?: HealthStore;
    now?: () => Date;
  };
}

function todayDateString(now: Date): string {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

export async function registerHealthDailyRoutes(app: FastifyInstance, opts: RegisterHealthDailyOptions = {}): Promise<void> {
  const store = opts.deps?.store ?? new PgHealthStore();
  const now = opts.deps?.now ?? (() => new Date());

  app.post('/users/me/health/steps', async (req, reply) => {
    const user = requireUser(req, reply);
    if (!user) return;
    const parsed = UpsertBody.safeParse(req.body);
    if (!parsed.success) {
      reply.code(400);
      return { ok: false, error: 'invalid_body', issues: parsed.error.issues };
    }
    if (parsed.data.steps === undefined && parsed.data.restingHr === undefined) {
      reply.code(400);
      return { ok: false, error: 'no_metric', message: 'steps 或 restingHr 至少一项' };
    }
    await store.upsert({
      userId: user.userId,
      date: parsed.data.date,
      steps: parsed.data.steps ?? null,
      restingHr: parsed.data.restingHr ?? null,
      source: parsed.data.source ?? 'manual'
    });
    return { ok: true };
  });

  app.get('/users/me/health/today', async (req, reply) => {
    const user = requireUser(req, reply);
    if (!user) return;
    const parsed = TodayQuery.safeParse(req.query);
    const date = parsed.success && parsed.data.date ? parsed.data.date : todayDateString(now());
    const row = await store.findByDate(user.userId, date);
    return { ok: true, date, ...(row ?? { steps: null, restingHr: null, source: null, updatedAt: null }) };
  });
}
