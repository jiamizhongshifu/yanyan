/**
 * Day 30 体质档案 v0.5 构造器 (plan U13b)
 *
 * 步骤:
 *   1. 检查累计打卡天数 >= 30(SymptomStore.countDistinctCheckinDates)
 *   2. 拉取过去 30 天餐食 (MealStore.listInRange)
 *   3. 按日聚合 fireScore 平均 + 餐次
 *   4. 累加 tcm_labels_summary 各类计数
 *   5. 反向查 classifier "发" top-5 作为群体先验
 *   6. 拼装 disclaimer
 */

import type { FoodClassifierStore } from '../classifier';
import type { MealStore } from '../meals';
import type { SymptomStore } from '../symptoms';
import type { CommonFaFood, DailyFirePoint, FaCounts, ProfileV05Data } from './types';
import { PROFILE_WINDOW_DAYS } from './types';

export const PROFILE_TITLE = '30 天体质档案 v0.5';
export const COMMON_FA_TOP_N = 5;

export const DISCLAIMERS_V05: string[] = [
  '本档案为 v0.5 群体先验版,基于公开典籍 + 群体统计先验,不含 Bayesian 个体回归(将在下个版本接入)。',
  '影响身体反应的混杂因素较多(睡眠 / 压力 / 月经周期 / 用药 / 既往病史等),v0.5 未扣除上述混杂。',
  '本档案仅作生活方式参考,不构成医疗建议、不替代诊疗、不涉及任何疾病诊断或治疗承诺。',
  '若有任何不适,请立即就医并咨询执业医师 / 注册营养师。'
];

function pad(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

function dateKey(d: Date): string {
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

function rangeBack(now: Date, days: number): { since: string; until: string; allDates: string[] } {
  const until = new Date(now.getTime());
  const since = new Date(now.getTime());
  since.setUTCDate(since.getUTCDate() - (days - 1));
  const allDates: string[] = [];
  const cur = new Date(since.getTime());
  for (let i = 0; i < days; i++) {
    allDates.push(dateKey(cur));
    cur.setUTCDate(cur.getUTCDate() + 1);
  }
  return { since: dateKey(since), until: dateKey(until), allDates };
}

export interface BuildProfileDeps {
  mealStore: MealStore;
  symptomStore: SymptomStore;
  classifierStore: FoodClassifierStore;
  now?: () => Date;
}

export interface BuildProfileResult {
  ok: true;
  data: ProfileV05Data;
}

export interface BuildProfileNotEligible {
  ok: false;
  reason: 'not_eligible';
  cumulativeCheckinDays: number;
  required: number;
}

export async function buildProfileV05(
  deps: BuildProfileDeps,
  userId: string
): Promise<BuildProfileResult | BuildProfileNotEligible> {
  const now = deps.now?.() ?? new Date();
  const cumulativeCheckinDays = await deps.symptomStore.countDistinctCheckinDates(userId);
  if (cumulativeCheckinDays < PROFILE_WINDOW_DAYS) {
    return {
      ok: false,
      reason: 'not_eligible',
      cumulativeCheckinDays,
      required: PROFILE_WINDOW_DAYS
    };
  }

  const { since, until, allDates } = rangeBack(now, PROFILE_WINDOW_DAYS);
  const meals = await deps.mealStore.listInRange(userId, since, until);

  // 按日聚合
  const dayMap = new Map<string, { sum: number; n: number }>();
  for (const k of allDates) dayMap.set(k, { sum: 0, n: 0 });
  let faTotal = 0;
  let mildTotal = 0;
  let calmTotal = 0;
  let unknownTotal = 0;
  for (const m of meals) {
    const k = dateKey(m.ateAt);
    const entry = dayMap.get(k);
    if (entry && m.fireScore !== null) {
      entry.sum += m.fireScore;
      entry.n += 1;
    }
    faTotal += m.tcmLabelsSummary['发'] ?? 0;
    mildTotal += m.tcmLabelsSummary['温和'] ?? 0;
    calmTotal += m.tcmLabelsSummary['平'] ?? 0;
    unknownTotal += m.tcmLabelsSummary['unknown'] ?? 0;
  }

  const dailyTrend: DailyFirePoint[] = allDates.map((d) => {
    const e = dayMap.get(d)!;
    return {
      date: d,
      avgFireScore: e.n === 0 ? null : Math.round((e.sum / e.n) * 100) / 100,
      mealCount: e.n
    };
  });

  const faCounts: FaCounts = { faTotal, mildTotal, calmTotal, unknownTotal };

  const faFoods = await deps.classifierStore.listByLabel('发', COMMON_FA_TOP_N);
  const commonFaFoods: CommonFaFood[] = faFoods.map((f) => ({
    name: f.foodCanonicalName,
    citations: f.citations.length > 0 ? [f.citations[0]] : []
  }));

  return {
    ok: true,
    data: {
      cumulativeCheckinDays,
      title: PROFILE_TITLE,
      generatedAt: now.toISOString(),
      dailyTrend,
      faCounts,
      commonFaFoods,
      checkupSummary: null,
      disclaimers: DISCLAIMERS_V05
    }
  };
}
