/**
 * 每日挑战历史 — 客户端服务
 *
 * upsertToday():每次挑战值变化时(节流)调一次,server 按 (user, date) 唯一覆盖。
 * fetchMonth():洞悉页拉本月挑战快照 → tier 计数 + 月历着色源数据。
 */
import { request } from './api';
import { getCurrentAccessToken } from './auth';
import type { DayTier } from './challenges';
import type { FireLevel } from './symptoms';

export interface DailyChallengeSnapshot {
  date: string;
  tier: DayTier;
  completedCount: number;
  completedKeys: string[];
  fireLevel: FireLevel | null;
  updatedAt: string;
}

export interface MonthChallenges {
  year: number;
  month: number;
  perfect: number;
  great: number;
  nice: number;
  none: number;
  days: DailyChallengeSnapshot[];
}

async function withAuth() {
  const t = await getCurrentAccessToken();
  return t ? { authToken: t } : null;
}

export async function upsertTodayChallenges(payload: {
  date: string;
  tier: DayTier;
  completedCount: number;
  completedKeys: string[];
  fireLevel: FireLevel | null;
}): Promise<boolean> {
  const auth = await withAuth();
  if (!auth) return false;
  const res = await request<{ ok: true }>({
    url: '/users/me/challenges/today',
    method: 'POST',
    ...auth,
    data: payload
  });
  return res.ok;
}

export async function fetchMonthChallenges(year?: number, month?: number): Promise<MonthChallenges | null> {
  const auth = await withAuth();
  if (!auth) return null;
  const qs = year && month ? `?year=${year}&month=${month}` : '';
  const res = await request<{ ok: true } & MonthChallenges>({
    url: `/users/me/challenges/month${qs}`,
    ...auth
  });
  if (!res.ok) return null;
  return {
    year: res.data.year,
    month: res.data.month,
    perfect: res.data.perfect,
    great: res.data.great,
    nice: res.data.nice,
    none: res.data.none,
    days: res.data.days
  };
}
