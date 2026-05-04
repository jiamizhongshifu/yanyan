/**
 * Onboarding 客户端服务
 *
 * - login(code): 调 POST /users 登录或创建,返回 userId 写到 globalData
 * - postBaseline(userId, baseline): 调 POST /users/me/baseline,返回 initialFireLevel
 * - 跨 step 状态持久化:globalData.onboardingState
 */

import { request } from './api';

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

export interface OnboardingState {
  reverseFilterChoice: ReverseFilterChoice | null;
  symptomsFrequency: Partial<Record<SymptomDimension, SymptomFrequency>>;
  initialFireLevel: '平' | '微火' | '中火' | '大火' | null;
}

export function freshOnboardingState(): OnboardingState {
  return {
    reverseFilterChoice: null,
    symptomsFrequency: {},
    initialFireLevel: null
  };
}

export async function login(code: string): Promise<string | null> {
  const res = await request<{ ok: true; userId: string; isNew: boolean }>({
    url: '/users',
    method: 'POST',
    data: { code }
  });
  if (!res.ok) return null;
  return res.data.userId;
}

export async function postBaseline(
  userId: string,
  reverseFilterChoice: ReverseFilterChoice,
  symptomsFrequency: Partial<Record<SymptomDimension, SymptomFrequency>>
): Promise<{ initialFireLevel: '平' | '微火' | '中火' | '大火' } | null> {
  const res = await request<{ ok: true; initialFireLevel: '平' | '微火' | '中火' | '大火' }>({
    url: '/users/me/baseline',
    method: 'POST',
    header: { 'X-User-Id': userId },
    data: { reverseFilterChoice, symptomsFrequency }
  });
  if (!res.ok) return null;
  return { initialFireLevel: res.data.initialFireLevel };
}
