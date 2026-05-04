/**
 * 同意 / 撤回流程的类型定义
 *
 * scope 5 个值对应 schema.sql privacy_consents.scope CHECK,以及《个保法》第 28 条敏感个人信息子类
 */

export const CONSENT_SCOPES = [
  'health_data',
  'medical_report',
  'photo_ai',
  'location',
  'subscribe_push'
] as const;

export type ConsentScope = (typeof CONSENT_SCOPES)[number];

/**
 * 当前 consent_version_required:
 *   - v1 上线初始 = 1
 *   - 隐私政策变更时升版,触发存量用户重新同意(plan U3 / Round 2 review 修订)
 *
 * 升版时:增加新版本号,旧 grant 在 onLaunch/onShow 比对失败 → 强制跳转同意页
 */
export const CURRENT_CONSENT_VERSION_REQUIRED = 1;

/** 默认 hard-delete 保留期 = 30 天(plan U3) */
export const HARD_DELETE_RETENTION_DAYS = 30;

export interface RecordConsentParams {
  userId: string;
  scopes: ConsentScope[]; // 用户在同一次同意页勾选的全部 scope
  consentVersion: number;
  userAgent?: string;
  clientIpHash?: string;
}

export interface ConsentStatus {
  required: number;
  granted: number;
  needsReconsent: boolean; // granted < required
}
