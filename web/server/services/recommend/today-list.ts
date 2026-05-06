/**
 * 今日推荐组合器
 *
 * 输入:用户近 3 日餐食 → 聚合 tcm_labels_summary 计数
 * 决策:
 *   - days < 1                       → insufficient_data(通用平和食物模板)
 *   - fa >= mild + calm 一半         → fa_heavy(给避开列表 + 平和 3 餐)
 *   - fa == 0 && mild == 0           → all_calm("继续保持"鼓励)
 *   - 其他                           → mild_balanced(给推荐 + 鼓励)
 */

import type { MealStore } from '../meals';
import type { FoodClassifierStore } from '../classifier';
import type { RecommendMode, TodayRecommendation } from './types';
import { pickAvoidList, pickThreeMeals } from './reverse-query';

export const RECENT_DAYS = 3;

function dateKeyN(now: Date, deltaDays: number): string {
  const d = new Date(now.getTime());
  d.setUTCDate(d.getUTCDate() - deltaDays);
  return d.toISOString().slice(0, 10);
}

interface Aggregate {
  fa: number;
  mild: number;
  calm: number;
  days: number; // 实际有餐食的天数
}

export async function aggregateRecent(
  mealStore: MealStore,
  userId: string,
  now: Date = new Date()
): Promise<Aggregate> {
  let fa = 0;
  let mild = 0;
  let calm = 0;
  let days = 0;
  for (let i = 0; i < RECENT_DAYS; i++) {
    const key = dateKeyN(now, i);
    const meals = await mealStore.listByDate(userId, key);
    if (meals.length === 0) continue;
    days += 1;
    for (const m of meals) {
      fa += m.tcmLabelsSummary['发'] ?? 0;
      mild += m.tcmLabelsSummary['温和'] ?? 0;
      calm += m.tcmLabelsSummary['平'] ?? 0;
    }
  }
  return { fa, mild, calm, days };
}

export function classify(agg: Aggregate): RecommendMode {
  if (agg.days < 1) return 'insufficient_data';
  if (agg.fa === 0 && agg.mild === 0) return 'all_calm';
  if (agg.fa >= (agg.mild + agg.calm) / 2 && agg.fa > 0) return 'fa_heavy';
  return 'mild_balanced';
}

const MODE_COPY: Record<RecommendMode, { headline: string; tagline: string }> = {
  fa_heavy: {
    headline: '近 3 天饮食偏炎症',
    tagline: '常见促炎食材先少吃 1-2 项;下面给你 3 餐抗炎组合参考(低 GI · 高纤维 · 优质蛋白)。'
  },
  mild_balanced: {
    headline: '节奏不错,继续保持',
    tagline: '今天照下面 3 餐组合走,清淡食材打底,少踩高糖与高 GI 即可。'
  },
  all_calm: {
    headline: '近 3 天很平稳',
    tagline: '继续保持现在的搭配方式;补充优质蛋白与膳食纤维让身体更舒服。'
  },
  insufficient_data: {
    headline: '今天先吃得平稳一些',
    tagline: '资料还不够个性化,先用通用清淡模板,坚持 1-2 天我们就能给到更准的建议。'
  }
};

export interface BuildRecommendationDeps {
  mealStore: MealStore;
  classifierStore: FoodClassifierStore;
  now?: () => Date;
}

export async function buildTodayRecommendation(
  deps: BuildRecommendationDeps,
  userId: string
): Promise<TodayRecommendation> {
  const now = deps.now?.() ?? new Date();
  const agg = await aggregateRecent(deps.mealStore, userId, now);
  const mode = classify(agg);

  const meals = await pickThreeMeals(deps.classifierStore);
  const avoid = mode === 'fa_heavy' ? await pickAvoidList(deps.classifierStore) : [];

  return {
    mode,
    headline: MODE_COPY[mode].headline,
    tagline: MODE_COPY[mode].tagline,
    avoid,
    meals,
    basis: { fa: agg.fa, mild: agg.mild, calm: agg.calm, days: agg.days }
  };
}
