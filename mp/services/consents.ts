/**
 * 客户端 consents 服务
 *
 * 与后端 /api/v1/consents 系列端点通信。
 * 鉴权 token 接入留待后续 unit;v1 通过 X-User-Id header 占位(从 globalData 读)。
 */

import { request } from './api';

export const CONSENT_SCOPES = [
  'health_data',
  'medical_report',
  'photo_ai',
  'location',
  'subscribe_push'
] as const;

export type ConsentScope = (typeof CONSENT_SCOPES)[number];

interface RequiredVersionResponse {
  ok: true;
  consentVersionRequired: number;
}

interface ConsentStatusResponse {
  ok: true;
  required: number;
  granted: number;
  needsReconsent: boolean;
}

export interface ConsentStatus {
  required: number;
  granted: number;
  needsReconsent: boolean;
}

function buildHeader(userId: string | null): Record<string, string> {
  return userId ? { 'X-User-Id': userId } : {};
}

export async function fetchRequiredVersion(): Promise<number | null> {
  const res = await request<RequiredVersionResponse>({ url: '/consents/required' });
  if (!res.ok) return null;
  return res.data.consentVersionRequired;
}

export async function fetchUserConsentStatus(userId: string): Promise<ConsentStatus | null> {
  const res = await request<ConsentStatusResponse>({
    url: '/users/me/consent',
    header: buildHeader(userId)
  });
  if (!res.ok) return null;
  return { required: res.data.required, granted: res.data.granted, needsReconsent: res.data.needsReconsent };
}

export async function postConsent(userId: string, scopes: ConsentScope[], consentVersion: number): Promise<boolean> {
  const res = await request({
    url: '/consents',
    method: 'POST',
    header: buildHeader(userId),
    data: { scopes, consentVersion }
  });
  return res.ok;
}

export async function postRevoke(userId: string): Promise<boolean> {
  const res = await request({
    url: '/consents/revoke',
    method: 'POST',
    header: buildHeader(userId)
  });
  return res.ok;
}

/**
 * 启动检查:granted < required 即需重新同意 — 用于 app.ts onLaunch / onShow 拦截
 *
 * 任一网络失败 → 返回 null,调用方决定是否放过(v1:网络失败时不强拦截,但 30 秒内会重试)
 */
export async function evaluateConsentNeed(userId: string | null): Promise<ConsentStatus | null> {
  if (!userId) return null;
  return await fetchUserConsentStatus(userId);
}
