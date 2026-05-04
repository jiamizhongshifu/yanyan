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
import { sendFeishuAlert } from '../../services/alerting/feishu';
import { getCostSnapshot } from '../../services/llm/cost-monitor';

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
    const weightLossExceedsThreshold = shouldAlertWeightLoss(summary);
    if (weightLossExceedsThreshold) {
      // fire-and-forget(失败不阻塞 dashboard 返回)
      void sendFeishuAlert({
        level: 'warning',
        title: '反向定位告警:减肥目标占比 > 30%',
        body: `近 30 天 onboarding 反向定位中减肥占比 ${(summary.weightLossTargetRate * 100).toFixed(1)}%(阈值 30%)。投放素材可能漂到错误人群,需 review。`,
        context: { wau: summary.wau, dau: summary.dau }
      });
    }
    const cost = getCostSnapshot();
    return {
      ok: true,
      summary,
      llmCost: {
        dailyUsd: cost.dailyCostUsd,
        monthlyUsd: cost.monthlyCostUsd,
        dailyBudgetUsd: cost.dailyBudgetUsd,
        monthlyBudgetUsd: cost.monthlyBudgetUsd
      },
      alerts: {
        weightLossExceedsThreshold,
        llmBudgetDegraded: cost.shouldDegrade
      }
    };
  });
}
