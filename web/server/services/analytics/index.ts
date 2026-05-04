/**
 * Analytics service (plan U12)
 *
 * 仪表盘 v1 关键面板 — 直接 SQL 聚合,无需独立 OLAP:
 *   - WAU / DAU
 *   - 次晨打卡完成率 = 过去 7 天 checkin_step1_complete distinct users / photo_uploaded distinct users
 *   - 减肥目标占比 = 过去 30 天 onboarding_step_complete 中 payload.primaryGoal='weight_loss' / 总数
 *   - WAR(Weekly Active Returning)v1 简化:过去 14 天活跃用户 / 过去 7 天活跃用户(>1.0 表示有人回访)
 *
 * 减肥占比 > 30% 在路由层判断后触发 webhook 告警(告警 sender 占位,Phase 2 接入 Slack/邮件)。
 */

export type { EventName, EventInput, DashboardSummary } from './types';
export { EVENT_NAMES } from './types';
export { PgAnalyticsStore } from './store';
export type { AnalyticsStore } from './store';

import type { AnalyticsStore } from './store';
import type { DashboardSummary, EventInput } from './types';
import { EVENT_NAMES } from './types';

/** 校验事件名白名单;返回过滤后的有效事件 */
export function filterValidEvents(events: EventInput[]): EventInput[] {
  const set = new Set<string>(EVENT_NAMES);
  return events.filter((e) => typeof e.eventName === 'string' && set.has(e.eventName));
}

export async function ingestEvents(
  store: AnalyticsStore,
  userId: string | null,
  events: EventInput[]
): Promise<{ accepted: number; rejected: number }> {
  const valid = filterValidEvents(events);
  const accepted = await store.insertBatch(userId, valid);
  return { accepted, rejected: events.length - valid.length };
}

export async function buildDashboardSummary(store: AnalyticsStore, today: Date = new Date()): Promise<DashboardSummary> {
  const dateStr = today.toISOString().slice(0, 10);
  const [wau, dau, last14, photoUploaders, checkinUsers, onboardingTotal, weightLossCount, totalEvents] =
    await Promise.all([
      store.countActiveUsers(7),
      store.countDauForDate(dateStr),
      store.countActiveUsers(14),
      store.countDistinctUsersForEvent('photo_uploaded', 7),
      store.countDistinctUsersForEvent('checkin_step1_complete', 7),
      store.countDistinctUsersForEvent('onboarding_step_complete', 30),
      store.countEventsWithPayload('onboarding_step_complete', 'primaryGoal', 'weight_loss', 30),
      store.countAll()
    ]);

  const morningCheckinRate = photoUploaders === 0 ? 0 : Math.round((checkinUsers / photoUploaders) * 1000) / 1000;
  const weightLossTargetRate = onboardingTotal === 0
    ? 0
    : Math.round((weightLossCount / onboardingTotal) * 1000) / 1000;
  // WAR 简化定义:14 天活跃中,有多少不在过去 7 天 → 反向估算返回比
  // returning = (last14 - wau) / last14;若 last14=0 则 0
  const warRate = last14 === 0 ? 0 : Math.round(((last14 - wau) / last14) * 1000) / 1000;

  return {
    wau,
    dau,
    morningCheckinRate,
    weightLossTargetRate,
    warRate,
    totalEvents
  };
}

/** 减肥占比超阈值告警判断(纯函数,UI / cron 复用) */
export const WEIGHT_LOSS_ALERT_THRESHOLD = 0.3;
export function shouldAlertWeightLoss(summary: DashboardSummary): boolean {
  return summary.weightLossTargetRate > WEIGHT_LOSS_ALERT_THRESHOLD;
}
