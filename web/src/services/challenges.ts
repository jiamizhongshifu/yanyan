/**
 * 每日挑战 v1 — 5 项固定:
 *   1. meals     拍 ≥ 2 餐
 *   2. low_sugar 当日餐照里"添加糖"标记 = 0(下个 commit 接 LLM sugar_grams,本 commit 用启发式)
 *   3. water     喝水 ≥ 8 杯
 *   4. checkin   次晨打卡完成
 *   5. steps     步数 ≥ 6000
 *
 * 完成阶梯:≥4 项 = 完美一天 / 3 项 = 美好一天 / 1-2 项 = 奈斯一天 / 0 项 = 无勋章
 *
 * 数据来源混合:
 *   - meals/low_sugar 走 server today meals
 *   - water/steps 走 zustand wellness store(本地 persist)
 *   - checkin 走 yanScore.hasCheckin
 */

import type { TodayMealItem } from './home';
import type { YanScoreToday } from './symptoms';

export const CHALLENGE_KEYS = ['meals', 'low_sugar', 'water', 'checkin', 'steps'] as const;
export type ChallengeKey = (typeof CHALLENGE_KEYS)[number];

export interface ChallengeProgress {
  key: ChallengeKey;
  title: string;
  emoji: string;
  /** 0..1 */
  progress: number;
  done: boolean;
  /** 文案,如 "1 / 2 餐" */
  status: string;
}

export type DayTier = 'perfect' | 'great' | 'nice' | 'none';

interface Inputs {
  meals: TodayMealItem[];
  yanScore: YanScoreToday | null;
  waterCups: number;
  steps: number;
}

export function evaluateChallenges(inp: Inputs): ChallengeProgress[] {
  const mealsCount = inp.meals.length;
  // 启发式糖分判定:meals 里 tcmLabelsSummary['发']>0 视作含添加糖嫌疑(下版接真实 sugar_grams)
  const suspectSugarMeals = inp.meals.filter((m) => (m.tcmLabelsSummary?.['发'] ?? 0) > 0).length;
  const checkinDone = inp.yanScore?.hasCheckin ?? false;

  const meals: ChallengeProgress = {
    key: 'meals',
    title: '拍餐',
    emoji: '🍱',
    progress: Math.min(1, mealsCount / 2),
    done: mealsCount >= 2,
    status: `${mealsCount} / 2 餐`
  };
  const lowSugar: ChallengeProgress = {
    key: 'low_sugar',
    title: '控糖',
    emoji: '🍬',
    progress: mealsCount === 0 ? 0 : suspectSugarMeals === 0 ? 1 : 0,
    done: mealsCount > 0 && suspectSugarMeals === 0,
    status: mealsCount === 0 ? '今天还没拍餐' : suspectSugarMeals === 0 ? '今日 0 添加糖' : `${suspectSugarMeals} 餐含糖嫌疑`
  };
  const water: ChallengeProgress = {
    key: 'water',
    title: '喝水',
    emoji: '💧',
    progress: Math.min(1, inp.waterCups / 8),
    done: inp.waterCups >= 8,
    status: `${inp.waterCups} / 8 杯`
  };
  const checkin: ChallengeProgress = {
    key: 'checkin',
    title: '次晨打卡',
    emoji: '🌙',
    progress: checkinDone ? 1 : 0,
    done: checkinDone,
    status: checkinDone ? '已完成' : '尚未打卡'
  };
  const steps: ChallengeProgress = {
    key: 'steps',
    title: '步数',
    emoji: '🚶',
    progress: Math.min(1, inp.steps / 6000),
    done: inp.steps >= 6000,
    status: `${inp.steps} / 6000`
  };

  return [meals, lowSugar, water, checkin, steps];
}

export function tierForDay(progresses: ChallengeProgress[]): DayTier {
  const done = progresses.filter((p) => p.done).length;
  if (done >= 4) return 'perfect';
  if (done >= 3) return 'great';
  if (done >= 1) return 'nice';
  return 'none';
}

export const TIER_LABEL: Record<DayTier, string> = {
  perfect: '完美一天',
  great: '美好一天',
  nice: '奈斯一天',
  none: '——'
};

export const TIER_EMOJI: Record<DayTier, string> = {
  perfect: '☀️',
  great: '🌤',
  nice: '🌥',
  none: '·'
};
