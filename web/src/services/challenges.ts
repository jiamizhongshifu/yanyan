/**
 * 每日挑战 v1 — 5 项固定:
 *   1. meals     拍 ≥ 2 餐
 *   2. low_sugar 今日添加糖 ≤ 25g(《中国居民膳食指南 2022》上限)
 *   3. water     喝水 ≥ 8 杯
 *   4. checkin   次晨打卡完成
 *   5. steps     步数 ≥ 6000
 *
 * 完成阶梯:≥4 项 = 完美一天 / 3 项 = 美好一天 / 1-2 项 = 奈斯一天 / 0 项 = 无勋章
 *
 * 数据来源混合:
 *   - meals 走 server today meals
 *   - low_sugar 优先走真实 sugarGrams 累计;无餐照 → 进度 0
 *   - water/steps 走 zustand wellness store(本地 persist)
 *   - checkin 走 yanScore.hasCheckin
 */

import type { TodayMealItem } from './home';
import type { YanScoreToday } from './symptoms';

export const DAILY_SUGAR_GOAL_G = 25;

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
  // 真实糖分累计 — 仅累计 sugarGrams !== null 的餐(避免老餐拉低)
  const sugarMeals = inp.meals.filter((m) => m.sugarGrams !== null);
  const totalSugar = sugarMeals.reduce((s, m) => s + (m.sugarGrams ?? 0), 0);
  const sugarRounded = Math.round(totalSugar * 10) / 10;
  const checkinDone = inp.yanScore?.hasCheckin ?? false;

  const meals: ChallengeProgress = {
    key: 'meals',
    title: '拍餐',
    emoji: '🍱',
    progress: Math.min(1, mealsCount / 2),
    done: mealsCount >= 2,
    status: `${mealsCount} / 2 餐`
  };
  // 控糖:有餐照数据且累计 ≤ 25 g 视作完成。无数据时 progress=0,保留行动激励
  const sugarDone = sugarMeals.length > 0 && sugarRounded <= DAILY_SUGAR_GOAL_G;
  const lowSugar: ChallengeProgress = {
    key: 'low_sugar',
    title: '控糖',
    emoji: '🍬',
    progress:
      sugarMeals.length === 0
        ? 0
        : sugarRounded <= DAILY_SUGAR_GOAL_G
        ? 1
        : Math.max(0.05, DAILY_SUGAR_GOAL_G / sugarRounded),
    done: sugarDone,
    status:
      sugarMeals.length === 0
        ? '今天还没拍餐'
        : sugarRounded <= DAILY_SUGAR_GOAL_G
        ? `${sugarRounded} g / ${DAILY_SUGAR_GOAL_G} g 内`
        : `${sugarRounded} g(超 ${(sugarRounded - DAILY_SUGAR_GOAL_G).toFixed(1)} g)`
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
