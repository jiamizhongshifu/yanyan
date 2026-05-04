/**
 * 今日推荐客户端服务 (plan U13a)
 */

import { request } from './api';
import { getCurrentAccessToken } from './auth';

export type RecommendMode = 'fa_heavy' | 'mild_balanced' | 'all_calm' | 'insufficient_data';

interface Citation {
  source: 'canon' | 'paper' | 'modern_nutrition';
  reference: string;
  excerpt?: string;
}

export interface AvoidItem {
  name: string;
  citations: Citation[];
}

export interface MealOption {
  slot: 'breakfast' | 'lunch' | 'dinner';
  items: string[];
  citations: Citation[];
}

export interface TodayRecommendation {
  mode: RecommendMode;
  headline: string;
  tagline: string;
  avoid: AvoidItem[];
  meals: MealOption[];
  basis: { fa: number; mild: number; calm: number; days: number };
}

export const SLOT_LABELS: Record<MealOption['slot'], string> = {
  breakfast: '早餐',
  lunch: '午餐',
  dinner: '晚餐'
};

export async function fetchTodayRecommendation(): Promise<TodayRecommendation | null> {
  const t = await getCurrentAccessToken();
  if (!t) return null;
  const res = await request<{ ok: true; recommendation: TodayRecommendation }>({
    url: '/recommend/today',
    authToken: t
  });
  if (!res.ok) return null;
  return res.data.recommendation;
}
