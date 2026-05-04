/**
 * 埋点事件类型 (plan U12)
 *
 * 关键事件白名单 — 非白名单事件名拒收,防客户端污染表。
 */

export const EVENT_NAMES = [
  'onboarding_step_complete',
  'photo_uploaded',
  'meal_recognized',
  'checkin_step1_complete',
  'checkin_step2_view',
  'score_revealed',
  'tab_findings_visit',
  'tab_home_visit',
  'push_subscribed',
  'push_unsubscribed'
] as const;

export type EventName = (typeof EVENT_NAMES)[number];

export interface EventInput {
  eventName: EventName;
  payload?: Record<string, unknown>;
  /** 客户端发生时间 ISO,服务端入库会记 occurred_at(以服务端为准但保留客户端时间在 payload 里) */
  clientOccurredAt?: string;
}

export interface DashboardSummary {
  /** 当前活跃用户(过去 7 天有任意事件) */
  wau: number;
  /** 当日活跃用户 */
  dau: number;
  /** 次晨打卡完成率(过去 7 天:checkin_step1_complete 用户数 / 至少有一餐 photo_uploaded 的用户数) */
  morningCheckinRate: number;
  /** Onboarding 反向定位:主要目标 = 减肥 占比(过去 30 天) */
  weightLossTargetRate: number;
  /** WAR — Weekly Active Returning(连续 ≥ 2 周活跃比例),v1 简化定义见 src/services/analytics/index.ts */
  warRate: number;
  /** 整体事件总数(用于 sanity check) */
  totalEvents: number;
}
