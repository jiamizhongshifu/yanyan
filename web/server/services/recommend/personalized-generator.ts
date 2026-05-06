/**
 * LLM 个性化推荐 generator(Phase C 混合方案)
 *
 * 输入:用户最近 7 天餐食 fire-score 分布 + onboarding baseline + 菜式 catalog
 * 输出:LLM 选 3 道菜(锚定到 catalog) + 个性化 headline / tagline / 避开建议 + swap 提示
 *
 * 失败兜底:任何环节失败(LLM 报错/JSON 解析失败/recipe_name 不在 catalog)→ 返回 null,
 * 上游退化到 template 模板逻辑。
 */

import { readFileSync } from 'fs';
import { join } from 'path';
import type { LlmTextClient } from '../llm/deepseek';
import type { MealStore, MealRow } from '../meals';
import type { OnboardingBaseline, SymptomDimension, SymptomFrequency } from '../users/types';
import type { Citation } from '../classifier';
import type { TodayRecommendation, MealOption, AvoidItem, RecommendMode } from './types';

const RECIPES_PATH = join(__dirname, '..', '..', '..', 'data', 'recipes', 'v1.json');
const RECENT_DAYS = 7;

interface RecipeTemplate {
  name: string;
  slot: 'breakfast' | 'lunch' | 'dinner';
  tier: 'calm' | 'mild';
  items: string[];
  citation: Citation;
}

let cachedRecipes: RecipeTemplate[] | null = null;
function loadRecipes(): RecipeTemplate[] {
  if (cachedRecipes) return cachedRecipes;
  cachedRecipes = JSON.parse(readFileSync(RECIPES_PATH, 'utf8')) as RecipeTemplate[];
  return cachedRecipes;
}

const SYMPTOM_LABELS: Record<SymptomDimension, string> = {
  nasal_congestion: '鼻塞',
  acne: '起痘',
  dry_mouth: '口干',
  bowel: '大便异常',
  fatigue: '困倦',
  edema: '浮肿',
  throat_itch: '喉咙痒'
};
const FREQ_LABELS: Record<SymptomFrequency, string> = {
  rare: '几乎没有',
  sometimes: '偶尔',
  often: '经常'
};
const REVERSE_LABELS: Record<string, string> = {
  rhinitis: '改善鼻炎',
  blood_sugar: '改善血糖',
  uric_acid: '改善尿酸',
  checkup_abnormal: '改善体检异常',
  curious: '探索体质'
};

interface DayBrief {
  date: string;
  fa: number;
  mild: number;
  calm: number;
  mealsCount: number;
  avgFireScore: number | null;
}

function dayKey(d: Date, deltaDays: number): string {
  const x = new Date(d.getTime());
  x.setUTCDate(x.getUTCDate() - deltaDays);
  return x.toISOString().slice(0, 10);
}

async function summarizeRecentDays(
  mealStore: MealStore,
  userId: string,
  now: Date
): Promise<{ days: DayBrief[]; total: { fa: number; mild: number; calm: number; daysWithMeals: number } }> {
  const days: DayBrief[] = [];
  let fa = 0, mild = 0, calm = 0, daysWithMeals = 0;
  for (let i = 0; i < RECENT_DAYS; i++) {
    const key = dayKey(now, i);
    const meals = await mealStore.listByDate(userId, key);
    let dFa = 0, dMild = 0, dCalm = 0;
    let scoreSum = 0, scoreN = 0;
    for (const m of meals) {
      dFa += m.tcmLabelsSummary['发'] ?? 0;
      dMild += m.tcmLabelsSummary['温和'] ?? 0;
      dCalm += m.tcmLabelsSummary['平'] ?? 0;
      if (m.fireScore !== null) {
        scoreSum += m.fireScore;
        scoreN += 1;
      }
    }
    if (meals.length > 0) {
      daysWithMeals += 1;
      fa += dFa; mild += dMild; calm += dCalm;
    }
    days.push({
      date: key,
      fa: dFa, mild: dMild, calm: dCalm,
      mealsCount: meals.length,
      avgFireScore: scoreN > 0 ? Number((scoreSum / scoreN).toFixed(2)) : null
    });
  }
  return { days, total: { fa, mild, calm, daysWithMeals } };
}

function profileToText(baseline: OnboardingBaseline | null): string {
  if (!baseline) return '(无 onboarding 资料)';
  const lines: string[] = [];
  if (baseline.reverseFilterChoice) {
    lines.push(`目标:${REVERSE_LABELS[baseline.reverseFilterChoice] ?? baseline.reverseFilterChoice}`);
  }
  const sympEntries: string[] = [];
  for (const dim of Object.keys(baseline.symptomsFrequency ?? {}) as SymptomDimension[]) {
    const freq = baseline.symptomsFrequency[dim];
    if (!freq) continue;
    sympEntries.push(`${SYMPTOM_LABELS[dim]}=${FREQ_LABELS[freq]}`);
  }
  if (sympEntries.length > 0) lines.push(`症状基线:${sympEntries.join(',')}`);
  return lines.length > 0 ? lines.join('\n') : '(无 onboarding 资料)';
}

function recipesToCatalogText(recipes: RecipeTemplate[]): string {
  return recipes
    .map((r, i) => `${i + 1}. [${r.slot}/${r.tier}] ${r.name} — 主料:${r.items.join('、')}(来源:${r.citation.reference})`)
    .join('\n');
}

function buildPrompt(
  baseline: OnboardingBaseline | null,
  daysSummary: Awaited<ReturnType<typeof summarizeRecentDays>>,
  recipes: RecipeTemplate[]
): string {
  const profile = profileToText(baseline);
  const recentLines = daysSummary.days
    .map((d) => `${d.date}: 餐数=${d.mealsCount}, 发=${d.fa}, 温和=${d.mild}, 平=${d.calm}, 平均火分=${d.avgFireScore ?? 'N/A'}`)
    .join('\n');
  const catalog = recipesToCatalogText(recipes);
  return `用户档案:
${profile}

近 7 天饮食概况(发=促炎食材命中, 温和/平=低 GI/低炎食材命中, 火分 0-100 越高越偏炎症):
${recentLines}

可选菜式 catalog(必须从中挑选 3 道,早/午/晚 各 1):
${catalog}

任务:
基于用户的目标 + 症状基线 + 近 7 天数据,从 catalog 中选 3 道菜(早/午/晚 各 1),并给出个性化解释。

输出严格 JSON(不要 markdown / 不要解释,直接 { 开头):
{
  "mode": "fa_heavy" | "mild_balanced" | "all_calm" | "insufficient_data",
  "headline": "一句话总结当前状态(15-25 字,口语化)",
  "tagline": "一句鼓励或提醒文案(20-40 字,提具体可执行建议)",
  "avoid_focus": [
    {"name": "食材名", "reason": "为什么对这个用户要先少吃(20-40 字)"}
  ],
  "picks": [
    {
      "slot": "breakfast",
      "recipe_name": "燕麦坚果碗",
      "why_for_user": "这一道对你为什么合适(30-50 字,引用用户的目标或症状)",
      "swap": null
    }
  ]
}

约束:
- recipe_name 必须 完全匹配 catalog 中的某一项
- picks 必须包含 breakfast / lunch / dinner 各 1 道
- avoid_focus 在 mode=fa_heavy 时给 2-3 项;其它模式可以为空数组 []
- swap 是可选字段,如果你想建议替换一个食材,填 {"from": "原食材", "to": "替换食材", "why": "原因"};否则填 null
- mode 选择:
  · 7 天数据少于 1 天 → "insufficient_data"
  · 发≥(温和+平)/2 且 发>0 → "fa_heavy"
  · 发=0 且 温和=0 → "all_calm"
  · 其它 → "mild_balanced"
- tagline 不要套用模板,要根据用户具体状态写
- 不要使用古文 / 中医典籍引用,用现代营养语言`;
}

interface LlmPick {
  slot: 'breakfast' | 'lunch' | 'dinner';
  recipe_name: string;
  why_for_user: string;
  swap: { from: string; to: string; why: string } | null;
}

interface LlmOutput {
  mode: RecommendMode;
  headline: string;
  tagline: string;
  avoid_focus: Array<{ name: string; reason: string }>;
  picks: LlmPick[];
}

const VALID_MODES: RecommendMode[] = ['fa_heavy', 'mild_balanced', 'all_calm', 'insufficient_data'];
const VALID_SLOTS = ['breakfast', 'lunch', 'dinner'] as const;

function parseAndValidate(content: string, recipes: RecipeTemplate[]): LlmOutput | null {
  // 抽出第一个 { 到最后一个 } 之间(LLM 偶尔会前后加废话/代码块)
  const start = content.indexOf('{');
  const end = content.lastIndexOf('}');
  if (start < 0 || end < 0 || end <= start) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(content.slice(start, end + 1));
  } catch {
    return null;
  }
  if (typeof parsed !== 'object' || parsed === null) return null;
  const o = parsed as Record<string, unknown>;
  if (!VALID_MODES.includes(o.mode as RecommendMode)) return null;
  if (typeof o.headline !== 'string' || typeof o.tagline !== 'string') return null;
  if (!Array.isArray(o.picks) || o.picks.length !== 3) return null;
  const picks: LlmPick[] = [];
  const seenSlots = new Set<string>();
  for (const p of o.picks) {
    if (typeof p !== 'object' || p === null) return null;
    const pp = p as Record<string, unknown>;
    if (!VALID_SLOTS.includes(pp.slot as 'breakfast' | 'lunch' | 'dinner')) return null;
    if (seenSlots.has(pp.slot as string)) return null;
    seenSlots.add(pp.slot as string);
    if (typeof pp.recipe_name !== 'string') return null;
    const recipe = recipes.find((r) => r.name === pp.recipe_name && r.slot === pp.slot);
    if (!recipe) return null;
    if (typeof pp.why_for_user !== 'string') return null;
    let swap: LlmPick['swap'] = null;
    if (pp.swap && typeof pp.swap === 'object') {
      const s = pp.swap as Record<string, unknown>;
      if (typeof s.from === 'string' && typeof s.to === 'string' && typeof s.why === 'string') {
        swap = { from: s.from, to: s.to, why: s.why };
      }
    }
    picks.push({
      slot: pp.slot as 'breakfast' | 'lunch' | 'dinner',
      recipe_name: pp.recipe_name,
      why_for_user: pp.why_for_user,
      swap
    });
  }
  if (seenSlots.size !== 3) return null;
  const avoid: LlmOutput['avoid_focus'] = [];
  if (Array.isArray(o.avoid_focus)) {
    for (const a of o.avoid_focus) {
      if (typeof a === 'object' && a !== null) {
        const aa = a as Record<string, unknown>;
        if (typeof aa.name === 'string' && typeof aa.reason === 'string') {
          avoid.push({ name: aa.name, reason: aa.reason });
        }
      }
    }
  }
  return {
    mode: o.mode as RecommendMode,
    headline: o.headline,
    tagline: o.tagline,
    avoid_focus: avoid,
    picks
  };
}

function llmOutputToRecommendation(
  llm: LlmOutput,
  recipes: RecipeTemplate[],
  basis: { fa: number; mild: number; calm: number; days: number }
): TodayRecommendation {
  const meals: MealOption[] = llm.picks.map((p) => {
    const recipe = recipes.find((r) => r.name === p.recipe_name && r.slot === p.slot)!;
    // items[0] = 菜名;后续 = 主料预览 + 个性化原因(以 · 拼到一起在 UI 显示太长,改成把 why 放进 citation reference 之前)
    // 简单起见:items 还是 [菜名, ...主料前 3] —— why_for_user 写到一条新的 citation excerpt 字段供前端展示
    const baseItems = [recipe.name, ...recipe.items.slice(0, 3)];
    const personalized: Citation = {
      source: recipe.citation.source,
      reference: recipe.citation.reference,
      excerpt: p.why_for_user
    } as Citation;
    return { slot: p.slot, items: baseItems, citations: [personalized] };
  });
  const avoid: AvoidItem[] = llm.avoid_focus.map((a) => ({
    name: a.name,
    citations: [{ source: 'modern_nutrition', reference: a.reason } as Citation]
  }));
  return {
    mode: llm.mode,
    headline: llm.headline,
    tagline: llm.tagline,
    avoid,
    meals,
    basis
  };
}

export interface PersonalizedGeneratorDeps {
  mealStore: MealStore;
  llm: LlmTextClient;
  baseline: OnboardingBaseline | null;
  now?: () => Date;
}

/**
 * 主入口。返回 null 表示生成失败,上游应 fallback 到 template。
 */
export async function generatePersonalizedRecommendation(
  deps: PersonalizedGeneratorDeps,
  userId: string
): Promise<TodayRecommendation | null> {
  const now = deps.now?.() ?? new Date();
  const recipes = loadRecipes();
  if (recipes.length === 0) return null;

  let summary;
  try {
    summary = await summarizeRecentDays(deps.mealStore, userId, now);
  } catch (err) {
    console.warn('[personalized-generator] summarize failed', err);
    return null;
  }

  // 数据不足直接交回 template(它有专门 insufficient_data 文案,不需 LLM)
  if (summary.total.daysWithMeals < 1) return null;

  const prompt = buildPrompt(deps.baseline, summary, recipes);

  let resp;
  try {
    resp = await deps.llm.complete({
      messages: [{ role: 'user', content: prompt }],
      system: '你是一名临床营养师,基于现代膳食指南给个性化抗炎饮食建议。回答仅输出严格 JSON。',
      temperature: 0.4,
      maxTokens: 1500,
      jsonMode: true
    });
  } catch (err) {
    console.warn('[personalized-generator] LLM call failed', err);
    return null;
  }

  const llm = parseAndValidate(resp.content, recipes);
  if (!llm) {
    console.warn('[personalized-generator] LLM output validation failed; falling back', resp.content.slice(0, 200));
    return null;
  }

  return llmOutputToRecommendation(llm, recipes, {
    fa: summary.total.fa,
    mild: summary.total.mild,
    calm: summary.total.calm,
    days: Math.min(summary.total.daysWithMeals, 7)
  });
}
