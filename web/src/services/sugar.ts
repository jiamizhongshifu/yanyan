/**
 * 糖分量化客户端服务
 */
import { request } from './api';
import { getCurrentAccessToken } from './auth';
import { cached, peekCache } from './cache';

export interface SugarBadge {
  kind: 'lollipop' | 'chocolate' | 'cola' | 'milktea';
  emoji: string;
  label: string;
  gramsEach: number;
  count: number;
}

/** 勋章 kind → ponchi-e 插画文件名(替代 emoji 渲染) */
export const SUGAR_BADGE_ICON: Record<SugarBadge['kind'], string> = {
  lollipop: 'badge-lollipop.png',
  cola: 'badge-cola.png',
  milktea: 'badge-milktea.png',
  chocolate: 'badge-chocolate.png'
};

/** 把"本月减糖换算"翻成口语句:"少喝 2 杯奶茶"/"少吃 3 块巧克力" */
export function sugarAchievementSentence(badge: SugarBadge): string {
  switch (badge.kind) {
    case 'milktea':
      return `少喝 ${badge.count} 杯${badge.label}`;
    case 'cola':
      return `少喝 ${badge.count} 罐${badge.label}`;
    case 'chocolate':
      return `少吃 ${badge.count} 块${badge.label}`;
    case 'lollipop':
      return `少吃 ${badge.count} 根${badge.label}`;
  }
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
  return cached('sugar:today', 30_000, async () => {
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
  });
}

/** 同步读 sugar 缓存(useState 初始化用) */
export function peekSugarToday(): SugarToday | null {
  return peekCache<SugarToday>('sugar:today') ?? null;
}
