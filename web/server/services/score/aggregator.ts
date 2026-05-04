/**
 * Yan-Score 聚合器 — 4 Part 加权 + 缺失重分配 + 上限保护 + 等级分桶
 *
 * 算法步骤:
 *   1. 找出可用 Part(value !== null)
 *   2. 可用 < 2 → 返回 null
 *   3. 计算可用 Part 间按"原权重比例"重分配:
 *        weight_i' = DEFAULT_WEIGHTS[i] / sum(DEFAULT_WEIGHTS[available])
 *   4. 检查上限:任意 weight_i' > DEFAULT_WEIGHTS[i] × 2 → 返回 null
 *   5. score = Σ weight_i' × partScore[i],并 clip 到 [0, 100]
 *   6. breakdown[i] = weight_i' × partScore[i](展示给用户)
 *   7. level = scoreToLevel(score)
 *
 * 注:此函数纯 — 输入是各 Part 已标准化的分数(0-100 或 null),不依赖 DB。
 */

import {
  DEFAULT_WEIGHTS,
  PART_KEYS,
  scoreToLevel,
  type PartKey,
  type PartScores,
  type YanScoreResult
} from './types';

const PART_UPPER_RATIO = 2; // 单 Part 重分配上限 = 原权重 × 2

export function aggregate(parts: PartScores): YanScoreResult | null {
  const available: PartKey[] = [];
  const missing: PartKey[] = [];
  for (const k of PART_KEYS) {
    if (parts[k] !== null && parts[k] !== undefined) {
      available.push(k);
    } else {
      missing.push(k);
    }
  }

  // 可用 < 2 → null(plan Round 2 修订)
  if (available.length < 2) return null;

  const availableSumDefault = available.reduce((s, k) => s + DEFAULT_WEIGHTS[k], 0);
  const effectiveWeights: Record<PartKey, number> = { food: 0, symptom: 0, env: 0, activity: 0 };
  for (const k of available) {
    effectiveWeights[k] = DEFAULT_WEIGHTS[k] / availableSumDefault;
  }

  // 上限检查:任意可用 Part 重分配后 > 原权重 × 2 → 返回 null(避免单点支配)
  for (const k of available) {
    const upper = DEFAULT_WEIGHTS[k] * PART_UPPER_RATIO;
    if (effectiveWeights[k] > upper) return null;
  }

  const breakdown: Record<PartKey, number> = { food: 0, symptom: 0, env: 0, activity: 0 };
  let score = 0;
  for (const k of available) {
    const part = parts[k];
    if (part == null) continue;
    const contribution = effectiveWeights[k] * part;
    breakdown[k] = Math.round(contribution * 10) / 10;
    score += contribution;
  }
  score = Math.max(0, Math.min(100, score));
  score = Math.round(score * 10) / 10;
  const level = scoreToLevel(score);

  return {
    score,
    level,
    breakdown,
    effectiveWeights: roundWeights(effectiveWeights),
    missingParts: missing,
    partScores: parts
  };
}

function roundWeights(w: Record<PartKey, number>): Record<PartKey, number> {
  return {
    food: Math.round(w.food * 1000) / 1000,
    symptom: Math.round(w.symptom * 1000) / 1000,
    env: Math.round(w.env * 1000) / 1000,
    activity: Math.round(w.activity * 1000) / 1000
  };
}
