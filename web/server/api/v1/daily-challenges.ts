/**
 * /api/v1/users/me/challenges/today  POST  upsert 当日快照
 * /api/v1/users/me/challenges/month  GET   ?year=&month= 拉本月所有快照 + tier 计数
 */

import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { requireUser } from '../../auth';
import {
  PgDailyChallengeStore,
  aggregateMonth,
  type DailyChallengeStore,
  type DayTier,
  type FireLevel
} from '../../services/daily-challenges';

const FIRE_LEVELS: FireLevel[] = ['平', '微火', '中火', '大火'];
const TIERS: DayTier[] = ['perfect', 'great', 'nice', 'none'];

const UpsertBody = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  tier: z.enum(['perfect', 'great', 'nice', 'none']),
  completedCount: z.number().int().min(0).max(20),
  completedKeys: z.array(z.string().min(1).max(64)).max(20),
  fireLevel: z.enum(['平', '微火', '中火', '大火']).nullable().optional()
});

const MonthQuery = z.object({
  year: z.coerce.number().int().min(2000).max(3000).optional(),
  month: z.coerce.number().int().min(1).max(12).optional()
});

export interface RegisterDailyChallengesOptions {
  deps?: {
    store?: DailyChallengeStore;
    now?: () => Date;
  };
}

export async function registerDailyChallengesRoutes(
  app: FastifyInstance,
  opts: RegisterDailyChallengesOptions = {}
): Promise<void> {
  const store = opts.deps?.store ?? new PgDailyChallengeStore();
  const now = opts.deps?.now ?? (() => new Date());

  app.post('/users/me/challenges/today', async (req, reply) => {
    const user = requireUser(req, reply);
    if (!user) return;
    const parsed = UpsertBody.safeParse(req.body);
    if (!parsed.success) {
      reply.code(400);
      return { ok: false, error: 'invalid_body', issues: parsed.error.issues };
    }
    void TIERS;
    void FIRE_LEVELS;
    await store.upsert({
      userId: user.userId,
      date: parsed.data.date,
      tier: parsed.data.tier,
      completedCount: parsed.data.completedCount,
      completedKeys: parsed.data.completedKeys,
      fireLevel: parsed.data.fireLevel ?? null
    });
    return { ok: true };
  });

  app.get('/users/me/challenges/month', async (req, reply) => {
    const user = requireUser(req, reply);
    if (!user) return;
    const parsed = MonthQuery.safeParse(req.query);
    if (!parsed.success) {
      reply.code(400);
      return { ok: false, error: 'invalid_query' };
    }
    const today = now();
    const year = parsed.data.year ?? today.getFullYear();
    const month = parsed.data.month ?? today.getMonth() + 1;
    const rows = await store.listMonth(user.userId, year, month);
    const agg = aggregateMonth(rows);
    return { ok: true, year, month, ...agg };
  });
}
