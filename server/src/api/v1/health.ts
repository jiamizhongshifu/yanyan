/**
 * /health 路由
 *
 * - GET /health      → 进程存活探针,不查 DB(Kubernetes liveness 用)
 * - GET /health/db   → 强制 DB ping(Kubernetes readiness 用)
 */

import type { FastifyInstance } from 'fastify';
import { pingDb } from '../../db/client';

export async function registerHealthRoutes(app: FastifyInstance): Promise<void> {
  app.get('/health', async () => {
    return { ok: true, service: 'yanyan-server', version: '0.0.1' };
  });

  app.get('/health/db', async (_req, reply) => {
    const result = await pingDb();
    if (!result.ok) {
      reply.code(503);
      return { ok: false, error: result.error ?? 'db_unreachable' };
    }
    return { ok: true, latencyMs: result.latencyMs };
  });
}
