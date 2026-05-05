/**
 * 公开炎症指数测评(无登录,纯客户端)
 *
 * 流程定位:Landing → /quiz/step1-3 → /quiz/result(炎症指数 + 锁定功能预览 + 登录 CTA)
 *
 * 与 Yan-Score 的区别:
 *   - Yan-Score(登录后)= 4 Part 加权 + 30 天个体回归 + 真实餐食 + 环境数据
 *   - 炎症指数(公开)= 仅基于自报症状 + 生活方式问答(2 Part 简化版)
 *
 * 4 档分桶与 Yan-Score 一致(平 / 微火 / 中火 / 大火),用户无认知切换成本。
 *
 * 同意上溯:用户登录后,若同意条款,本指数 + 答案可作为 onboarding baseline
 * 直接 prefill,不需要重做。
 */

import type { ReverseFilterChoice, SymptomDimension, SymptomFrequency, FireLevel } from './onboarding';

export const LIFESTYLE_QUESTIONS = [
  'recent_diet', // 近期饮食
  'sleep_pattern' // 近期睡眠
] as const;
export type LifestyleQuestion = (typeof LIFESTYLE_QUESTIONS)[number];

export const RECENT_DIET_OPTIONS = ['mostly_home', 'mixed', 'mostly_outside_or_spicy'] as const;
export type RecentDiet = (typeof RECENT_DIET_OPTIONS)[number];

export const SLEEP_OPTIONS = ['regular_7h', 'irregular', 'short_or_late'] as const;
export type SleepPattern = (typeof SLEEP_OPTIONS)[number];

export const RECENT_DIET_LABELS: Record<RecentDiet, string> = {
  mostly_home: '基本家里做饭、清淡为主',
  mixed: '一半家里、一半外卖或餐馆',
  mostly_outside_or_spicy: '主要外卖 / 餐馆,辛辣油炸偏多'
};
export const SLEEP_LABELS: Record<SleepPattern, string> = {
  regular_7h: '基本规律,睡 7 小时左右',
  irregular: '时间不太固定,偶尔熬夜',
  short_or_late: '常常熬夜或睡不到 6 小时'
};

export interface QuizAnswers {
  reverseFilterChoice: ReverseFilterChoice | null;
  symptomsFrequency: Partial<Record<SymptomDimension, SymptomFrequency>>;
  recentDiet: RecentDiet | null;
  sleepPattern: SleepPattern | null;
}

export interface InflammationIndex {
  /** 0-100 整数,与 Yan-Score 一致量纲 */
  score: number;
  /** 4 档,与 Yan-Score 一致 */
  level: FireLevel;
  /** 拆分 — symptomPart 来自 7 维度,lifestylePart 来自饮食 + 睡眠 */
  breakdown: {
    symptomPart: number; // 0-100
    lifestylePart: number; // 0-100
  };
  /** 数据完整度 0-1(7 dim 中有几个回答 + 2 个 lifestyle 是否回答) */
  completeness: number;
}

/**
 * 计算炎症指数(纯函数)
 *
 * 权重:症状 70% + 生活方式 30%(无餐食 / 环境数据,所以减去 Yan-Score 的 50/15 占比)
 * 缺失维度按 0 计;completeness 信号告诉用户回答越多越准
 */
export function computeInflammationIndex(answers: QuizAnswers): InflammationIndex {
  const sw: Record<SymptomFrequency, number> = { rare: 0, sometimes: 1, often: 2 };
  // symptomPart: 7 维度均值,严重度 0-2 → score 0-100
  let symptomTotal = 0;
  let symptomCount = 0;
  for (const v of Object.values(answers.symptomsFrequency)) {
    if (v) {
      symptomTotal += sw[v];
      symptomCount++;
    }
  }
  const symptomPart = symptomCount > 0 ? Math.round((symptomTotal / (symptomCount * 2)) * 100) : 0;

  // lifestylePart: 饮食 + 睡眠映射到 0-100
  const dietScore: Record<RecentDiet, number> = { mostly_home: 0, mixed: 50, mostly_outside_or_spicy: 90 };
  const sleepScore: Record<SleepPattern, number> = { regular_7h: 0, irregular: 50, short_or_late: 85 };
  const dietP = answers.recentDiet ? dietScore[answers.recentDiet] : 0;
  const sleepP = answers.sleepPattern ? sleepScore[answers.sleepPattern] : 0;
  const lifestyleCount = (answers.recentDiet ? 1 : 0) + (answers.sleepPattern ? 1 : 0);
  const lifestylePart = lifestyleCount > 0 ? Math.round((dietP + sleepP) / lifestyleCount) : 0;

  const score = Math.round(symptomPart * 0.7 + lifestylePart * 0.3);
  const level: FireLevel =
    score < 25 ? '平' : score < 50 ? '微火' : score < 75 ? '中火' : '大火';

  // completeness: 7 dim 中有几个 + 2 lifestyle 中有几个,合并到 0-1
  const completeness = Math.round((symptomCount + lifestyleCount) * 100 / 9) / 100;

  return { score, level, breakdown: { symptomPart, lifestylePart }, completeness };
}

/** 4 档对应的简短建议 — UI 直接展示 */
export const LEVEL_HINT: Record<FireLevel, { headline: string; body: string }> = {
  平: {
    headline: '当前体感平稳',
    body: '近期身体没什么明显信号,继续保持现在的饮食和作息节奏就好。'
  },
  微火: {
    headline: '整体清气',
    body: '有一些轻度信号(口干 / 起痘 / 大便偏干等),挑一两餐清淡一下,1-2 周再看看。'
  },
  中火: {
    headline: '略偏微暖',
    body: '多个维度都有反应,接下来一周以清淡为主,加白米粥 / 山药 / 绿叶蔬菜,睡够 7 小时会更舒服。'
  },
  大火: {
    headline: '建议留心一下',
    body: '症状比较明显。如有体检异常或长期不缓解,建议同时咨询医生 / 注册营养师。本工具仅作生活方式参考。'
  }
};
