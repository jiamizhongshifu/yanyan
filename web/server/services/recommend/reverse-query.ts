/**
 * 推荐源:
 *   - pickAvoidList:从 food_classifications 取标 '发' 的食材作为"避开"清单
 *   - pickThreeMeals:从静态菜式模板库 data/recipes/v1.json 选 3 餐
 *
 * 设计变更(v2):菜式不再随机堆砌食材,而是从 hand-curated 的 ~20 个
 * 现代健康菜式模板里选 — 每条菜式有完整搭配 + 现代营养来源引用。
 *
 * 群体维度:不读用户已吃,只按 mode + slot 过滤。
 */

import { readFileSync } from 'fs';
import { join } from 'path';
import type { FoodClassifierStore, FoodClassification, Citation } from '../classifier';
import type { AvoidItem, MealOption } from './types';

const AVOID_LIMIT = 4;

function firstCitation(c: FoodClassification): Citation[] {
  return c.citations.length > 0 ? [c.citations[0]] : [];
}

export async function pickAvoidList(store: FoodClassifierStore): Promise<AvoidItem[]> {
  const fa = await store.listByLabel('发', AVOID_LIMIT);
  return fa.map((f) => ({ name: f.foodCanonicalName, citations: firstCitation(f) }));
}

interface RecipeTemplate {
  name: string;
  slot: 'breakfast' | 'lunch' | 'dinner';
  tier: 'calm' | 'mild';
  items: string[];
  citation: Citation;
}

const RECIPES_PATH = join(__dirname, '..', '..', '..', 'data', 'recipes', 'v1.json');
let cachedRecipes: RecipeTemplate[] | null = null;

function loadRecipes(): RecipeTemplate[] {
  if (cachedRecipes) return cachedRecipes;
  try {
    cachedRecipes = JSON.parse(readFileSync(RECIPES_PATH, 'utf8')) as RecipeTemplate[];
  } catch (err) {
    console.error('[recommend] failed to load recipes/v1.json', err);
    cachedRecipes = [];
  }
  return cachedRecipes;
}

/**
 * 取每天浮动但稳定的索引(同一天同一选,跨天换)
 * 用 UTC 日期做 hash 避免不同时区分裂
 */
function dailyPick<T>(pool: T[], offset = 0): T | undefined {
  if (pool.length === 0) return undefined;
  const now = new Date();
  const dayKey = Math.floor(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()) / 86400000);
  return pool[(dayKey + offset) % pool.length];
}

/**
 * 取 3 餐:从菜式库按 slot 各抽一道,优先 calm tier;若 calm 池空 → 退到 mild
 */
export async function pickThreeMeals(_store: FoodClassifierStore): Promise<MealOption[]> {
  const recipes = loadRecipes();
  const slots: Array<MealOption['slot']> = ['breakfast', 'lunch', 'dinner'];

  return slots.map((slot, idx) => {
    const calmPool = recipes.filter((r) => r.slot === slot && r.tier === 'calm');
    const mildPool = recipes.filter((r) => r.slot === slot && r.tier === 'mild');
    const pick = dailyPick(calmPool, idx) ?? dailyPick(mildPool, idx);
    if (!pick) {
      return { slot, items: [], citations: [] };
    }
    // items 第一项放菜名,之后是主料预览(前 3 项)
    return {
      slot,
      items: [pick.name, ...pick.items.slice(0, 3)],
      citations: [pick.citation]
    };
  });
}
