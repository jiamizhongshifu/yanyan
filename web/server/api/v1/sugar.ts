/**
 * /api/v1/users/me/sugar/today — 今日糖摄入 + baseline + 减糖等价勋章
 */

import type { FastifyInstance } from 'fastify';
import { requireUser } from '../../auth';
import { PgSugarStore, computeSugarToday, type SugarStore } from '../../services/sugar';

export interface RegisterSugarOptions {
  deps?: {
    store?: SugarStore;
    now?: () => Date;
  };
}

export async function registerSugarRoutes(app: FastifyInstance, opts: RegisterSugarOptions = {}): Promise<void> {
  const store = opts.deps?.store ?? new PgSugarStore();
  const now = opts.deps?.now;

  app.get('/users/me/sugar/today', async (req, reply) => {
    const user = requireUser(req, reply);
    if (!user) return;
    const result = await computeSugarToday({ store, now }, user.userId);
    return { ok: true, ...result };
  });
}
