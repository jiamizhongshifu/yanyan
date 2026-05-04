/**
 * 反向查 food_classifications:按 tcm_label 取代表性条目
 *
 * 群体维度:不依赖具体用户已吃过什么(那需要解密 recognized_items_ciphertext),
 * 而是用人群层面的"常见发物 / 常见平和食物"作为推荐来源,符合 plan U13a
 * "所有推荐只用群体维度,不做个体化"的边界。
 *
 * 早 / 午 / 晚 模板按食材类型常识划分:粥/蛋类 → 早,主菜/汤 → 午晚。
 * 这是 v1 简化模板;Phase 2 可接入 LLM 生成或人工运营推荐位。
 */

import type { FoodClassifierStore, FoodClassification, Citation } from '../classifier';
import type { AvoidItem, MealOption } from './types';

const AVOID_LIMIT = 4;
const MILD_POOL_LIMIT = 12;
const CALM_POOL_LIMIT = 12;

/** 取头一条引用做卡片配文(UI 单卡只展示 1 条) */
function firstCitation(c: FoodClassification): Citation[] {
  return c.citations.length > 0 ? [c.citations[0]] : [];
}

export async function pickAvoidList(store: FoodClassifierStore): Promise<AvoidItem[]> {
  const fa = await store.listByLabel('发', AVOID_LIMIT);
  return fa.map((f) => ({ name: f.foodCanonicalName, citations: firstCitation(f) }));
}

/**
 * 通用 3 餐模板 — 优先从"平"取主食 + 早餐,从"温和"取主菜
 */
export async function pickThreeMeals(store: FoodClassifierStore): Promise<MealOption[]> {
  const [calmPool, mildPool] = await Promise.all([
    store.listByLabel('平', CALM_POOL_LIMIT),
    store.listByLabel('温和', MILD_POOL_LIMIT)
  ]);

  // 简化:按池子顺序轮转分配,保证每餐 3-4 项 + 至少 1 条引用
  const calmNames = calmPool.map((c) => c.foodCanonicalName);
  const mildNames = mildPool.map((c) => c.foodCanonicalName);
  const calmCit = calmPool.flatMap((c) => firstCitation(c));
  const mildCit = mildPool.flatMap((c) => firstCitation(c));

  const slots: MealOption['slot'][] = ['breakfast', 'lunch', 'dinner'];
  const meals: MealOption[] = [];

  for (let i = 0; i < 3; i++) {
    // 每餐 3-4 项:1-2 个"平"主食/底 + 1-2 个"温和"配菜
    const calmStart = (i * 2) % Math.max(calmNames.length, 1);
    const mildStart = (i * 2) % Math.max(mildNames.length, 1);
    const calmPick = calmNames.slice(calmStart, calmStart + 2);
    const mildPick = mildNames.slice(mildStart, mildStart + 2);
    const items = [...calmPick, ...mildPick].filter((s, idx, arr) => arr.indexOf(s) === idx).slice(0, 4);
    const citations = [calmCit[i], mildCit[i]].filter((c): c is Citation => Boolean(c)).slice(0, 1);
    meals.push({ slot: slots[i], items, citations });
  }
  return meals;
}
