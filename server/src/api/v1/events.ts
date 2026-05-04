/**
 * /api/v1/events 路由 (plan U12)
 *
 * POST /events             — 批量埋点上报(认证后用户)+ user_id 入库
 * GET  /events/dashboard   — 仪表盘核心指标(WAU/DAU/次晨打卡率/减肥目标率/WAR)
 *
 * 客户端断网时本地缓存 → 网络恢复批量上传(浏览器队列在 web/services/tracker.ts)。
 */

import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { requireUser } from '../../auth';
import {
  buildDashboardSummary,
  EVENT_NAMES,
  ingestEvents,
  PgAnalyticsStore,
  shouldAlertWeightLoss,
  type AnalyticsStore
} from '../../services/analytics';

const EventSchema = z.object({
  eventName: z.enum(EVENT_NAMES),
  payload: z.record(z.unknown()).optional(),
  clientOccurredAt: z.string().optional()
});

const BatchBody = z.object({
  events: z.array(EventSchema).min(1).max(100)
});

export interface RegisterEventsOptions {
  deps?: {
    store?: AnalyticsStore;
    now?: () => Date;
  };
}

export async function registerEventsRoutes(app: FastifyInstance, opts: RegisterEventsOptions = {}): Promise<void> {
  const store = opts.deps?.store ?? new PgAnalyticsStore();
  const now = opts.deps?.now ?? (() => new Date());

  app.post('/events', async (req, reply) => {
    const user = requireUser(req, reply);
    if (!user) return;
    const parsed = BatchBody.safeParse(req.body);
    if (!parsed.success) {
      reply.code(400);
      return { ok: false, error: 'invalid_body', issues: parsed.error.issues };
    }
    const result = await ingestEvents(store, user.userId, parsed.data.events);
    return { ok: true, ...result };
  });

  app.get('/events/dashboard', async (req, reply) => {
    const user = requireUser(req, reply);
    if (!user) return;
    const summary = await buildDashboardSummary(store, now());
    return {
      ok: true,
      summary,
      alerts: {
        weightLossExceedsThreshold: shouldAlertWeightLoss(summary)
      }
    };
  });
}
