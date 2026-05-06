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
import type { LlmDeriver } from '../classifier';
import { encryptField } from '../../crypto/envelope';
import type { LlmFoodRecognizer } from '../recognition';
import { LOW_CONFIDENCE_THRESHOLD } from '../recognition/types';
import type { MealRow, MealStore } from './store';
import { aggregateMeal, scoreToLevel, type FireLevel, type MealAggregate, type ScoreBreakdown } from './aggregator';
import { summaryFromCounts, westernSummary } from './store';

/** auto-derive 入库的最低 confidence 阈值;低于此只用作本次显示,不持久化 */
const AUTO_DERIVE_PERSIST_CONFIDENCE = 0.6;

/** 同一进程内 in-flight derive 去重,避免并发请求重复调 LLM */
const inflightDerive = new Map<string, Promise<FoodClassification | null>>();

export interface MealsDeps {
  mealStore: MealStore;
  classifierStore: FoodClassifierStore;
  recognizer: LlmFoodRecognizer;
  /** 未识别食物名进入回填队列 */
  onMissingFood?: (name: string) => void;
  /** 可选:DB 未命中时调 LLM 派生分类 + 自动入库,空时退化到 onMissingFood */
  llmDeriver?: LlmDeriver;
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
    /** LLM 识别到的主料,前端渲染主料行 */
    ingredients?: string[];
    /** 每个主料对应的 DB 分类(matched 或 null),前端做食材成分明细 */
    ingredientDetails?: Array<{ name: string; classification: FoodClassification | null }>;
    classification: FoodClassification | null;
  }>;
  unrecognizedNames: string[];
  /** LLM 整体置信度低于阈值时,UI 提示用户补拍 */
  lowConfidence: boolean;
  modelVersion: string;
  /** 餐级火分构成,前端可显示 "+ X 中医 + Y DII + ..." 透明拆解 */
  breakdown: ScoreBreakdown;
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

/**
 * 查 DB,miss 时若有 llmDeriver 调 LLM 派生 + 高置信入库;否则返回 null
 * 同一进程并发 dedupe + 仅传入正常长度名字(过滤典型 hallucination)
 */
async function findOrDerive(
  deps: Pick<MealsDeps, 'classifierStore' | 'llmDeriver'>,
  name: string
): Promise<FoodClassification | null> {
  const cls = await deps.classifierStore.findByName(name);
  if (cls) return cls;
  if (!deps.llmDeriver) return null;
  // 过滤明显非食物名:< 2 字 / > 16 字 / 含大量数字
  const t = name.trim();
  if (t.length < 2 || t.length > 16 || /\d{2,}/.test(t)) return null;

  // 进程内 dedupe(防一次请求里多个相同食材并发调)
  if (inflightDerive.has(t)) return inflightDerive.get(t)!;
  const p = (async () => {
    try {
      const d = await deps.llmDeriver!.derive(t);
      if (!d) return null;
      // 高置信 → 入库,后续命中走缓存;低置信只用于本次显示
      if (d.confidence >= AUTO_DERIVE_PERSIST_CONFIDENCE) {
        try {
          return await deps.classifierStore.upsert({
            foodCanonicalName: t,
            tcmLabel: d.tcmLabel,
            tcmProperty: d.tcmProperty,
            diiScore: null,
            agesScore: null,
            gi: null,
            addedSugarG: d.addedSugarG ?? null,
            carbsG: d.carbsG ?? null,
            citations: d.citations,
            sourceVersions: { llmModel: d.modelVersion, autoDerivedAt: new Date().toISOString() }
          });
        } catch (err) {
          console.error('[meals] upsert auto-derive failed', t, err);
          return null;
        }
      }
      // 低置信:做一个 in-memory FoodClassification 给本次用,但不入库
      return {
        id: `auto-${t}`,
        foodCanonicalName: t,
        tcmLabel: d.tcmLabel,
        tcmProperty: d.tcmProperty,
        diiScore: null,
        agesScore: null,
        gi: null,
        addedSugarG: d.addedSugarG ?? null,
        carbsG: d.carbsG ?? null,
        citations: d.citations,
        sourceVersions: { llmModel: d.modelVersion, autoDerivedAt: new Date().toISOString() }
      };
    } catch (err) {
      console.error('[meals] llm derive failed', t, err);
      return null;
    } finally {
      inflightDerive.delete(t);
    }
  })();
  inflightDerive.set(t, p);
  return p;
}

/**
 * 给定一组 RecognizedItem,跑 dish-level + ingredient-level 分类查库 + synth + aggregate
 * 复用于 createMeal 与 updateMealItems(用户编辑后的修正)
 */
async function classifyAndAggregate(
  deps: Pick<MealsDeps, 'classifierStore' | 'onMissingFood' | 'llmDeriver'>,
  items: import('../recognition/types').RecognizedItem[]
): Promise<{
  classifications: Array<FoodClassification | null>;
  ingredientClassifications: Array<Array<{ name: string; classification: FoodClassification | null }>>;
  agg: MealAggregate;
  western: ReturnType<typeof westernSummary>;
}> {
  const classifications: Array<FoodClassification | null> = [];
  const ingredientClassifications: Array<Array<{ name: string; classification: FoodClassification | null }>> = [];
  for (const item of items) {
    let cls = await findOrDerive(deps, item.name);
    const ingDetails: Array<{ name: string; classification: FoodClassification | null }> = [];
    if (item.ingredients && item.ingredients.length > 0) {
      // 并行查 + 派生所有主料(每个最多 1 次 LLM 调用,~1-2s × 并行)
      const ingResults = await Promise.all(
        item.ingredients.map(async (ing) => {
          const c = await findOrDerive(deps, ing);
          return { name: ing, classification: c };
        })
      );
      for (const r of ingResults) {
        ingDetails.push(r);
      }
      const ingClasses = ingResults.flatMap((r) => (r.classification ? [r.classification] : []));
      if (!cls && ingClasses.length > 0) {
        cls = synthesizeFromIngredients(item.name, ingClasses, item.ingredients.length);
      }
    }
    classifications.push(cls);
    ingredientClassifications.push(ingDetails);
    if (!cls && deps.onMissingFood) {
      try {
        deps.onMissingFood(item.name);
      } catch {
        /* 入队失败不阻塞 */
      }
    }
  }
  const agg = aggregateMeal(items, classifications, ingredientClassifications);
  const western = westernSummary(classifications);
  return { classifications, ingredientClassifications, agg, western };
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

  const { classifications, ingredientClassifications, agg, western } = await classifyAndAggregate(deps, recognition.items);

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
        ingredients: it.ingredients,
        ingredientDetails: ingredientClassifications[i],
        classification: classifications[i]
      })),
      unrecognizedNames: agg.unrecognizedNames,
      lowConfidence: false,
      modelVersion: recognition.modelVersion,
      breakdown: agg.breakdown
    }
  };
}

export interface UpdateMealItemsParams {
  userId: string;
  userDekCiphertextB64: string;
  mealId: string;
  /** 用户编辑后的全量 items;server 会跑 classify + synth + aggregate + 落库 */
  items: import('../recognition/types').RecognizedItem[];
  /** 保留原 modelVersion 用于审计 */
  modelVersion: string;
}

/**
 * 用户在结果页编辑(增删主料 / 加新菜)后调用
 * 全量替换 recognized items,重新跑 classify + synth + aggregate,UPDATE 落库
 */
export async function updateMealItems(
  deps: MealsDeps,
  params: UpdateMealItemsParams
): Promise<CreateMealResult | null> {
  if (params.items.length === 0) return null;

  const { classifications, ingredientClassifications, agg, western } = await classifyAndAggregate(
    deps,
    params.items
  );

  const ciphertext = await encryptField(params.userId, params.userDekCiphertextB64, {
    items: params.items,
    modelVersion: params.modelVersion,
    overallConfidence: 1, // 用户编辑过的视为高置信
    editedAt: new Date().toISOString()
  });

  await deps.mealStore.updateAfterRecompute(params.mealId, params.userId, {
    recognizedItemsCiphertext: ciphertext,
    tcmLabelsSummary: summaryFromCounts(agg.counts),
    westernNutritionSummary: western,
    fireScore: agg.fireScore,
    sugarGrams: agg.sugarGrams
  });

  return {
    mealId: params.mealId,
    fireScore: agg.fireScore,
    level: agg.level,
    sugarGrams: agg.sugarGrams,
    items: params.items.map((it, i) => ({
      name: it.name,
      confidence: it.confidence,
      ingredients: it.ingredients,
      ingredientDetails: ingredientClassifications[i],
      classification: classifications[i]
    })),
    unrecognizedNames: agg.unrecognizedNames,
    lowConfidence: false,
    modelVersion: params.modelVersion,
    breakdown: agg.breakdown
  };
}

export interface AppendFeedbackParams {
  userId: string;
  mealId: string;
  itemName: string;
  kind: 'misrecognized' | 'no_reaction' | 'thumbs_up' | 'thumbs_down';
  /** 文字反馈(thumbs_down 通常带,其它可选) */
  note?: string;
}

export async function appendMealFeedback(deps: MealsDeps, params: AppendFeedbackParams): Promise<MealRow['feedback'][number]> {
  const entry: MealRow['feedback'][number] = {
    itemName: params.itemName,
    kind: params.kind,
    at: new Date().toISOString(),
    ...(params.note ? { note: params.note } : {})
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
  ingClasses: FoodClassification[],
  totalIngredientCount?: number
): FoodClassification {
  // tcmLabel 投票:已匹配食材按真实 label,未匹配食材当 温和(中性)算入投票。
  // 这样:
  //   - 1/5 食材标'发' 不会一票否决,但也不会假装一切都"平";
  //   - 数据稀疏时整体偏中性(温和),fireScore 落在 40 附近(微火/微暖),用户看到的是"中等"而不是"最差/最好"。
  const total = Math.max(totalIngredientCount ?? ingClasses.length, ingClasses.length);
  const unmatched = Math.max(0, total - ingClasses.length);
  const labelCounts: Record<string, number> = { 平: 0, 温和: unmatched, 发: 0 };
  for (const c of ingClasses) labelCounts[c.tcmLabel] = (labelCounts[c.tcmLabel] ?? 0) + 1;
  const labelTiePriority: Record<string, number> = { 平: 3, 温和: 2, 发: 1 };
  const tcmLabel = (Object.entries(labelCounts).sort(
    (a, b) => b[1] - a[1] || labelTiePriority[b[0]] - labelTiePriority[a[0]]
  )[0]?.[0] ?? '温和') as FoodClassification['tcmLabel'];

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
