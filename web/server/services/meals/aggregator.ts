/**
 * 整餐火分聚合 — 多信号联合打分(v3,更严谨)
 *
 * 设计原则:
 *   - 即使是"健康食物",日常做法也带 cooking baseline(+3)
 *   - 性凉 / 性热 都给小惩罚(+3),只有性平 / 温为零
 *   - 数据缺失(DII / GI 为 null)给小不确定惩罚(+5 / +3)
 *   - DII 用分段映射,负值给小奖励(score floor 0)
 *
 * itemFireScore 由这 8 个组件叠加,每条食物都有清晰拆解:
 *   baseline(+3 固定)+ tcmLabel + tcmProperty + dii + gi + sugar + ages + unmatched
 *
 * 餐级:每条 item 独立打分,均值即 fireScore;未识别条目 +12 baseline。
 *
 * 等级阈值不变:平 [0,25) / 微火 [25,50) / 中火 [50,75) / 大火 [75,100]
 */

import type { FoodClassification, TcmLabel } from '../classifier';
import type { RecognizedItem } from '../recognition/types';

export type FireLevel = '平' | '微火' | '中火' | '大火';

export interface ScoreBreakdown {
  baseline: number;
  tcmLabel: number;
  tcmProperty: number;
  dii: number;
  gi: number;
  sugar: number;
  ages: number;
  unmatched: number;
}

export interface MealAggregate {
  fireScore: number;
  level: FireLevel;
  counts: Record<TcmLabel | 'unknown', number>;
  unrecognizedNames: string[];
  sugarGrams: number | null;
  /** 餐级火分构成(每个分量是所有 item 在该分量上的均值) */
  breakdown: ScoreBreakdown;
}

const BASELINE = 3;

function tcmLabelContribution(label: TcmLabel): number {
  if (label === '发') return 65;
  if (label === '温和') return 27;
  return 0;
}

function tcmPropertyContribution(prop: FoodClassification['tcmProperty']): number {
  // 寒 / 凉 / 热 都不算"中正",给小惩罚;平 / 温和 / 温 = 0
  if (prop === '寒' || prop === '凉' || prop === '热') return 3;
  return 0;
}

function diiContribution(dii: number | null | undefined): number {
  if (dii === null || dii === undefined) return 5;
  if (dii < -2) return -5;
  if (dii < -0.5) return -2;
  if (dii < 0.5) return 2;
  if (dii < 2) return 10;
  return 25;
}

function giContribution(gi: number | null | undefined): number {
  if (gi === null || gi === undefined) return 3;
  if (gi < 55) return 0;
  if (gi < 70) return 5;
  return 12;
}

function sugarContribution(sugar: number | null | undefined): number {
  if (sugar === null || sugar === undefined || sugar <= 5) return 0;
  return Math.min(sugar * 1.2, 30);
}

function agesContribution(ages: number | null | undefined): number {
  if (ages === null || ages === undefined || ages <= 5000) return 0;
  return Math.min((ages - 5000) / 250, 15);
}

/** 单条食物的火分 + 拆解 */
export function itemFireScoreBreakdown(
  cls: FoodClassification | null,
  ingredientMatchRatio: number = 1
): ScoreBreakdown {
  if (!cls) {
    // 未识别条目:只给基线 + 未识别 penalty
    return {
      baseline: BASELINE,
      tcmLabel: 0,
      tcmProperty: 0,
      dii: 5, // 没数据 → 不确定
      gi: 3,
      sugar: 0,
      ages: 0,
      unmatched: 12 // 整条都没识别等同 100% unmatched
    };
  }
  const unmatchedRatio = Math.max(0, Math.min(1, 1 - ingredientMatchRatio));
  return {
    baseline: BASELINE,
    tcmLabel: tcmLabelContribution(cls.tcmLabel),
    tcmProperty: tcmPropertyContribution(cls.tcmProperty),
    dii: diiContribution(cls.diiScore),
    gi: giContribution(cls.gi),
    sugar: sugarContribution(cls.addedSugarG),
    ages: agesContribution(cls.agesScore),
    unmatched: unmatchedRatio * 12
  };
}

export function breakdownTotal(b: ScoreBreakdown): number {
  return Math.max(
    0,
    Math.min(
      100,
      b.baseline + b.tcmLabel + b.tcmProperty + b.dii + b.gi + b.sugar + b.ages + b.unmatched
    )
  );
}

export function itemFireScore(
  cls: FoodClassification | null,
  ingredientMatchRatio: number = 1
): number {
  return breakdownTotal(itemFireScoreBreakdown(cls, ingredientMatchRatio));
}

export function aggregateMeal(
  items: RecognizedItem[],
  classifications: Array<FoodClassification | null>,
  ingredientClassifications?: Array<Array<{ name: string; classification: FoodClassification | null }>>
): MealAggregate {
  const counts: Record<TcmLabel | 'unknown', number> = { 发: 0, 温和: 0, 平: 0, unknown: 0 };
  const unrecognizedNames: string[] = [];
  let sugarSum = 0;
  let sugarSampleCount = 0;

  if (items.length !== classifications.length) {
    throw new Error('aggregateMeal: items 与 classifications 长度不一致');
  }

  const N = items.length;
  const acc: ScoreBreakdown = {
    baseline: 0, tcmLabel: 0, tcmProperty: 0, dii: 0, gi: 0, sugar: 0, ages: 0, unmatched: 0
  };

  for (let i = 0; i < items.length; i++) {
    const cls = classifications[i];
    if (cls) counts[cls.tcmLabel]++;
    else {
      counts.unknown++;
      unrecognizedNames.push(items[i].name);
    }

    let matchRatio = 1;
    const ingDetails = ingredientClassifications?.[i];
    if (ingDetails && ingDetails.length > 0) {
      const matched = ingDetails.filter((d) => d.classification !== null).length;
      matchRatio = matched / ingDetails.length;
    }

    const b = itemFireScoreBreakdown(cls, matchRatio);
    acc.baseline += b.baseline;
    acc.tcmLabel += b.tcmLabel;
    acc.tcmProperty += b.tcmProperty;
    acc.dii += b.dii;
    acc.gi += b.gi;
    acc.sugar += b.sugar;
    acc.ages += b.ages;
    acc.unmatched += b.unmatched;

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

  const breakdown: ScoreBreakdown = {
    baseline: N === 0 ? 0 : Math.round((acc.baseline / N) * 10) / 10,
    tcmLabel: N === 0 ? 0 : Math.round((acc.tcmLabel / N) * 10) / 10,
    tcmProperty: N === 0 ? 0 : Math.round((acc.tcmProperty / N) * 10) / 10,
    dii: N === 0 ? 0 : Math.round((acc.dii / N) * 10) / 10,
    gi: N === 0 ? 0 : Math.round((acc.gi / N) * 10) / 10,
    sugar: N === 0 ? 0 : Math.round((acc.sugar / N) * 10) / 10,
    ages: N === 0 ? 0 : Math.round((acc.ages / N) * 10) / 10,
    unmatched: N === 0 ? 0 : Math.round((acc.unmatched / N) * 10) / 10
  };

  const fireScore = N === 0 ? 0 : breakdownTotal(breakdown);
  const level = scoreToLevel(fireScore);
  const sugarGrams = sugarSampleCount > 0 ? Math.round(sugarSum * 10) / 10 : null;

  return {
    fireScore: Math.round(fireScore * 10) / 10,
    level,
    counts,
    unrecognizedNames,
    sugarGrams,
    breakdown
  };
}

export function scoreToLevel(score: number): FireLevel {
  if (score < 25) return '平';
  if (score < 50) return '微火';
  if (score < 75) return '中火';
  return '大火';
}
