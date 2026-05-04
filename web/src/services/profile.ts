/**
 * 30 天体质档案 v0.5 客户端 (plan U13b)
 */

import { request } from './api';
import { getCurrentAccessToken } from './auth';

interface Citation {
  source: 'canon' | 'paper' | 'modern_nutrition';
  reference: string;
  excerpt?: string;
}

export interface DailyFirePoint {
  date: string;
  avgFireScore: number | null;
  mealCount: number;
}

export interface FaCounts {
  faTotal: number;
  mildTotal: number;
  calmTotal: number;
  unknownTotal: number;
}

export interface CommonFaFood {
  name: string;
  citations: Citation[];
}

export interface ProfileV05Data {
  cumulativeCheckinDays: number;
  title: string;
  generatedAt: string;
  dailyTrend: DailyFirePoint[];
  faCounts: FaCounts;
  commonFaFoods: CommonFaFood[];
  checkupSummary: null;
  disclaimers: string[];
}

export type FetchProfileResult =
  | { kind: 'ok'; data: ProfileV05Data }
  | { kind: 'not_eligible'; cumulativeCheckinDays: number; required: number }
  | { kind: 'error'; message: string };

interface ApiOk { ok: true; data: ProfileV05Data }
interface ApiNotEligible { ok: false; reason: 'not_eligible'; cumulativeCheckinDays: number; required: number }

export async function fetchProfileV05(): Promise<FetchProfileResult> {
  const t = await getCurrentAccessToken();
  if (!t) return { kind: 'error', message: '未登录' };
  const res = await request<ApiOk | ApiNotEligible>({ url: '/profile/v05', authToken: t });
  if (!res.ok) return { kind: 'error', message: res.fallbackMessage };
  if (res.data.ok === true) return { kind: 'ok', data: res.data.data };
  return {
    kind: 'not_eligible',
    cumulativeCheckinDays: res.data.cumulativeCheckinDays,
    required: res.data.required
  };
}
