/**
 * 整餐火分聚合
 *
 * Round 2 review 修订(U6 + U8 一致):统一用 FoodPart 标准化均值公式,
 * 不再用 max(发条目数 × 25, 温和条目数 × 10) — 避免火锅 4+ 发物钉天花板。
 *
 * 公式:
 *   weights: 发=5, 温和=2, 平=0
 *   sum = Σ weights[item.tcmLabel]
 *   normalized = sum / (N * 5) * 100   // [0, 100]
 *   level = 平 [0,25) / 微火 [25,50) / 中火 [50,75) / 大火 [75,100]
 *
 * 缺失分类(food_classifications.findByName 返回 null)= 平(权重 0),
 * 同时记入"未识别项"清单,Phase 2 走人工 review。
 */

import type { FoodClassification, TcmLabel } from '../classifier';
import type { RecognizedItem } from '../recognition/types';

export type FireLevel = '平' | '微火' | '中火' | '大火';

export interface MealAggregate {
  /** 标准化整餐火分 [0, 100] */
  fireScore: number;
  level: FireLevel;
  /** 各档食物条目数(用于 UI 渲染 + breakdown) */
  counts: Record<TcmLabel | 'unknown', number>;
  /** 在 food_classifications 中查不到的食物名 */
  unrecognizedNames: string[];
  /**
   * 餐级添加糖累计(g)。Σ items.addedSugarG(缺失计 0)。
   * 当所有 item 的 addedSugarG 都为 null 时返回 null,表示"未估算"而非 0g。
   */
  sugarGrams: number | null;
}

const WEIGHTS: Record<TcmLabel, number> = { 发: 5, 温和: 2, 平: 0 };

export function aggregateMeal(
  items: RecognizedItem[],
  classifications: Array<FoodClassification | null>
): MealAggregate {
  const counts: Record<TcmLabel | 'unknown', number> = { 发: 0, 温和: 0, 平: 0, unknown: 0 };
  const unrecognizedNames: string[] = [];
  let weightedSum = 0;
  let sugarSum = 0;
  let sugarSampleCount = 0;

  if (items.length !== classifications.length) {
    throw new Error('aggregateMeal: items 与 classifications 长度不一致');
  }

  for (let i = 0; i < items.length; i++) {
    const cls = classifications[i];
    if (cls) {
      counts[cls.tcmLabel]++;
      weightedSum += WEIGHTS[cls.tcmLabel];
      if (cls.addedSugarG !== null && cls.addedSugarG !== undefined) {
        sugarSum += cls.addedSugarG;
        sugarSampleCount++;
      }
    } else {
      counts.unknown++;
      unrecognizedNames.push(items[i].name);
    }
  }

  const N = items.length;
  const fireScore = N === 0 ? 0 : (weightedSum / (N * 5)) * 100;
  const level = scoreToLevel(fireScore);
  // 至少有 1 项命中糖分数据 → 返回 sum;全部 null → null(无估算)
  const sugarGrams = sugarSampleCount > 0 ? Math.round(sugarSum * 10) / 10 : null;

  return { fireScore: Math.round(fireScore * 10) / 10, level, counts, unrecognizedNames, sugarGrams };
}

export function scoreToLevel(score: number): FireLevel {
  if (score < 25) return '平';
  if (score < 50) return '微火';
  if (score < 75) return '中火';
  return '大火';
}
