/**
 * Meals service — 创建餐食 + 反馈写入
 *
 * createMeal:
 *   1. 调 hedged LLM recognizer → recognized items
 *   2. 对每个 item 查 food_classifications
 *   3. aggregate → fire_score + level + tcm summary
 *   4. envelope-encrypt recognized items
 *   5. INSERT meals 行
 *   6. 返回完整结果(含归一化 fire_score / level / 食物条目带分类)
 *
 * appendFeedback:
 *   - 用户在结果页点"误识别"时触发(R9)
 *   - kind ∈ {misrecognized, no_reaction};
 *     no_reaction 是 R23 反例(我吃了没事),会把发物清单证据写入,Phase 2 算法消费
 */

import type { FoodClassification, FoodClassifierStore } from '../classifier';
import { encryptField } from '../../crypto/envelope';
import type { LlmFoodRecognizer } from '../recognition';
import { LOW_CONFIDENCE_THRESHOLD } from '../recognition/types';
import type { MealRow, MealStore } from './store';
import { aggregateMeal, scoreToLevel, type FireLevel, type MealAggregate } from './aggregator';
import { summaryFromCounts, westernSummary } from './store';

export interface MealsDeps {
  mealStore: MealStore;
  classifierStore: FoodClassifierStore;
  recognizer: LlmFoodRecognizer;
  /** 未识别食物名进入回填队列 */
  onMissingFood?: (name: string) => void;
}

export interface CreateMealResult {
  mealId: string;
  fireScore: number;
  level: FireLevel;
  /** 餐级添加糖估算(g),null = 未估算 */
  sugarGrams: number | null;
  items: Array<{
    name: string;
    confidence: number;
    classification: FoodClassification | null;
  }>;
  unrecognizedNames: string[];
  /** LLM 整体置信度低于阈值时,UI 提示用户补拍 */
  lowConfidence: boolean;
  modelVersion: string;
}

export type CreateMealOutcome =
  | { kind: 'ok'; result: CreateMealResult }
  | { kind: 'recognition_failed' }
  | { kind: 'low_confidence'; overallConfidence: number };

/** 用户拥有的 DEK 密文 — 由调用方提前从 users.dek_ciphertext_b64 拿到 */
export interface CreateMealParams {
  userId: string;
  userDekCiphertextB64: string;
  storageKey: string;
  ateAt?: Date;
}

export async function createMeal(deps: MealsDeps, params: CreateMealParams): Promise<CreateMealOutcome> {
  if (!params.storageKey.startsWith(`users/${params.userId}/`)) {
    throw new Error(`storageKey 必须以 users/${params.userId}/ 开头,防越权`);
  }

  const recognition = await deps.recognizer.recognize(params.storageKey);
  if (!recognition || recognition.items.length === 0) {
    return { kind: 'recognition_failed' };
  }
  if (recognition.overallConfidence < LOW_CONFIDENCE_THRESHOLD) {
    return { kind: 'low_confidence', overallConfidence: recognition.overallConfidence };
  }

  // 查每个识别项的双层分类。
  // 复合菜(如"野生菌火锅")在 DB 里通常没有 dish 级条目 → 命中 null,
  // 此时用 LLM 返回的 ingredients 主料数组逐个查、再合成 classification。
  const classifications: Array<FoodClassification | null> = [];
  for (const item of recognition.items) {
    let cls = await deps.classifierStore.findByName(item.name);
    if (!cls && item.ingredients && item.ingredients.length > 0) {
      const ingClasses: FoodClassification[] = [];
      for (const ing of item.ingredients) {
        const ingCls = await deps.classifierStore.findByName(ing);
        if (ingCls) ingClasses.push(ingCls);
      }
      if (ingClasses.length > 0) {
        cls = synthesizeFromIngredients(item.name, ingClasses);
      }
    }
    classifications.push(cls);
    if (!cls && deps.onMissingFood) {
      try {
        deps.onMissingFood(item.name);
      } catch {
        /* 队列入队失败不阻塞 */
      }
    }
  }

  const agg: MealAggregate = aggregateMeal(recognition.items, classifications);
  const western = westernSummary(classifications);

  // envelope-encrypt 用户原始识别项(发物档案需要保留个人吃了什么)
  const ciphertext = await encryptField(params.userId, params.userDekCiphertextB64, {
    items: recognition.items,
    modelVersion: recognition.modelVersion,
    overallConfidence: recognition.overallConfidence
  });

  const ateAt = params.ateAt ?? new Date();
  const mealId = await deps.mealStore.create({
    userId: params.userId,
    ateAt,
    photoOssKey: params.storageKey,
    recognizedItemsCiphertext: ciphertext,
    tcmLabelsSummary: summaryFromCounts(agg.counts),
    westernNutritionSummary: western,
    fireScore: agg.fireScore,
    sugarGrams: agg.sugarGrams
  });

  return {
    kind: 'ok',
    result: {
      mealId,
      fireScore: agg.fireScore,
      level: agg.level,
      sugarGrams: agg.sugarGrams,
      items: recognition.items.map((it, i) => ({
        name: it.name,
        confidence: it.confidence,
        classification: classifications[i]
      })),
      unrecognizedNames: agg.unrecognizedNames,
      lowConfidence: false,
      modelVersion: recognition.modelVersion
    }
  };
}

export interface AppendFeedbackParams {
  userId: string;
  mealId: string;
  itemName: string;
  kind: 'misrecognized' | 'no_reaction';
}

export async function appendMealFeedback(deps: MealsDeps, params: AppendFeedbackParams): Promise<MealRow['feedback'][number]> {
  const entry: MealRow['feedback'][number] = {
    itemName: params.itemName,
    kind: params.kind,
    at: new Date().toISOString()
  };
  await deps.mealStore.appendFeedback(params.mealId, params.userId, entry);
  return entry;
}

/**
 * 从主料 classifications 合成 dish 级 FoodClassification。
 * 用于"野生菌火锅"这类 DB 没收录但主料(野生菌、白菜、豆腐)收录了的复合菜。
 *
 * 聚合规则:
 *   - tcmLabel:取最警示的(发 > 温和 > 平),让用户对发物食材有觉察
 *   - tcmProperty:取最常见的(投票)
 *   - diiScore / agesScore / gi:数值列取均值(忽略 null)
 *   - addedSugarG / carbsG:取均值(代表"一份典型量"的口感)
 *   - citations:每个主料挑第 1 条,最多 3 条
 *   - sourceVersions.canon = 'synthesized-from-ingredients-v1'
 */
export function synthesizeFromIngredients(
  dishName: string,
  ingClasses: FoodClassification[]
): FoodClassification {
  const labelPriority: Record<string, number> = { 发: 3, 温和: 2, 平: 1 };
  const tcmLabel =
    ingClasses
      .map((c) => c.tcmLabel)
      .reduce((best, l) => (labelPriority[l] > labelPriority[best] ? l : best),
        ingClasses[0].tcmLabel);

  const propCounts: Record<string, number> = {};
  for (const c of ingClasses) propCounts[c.tcmProperty] = (propCounts[c.tcmProperty] ?? 0) + 1;
  const tcmProperty = (Object.entries(propCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ??
    ingClasses[0].tcmProperty) as FoodClassification['tcmProperty'];

  const meanOf = (vals: Array<number | null>): number | null => {
    const xs = vals.filter((v): v is number => typeof v === 'number');
    if (xs.length === 0) return null;
    return Math.round((xs.reduce((s, v) => s + v, 0) / xs.length) * 100) / 100;
  };

  const citations = ingClasses
    .flatMap((c) => (c.citations.length > 0 ? [{ ...c.citations[0], reference: `${c.foodCanonicalName} · ${c.citations[0].reference}` }] : []))
    .slice(0, 3);

  return {
    id: `synth-${dishName}`,
    foodCanonicalName: dishName,
    tcmLabel,
    tcmProperty,
    diiScore: meanOf(ingClasses.map((c) => c.diiScore)),
    agesScore: meanOf(ingClasses.map((c) => c.agesScore)),
    gi: meanOf(ingClasses.map((c) => c.gi)),
    addedSugarG: meanOf(ingClasses.map((c) => c.addedSugarG)),
    carbsG: meanOf(ingClasses.map((c) => c.carbsG)),
    citations,
    sourceVersions: { canon: 'synthesized-from-ingredients-v1' }
  };
}

export { scoreToLevel };
export * from './aggregator';
export * from './store';
