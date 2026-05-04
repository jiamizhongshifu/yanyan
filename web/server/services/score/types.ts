/**
 * Yan-Score v0 — 4 Part 加权
 *
 * Round 2 review 修订(plan U8):
 *   - 任意 Part 缺失 → 在剩余 Part 间按比例重分配
 *   - 单一 Part 上限 = 原权重 × 2(防 Day 1 单一 Part 跨等级放大)
 *   - 可用 Part < 2 时返回 null + UI 文案"数据还不够"
 */

export const PART_KEYS = ['food', 'symptom', 'env', 'activity'] as const;
export type PartKey = (typeof PART_KEYS)[number];

/** 默认权重 — 总和 = 1 */
export const DEFAULT_WEIGHTS: Record<PartKey, number> = {
  food: 0.5,
  symptom: 0.3,
  env: 0.15,
  activity: 0.05
};

export const FIRE_LEVELS = ['平', '微火', '中火', '大火'] as const;
export type FireLevel = (typeof FIRE_LEVELS)[number];

export interface PartScores {
  /** 各 Part 标准化到 [0, 100] 后的分数;null 表示无数据 */
  food: number | null;
  symptom: number | null;
  env: number | null;
  activity: number | null;
}

export interface YanScoreResult {
  score: number; // [0, 100]
  level: FireLevel;
  /** 各 Part 实际加权后贡献(总和 ≈ score) */
  breakdown: Record<PartKey, number>;
  /** 实际生效的权重(重分配后) */
  effectiveWeights: Record<PartKey, number>;
  missingParts: PartKey[];
  /** 各 Part 标准化原始分数(0-100,缺失为 null)— 给 UI 展示原始数据用 */
  partScores: PartScores;
}

export function scoreToLevel(score: number): FireLevel {
  if (score < 25) return '平';
  if (score < 50) return '微火';
  if (score < 75) return '中火';
  return '大火';
}
