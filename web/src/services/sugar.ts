/**
 * 糖分量化客户端服务
 */
import { request } from './api';
import { getCurrentAccessToken } from './auth';

export interface SugarBadge {
  kind: 'lollipop' | 'chocolate' | 'cola' | 'milktea';
  emoji: string;
  label: string;
  gramsEach: number;
  count: number;
}

export interface SugarToday {
  todayGrams: number | null;
  sevenDayAvg: number | null;
  baselineDailyG: number;
  todaySavedG: number;
  monthSavedG: number;
  monthlyBadges: SugarBadge[];
}

async function authHeader() {
  const t = await getCurrentAccessToken();
  return t ? { authToken: t } : null;
}

export async function fetchSugarToday(): Promise<SugarToday | null> {
  const auth = await authHeader();
  if (!auth) return null;
  const res = await request<{ ok: true } & SugarToday>({ url: '/users/me/sugar/today', ...auth });
  if (!res.ok) return null;
  return {
    todayGrams: res.data.todayGrams,
    sevenDayAvg: res.data.sevenDayAvg,
    baselineDailyG: res.data.baselineDailyG,
    todaySavedG: res.data.todaySavedG,
    monthSavedG: res.data.monthSavedG,
    monthlyBadges: res.data.monthlyBadges
  };
}
