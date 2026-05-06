/**
 * 整餐火分聚合 — 多信号联合打分(v2)
 *
 * 旧版只看 tcmLabel(发=5/温和=2/平=0)→ 任何'平'食物都 0 分(满分),失去区分度。
 * 新版 itemFireScore 把以下信号联合:
 *   - TCM 标签(40 权重):发=55、温和=22、平=0
 *   - DII 膳食炎症指数(diiScore > 0.5 才加分,最高 +25)
 *   - GI 升糖指数(>=70 +10、>=55 +3)
 *   - 添加糖(每 1g +1.2,封顶 +30)
 *   - AGEs(>5000 起加,封顶 +15)
 *   - 食材未匹配率(每 100% 未匹配 +12,代表数据不确定带来的小惩罚)
 *
 * 餐级:每个 item 独立打分,取均值;未识别项默认计 +12(略偏 pro-inflam)
 *
 * level 阈值不变:平 [0,25) / 微火 [25,50) / 中火 [50,75) / 大火 [75,100]
 */

import type { FoodClassification, TcmLabel } from '../classifier';
import type { RecognizedItem } from '../recognition/types';

export type FireLevel = '平' | '微火' | '中火' | '大火';

export interface MealAggregate {
  fireScore: number;
  level: FireLevel;
  counts: Record<TcmLabel | 'unknown', number>;
  unrecognizedNames: string[];
  sugarGrams: number | null;
}

/**
 * 单条食物的火分(0-100)— 多信号叠加,数据缺失视为没有该信号(不强制加 baseline)
 */
export function itemFireScore(
  cls: FoodClassification | null,
  ingredientMatchRatio: number = 1
): number {
  if (!cls) {
    // 未识别条目 + 无主料数据:默认轻度 pro-inflam,代表"数据缺失带来的不确定性"
    return 12;
  }

  let score = 0;

  // TCM 标签(主信号)
  if (cls.tcmLabel === '发') score += 55;
  else if (cls.tcmLabel === '温和') score += 22;

  // DII:正向才加分(抗炎食物 < 0 不再扣 antiInflam)
  if (cls.diiScore !== null && cls.diiScore > 0.5) {
    score += Math.min(cls.diiScore * 7, 25);
  }

  // GI
  if (cls.gi !== null) {
    if (cls.gi >= 70) score += 10;
    else if (cls.gi >= 55) score += 3;
  }

  // 添加糖
  if (cls.addedSugarG !== null && cls.addedSugarG > 5) {
    score += Math.min(cls.addedSugarG * 1.2, 30);
  }

  // AGEs(高级糖化终产物)
  if (cls.agesScore !== null && cls.agesScore > 5000) {
    score += Math.min((cls.agesScore - 5000) / 250, 15);
  }

  // 食材未匹配率惩罚:全未匹配 +12,30% 未匹配 +3.6
  const unmatchedRatio = Math.max(0, Math.min(1, 1 - ingredientMatchRatio));
  score += unmatchedRatio * 12;

  return Math.max(0, Math.min(100, score));
}

export function aggregateMeal(
  items: RecognizedItem[],
  classifications: Array<FoodClassification | null>,
  /** 可选:每个 item 的主料分类列表(matched/null),用来算 unmatched 率 */
  ingredientClassifications?: Array<Array<{ name: string; classification: FoodClassification | null }>>
): MealAggregate {
  const counts: Record<TcmLabel | 'unknown', number> = { 发: 0, 温和: 0, 平: 0, unknown: 0 };
  const unrecognizedNames: string[] = [];
  let totalScore = 0;
  let sugarSum = 0;
  let sugarSampleCount = 0;

  if (items.length !== classifications.length) {
    throw new Error('aggregateMeal: items 与 classifications 长度不一致');
  }

  for (let i = 0; i < items.length; i++) {
    const cls = classifications[i];
    if (cls) {
      counts[cls.tcmLabel]++;
    } else {
      counts.unknown++;
      unrecognizedNames.push(items[i].name);
    }

    // 主料匹配率
    let matchRatio = 1;
    const ingDetails = ingredientClassifications?.[i];
    if (ingDetails && ingDetails.length > 0) {
      const matched = ingDetails.filter((d) => d.classification !== null).length;
      matchRatio = matched / ingDetails.length;
    }

    totalScore += itemFireScore(cls, matchRatio);

    // 糖分(用 DB 优先 / LLM 估算回退)
    const dbSugar = cls?.addedSugarG;
    const llmSugar = items[i].addedSugarGEstimate;
    let sugarForItem: number | null = null;
    if (dbSugar !== null && dbSugar !== undefined) sugarForItem = dbSugar;
    else if (llmSugar !== null && llmSugar !== undefined) sugarForItem = llmSugar;
    if (sugarForItem !== null) {
      sugarSum += sugarForItem;
      sugarSampleCount++;
    }
  }

  const N = items.length;
  const fireScore = N === 0 ? 0 : totalScore / N;
  const level = scoreToLevel(fireScore);
  const sugarGrams = sugarSampleCount > 0 ? Math.round(sugarSum * 10) / 10 : null;

  return {
    fireScore: Math.round(fireScore * 10) / 10,
    level,
    counts,
    unrecognizedNames,
    sugarGrams
  };
}

export function scoreToLevel(score: number): FireLevel {
  if (score < 25) return '平';
  if (score < 50) return '微火';
  if (score < 75) return '中火';
  return '大火';
}
