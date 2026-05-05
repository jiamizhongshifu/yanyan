/**
 * Home / progress 客户端服务
 */

import { request } from './api';
import { getCurrentAccessToken } from './auth';
import type { FireLevel } from './symptoms';

export interface TodayMealItem {
  id: string;
  ateAt: string;
  photoOssKey: string | null;
  fireScore: number | null;
  sugarGrams: number | null;
  level: FireLevel | null;
  tcmLabelsSummary: { 发: number; 温和: number; 平: number; unknown: number };
}

export interface HomeToday {
  date: string;
  meals: TodayMealItem[];
}

export interface UserProgress {
  cumulativeCheckinDays: number;
  thresholds: { trendLineDays: number; profilePdfDay: number };
  flags: { canDrawTrend: boolean; eligibleForProfilePdf: boolean };
}

async function authHeader() {
  const t = await getCurrentAccessToken();
  return t ? { authToken: t } : null;
}

export async function fetchHomeToday(): Promise<HomeToday | null> {
  const auth = await authHeader();
  if (!auth) return null;
  const res = await request<{ ok: true } & HomeToday>({ url: '/home/today', ...auth });
  if (!res.ok) return null;
  return { date: res.data.date, meals: res.data.meals };
}

export async function fetchProgress(): Promise<UserProgress | null> {
  const auth = await authHeader();
  if (!auth) return null;
  const res = await request<{ ok: true } & UserProgress>({ url: '/users/me/progress', ...auth });
  if (!res.ok) return null;
  return {
    cumulativeCheckinDays: res.data.cumulativeCheckinDays,
    thresholds: res.data.thresholds,
    flags: res.data.flags
  };
}
