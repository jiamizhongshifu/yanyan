/**
 * Consents 客户端服务 — 与 server /api/v1 系列 consents 端点通信
 *
 * 鉴权:每次请求自动从 Supabase 拿当前 JWT 加 Authorization Bearer header
 * 失败:任何网络/鉴权失败都返回 user-friendly fallback,不暴露原始错误
 */

import { request } from './api';
import { getCurrentAccessToken } from './auth';

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

async function withAuth(): Promise<{ authToken: string } | null> {
  const token = await getCurrentAccessToken();
  if (!token) return null;
  return { authToken: token };
}

export async function fetchRequiredVersion(): Promise<number | null> {
  const res = await request<RequiredVersionResponse>({ url: '/consents/required' });
  if (!res.ok) return null;
  return res.data.consentVersionRequired;
}

export async function fetchUserConsentStatus(): Promise<ConsentStatus | null> {
  const auth = await withAuth();
  if (!auth) return null;
  const res = await request<ConsentStatusResponse>({
    url: '/users/me/consent',
    ...auth
  });
  if (!res.ok) return null;
  return { required: res.data.required, granted: res.data.granted, needsReconsent: res.data.needsReconsent };
}

export async function postConsent(scopes: ConsentScope[], consentVersion: number): Promise<boolean> {
  const auth = await withAuth();
  if (!auth) return false;
  const res = await request({
    url: '/consents',
    method: 'POST',
    ...auth,
    data: { scopes, consentVersion }
  });
  return res.ok;
}

export async function postRevoke(): Promise<boolean> {
  const auth = await withAuth();
  if (!auth) return false;
  const res = await request({
    url: '/consents/revoke',
    method: 'POST',
    ...auth
  });
  return res.ok;
}
