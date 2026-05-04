/**
 * Onboarding 期间收集的数据结构
 *
 * 7 个发物维度的频次档(plan R4):几乎没 / 偶尔 / 经常,1 屏方块矩阵呈现
 * 反向定位选项是 5 选 1(占位文案,ce-work 阶段用户访谈替换)
 */

export const SYMPTOM_DIMENSIONS = [
  'nasal_congestion',  // 鼻塞
  'acne',              // 起痘
  'dry_mouth',         // 口干
  'bowel',             // 大便异常
  'fatigue',           // 精神(困倦)
  'edema',             // 浮肿
  'throat_itch'        // 喉咙痒
] as const;
export type SymptomDimension = (typeof SYMPTOM_DIMENSIONS)[number];

export const SYMPTOM_FREQUENCY = ['rare', 'sometimes', 'often'] as const;
export type SymptomFrequency = (typeof SYMPTOM_FREQUENCY)[number];

export const REVERSE_FILTER_CHOICES = [
  'rhinitis',          // 想改鼻炎
  'blood_sugar',       // 想改血糖
  'uric_acid',         // 想改尿酸
  'checkup_abnormal',  // 想改体检异常
  'curious'            // 看看而已
] as const;
export type ReverseFilterChoice = (typeof REVERSE_FILTER_CHOICES)[number];

export interface OnboardingBaseline {
  reverseFilterChoice: ReverseFilterChoice;
  symptomsFrequency: Partial<Record<SymptomDimension, SymptomFrequency>>;
}

/**
 * 基于 baseline 推断初始上火等级先验(给 step3 即视感用)
 *
 * 简单启发式:症状频次加权
 *   rare=0, sometimes=1, often=2 → sum / (维度数 × 2)
 *   ≤0.15 平 / ≤0.40 微火 / ≤0.65 中火 / >0.65 大火
 *
 * 这只是 onboarding 启动时的"看起来你近期偏 X" 提示,不持久化为 Yan-Score;
 * Yan-Score 真正的算法在 U8 实施。
 */
export function inferInitialFireLevel(baseline: OnboardingBaseline): { level: '平' | '微火' | '中火' | '大火'; ratio: number } {
  const weights: Record<SymptomFrequency, number> = { rare: 0, sometimes: 1, often: 2 };
  let total = 0;
  let count = 0;
  for (const dim of SYMPTOM_DIMENSIONS) {
    const freq = baseline.symptomsFrequency[dim];
    if (freq) {
      total += weights[freq];
      count++;
    }
  }
  const ratio = count > 0 ? total / (count * 2) : 0;
  let level: '平' | '微火' | '中火' | '大火';
  if (ratio <= 0.15) level = '平';
  else if (ratio <= 0.40) level = '微火';
  else if (ratio <= 0.65) level = '中火';
  else level = '大火';
  return { level, ratio: Number(ratio.toFixed(3)) };
}
