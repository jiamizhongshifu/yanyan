/**
 * Onboarding 客户端服务
 *
 * Post-pivot:wx.login 流程消失。Supabase Auth 直接管 login,
 * onboarding 第三屏提交时:
 *   1. ensureUser  确保 public.users 行存在
 *   2. postConsent 写 5 个 scope
 *   3. postBaseline 写 7 维度症状频次 + 反向定位选项 → 返回 initialFireLevel
 */

import { request } from './api';
import { getCurrentAccessToken } from './auth';

export const SYMPTOM_DIMENSIONS = [
  'nasal_congestion',
  'acne',
  'dry_mouth',
  'bowel',
  'fatigue',
  'edema',
  'throat_itch'
] as const;
export type SymptomDimension = (typeof SYMPTOM_DIMENSIONS)[number];

export const SYMPTOM_FREQUENCY = ['rare', 'sometimes', 'often'] as const;
export type SymptomFrequency = (typeof SYMPTOM_FREQUENCY)[number];

export const REVERSE_FILTER_CHOICES = [
  'rhinitis',
  'blood_sugar',
  'uric_acid',
  'checkup_abnormal',
  'curious'
] as const;
export type ReverseFilterChoice = (typeof REVERSE_FILTER_CHOICES)[number];

export type FireLevel = '平' | '微火' | '中火' | '大火';

async function withAuth(): Promise<{ authToken: string } | null> {
  const token = await getCurrentAccessToken();
  return token ? { authToken: token } : null;
}

/** 确保 public.users 行存在(post-Supabase Auth 创建后第一步) */
export async function ensureUser(): Promise<{ ok: boolean; wasCreated?: boolean }> {
  const auth = await withAuth();
  if (!auth) return { ok: false };
  const res = await request<{ ok: true; userId: string; wasCreated: boolean }>({
    url: '/users/me/ensure',
    method: 'POST',
    ...auth
  });
  if (!res.ok) return { ok: false };
  return { ok: true, wasCreated: res.data.wasCreated };
}

export async function postBaseline(
  reverseFilterChoice: ReverseFilterChoice,
  symptomsFrequency: Partial<Record<SymptomDimension, SymptomFrequency>>
): Promise<{ initialFireLevel: FireLevel } | null> {
  const auth = await withAuth();
  if (!auth) return null;
  const res = await request<{ ok: true; initialFireLevel: FireLevel }>({
    url: '/users/me/baseline',
    method: 'POST',
    ...auth,
    data: { reverseFilterChoice, symptomsFrequency }
  });
  if (!res.ok) return null;
  return { initialFireLevel: res.data.initialFireLevel };
}

/** 客户端本地启发式 — 网络等待时秒显"看起来你近期偏 X" */
export function localEstimateFireLevel(
  symptomsFrequency: Partial<Record<SymptomDimension, SymptomFrequency>>
): FireLevel {
  const w: Record<SymptomFrequency, number> = { rare: 0, sometimes: 1, often: 2 };
  let total = 0;
  let count = 0;
  for (const v of Object.values(symptomsFrequency)) {
    if (v) {
      total += w[v];
      count++;
    }
  }
  const ratio = count > 0 ? total / (count * 2) : 0;
  if (ratio <= 0.15) return '平';
  if (ratio <= 0.40) return '微火';
  if (ratio <= 0.65) return '中火';
  return '大火';
}
