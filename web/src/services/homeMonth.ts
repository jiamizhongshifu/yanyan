/**
 * 当月汇总 — 拍餐总数 / 拍餐天数 / 打卡天数 / 累计步数
 */
import { request } from './api';
import { getCurrentAccessToken } from './auth';

export interface HomeMonth {
  year: number;
  month: number;
  totalMeals: number;
  photoDays: number;
  checkinDays: number;
  totalSteps: number;
}

async function withAuth() {
  const t = await getCurrentAccessToken();
  return t ? { authToken: t } : null;
}

export async function fetchHomeMonth(year?: number, month?: number): Promise<HomeMonth | null> {
  const auth = await withAuth();
  if (!auth) return null;
  const qs: string[] = [];
  if (year) qs.push(`year=${year}`);
  if (month) qs.push(`month=${month}`);
  const url = `/home/month${qs.length ? `?${qs.join('&')}` : ''}`;
  const res = await request<{ ok: true } & HomeMonth>({ url, ...auth });
  if (!res.ok) return null;
  return {
    year: res.data.year,
    month: res.data.month,
    totalMeals: res.data.totalMeals,
    photoDays: res.data.photoDays,
    checkinDays: res.data.checkinDays,
    totalSteps: res.data.totalSteps
  };
}

/** 拉取指定日期的餐食列表(用于洞悉页"点趋势点回看当日") */
import type { TodayMealItem } from './home';

export async function fetchMealsByDate(date: string): Promise<{
  date: string;
  meals: TodayMealItem[];
} | null> {
  const auth = await withAuth();
  if (!auth) return null;
  const res = await request<{ ok: true; date: string; meals: TodayMealItem[] }>({
    url: `/home/today?date=${date}`,
    ...auth
  });
  if (!res.ok) return null;
  return { date: res.data.date, meals: res.data.meals };
}
