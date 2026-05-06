/**
 * LLM 个性化推荐 — 缓存命中 / LLM 路径 / fallback 路径 / 写缓存
 */

import { buildTodayRecommendation } from '../../server/services/recommend';
import type { LlmTextClient, ChatCompletionRequest, ChatCompletionResponse } from '../../server/services/llm/deepseek';
import type { FoodClassification, FoodClassifierStore, TcmLabel, UpsertParams } from '../../server/services/classifier';
import type { MealRow, MealStore } from '../../server/services/meals';
import type { CreateMealParams as StoreCreateMealParams } from '../../server/services/meals/store';
import type { UserStore, UserRow } from '../../server/services/users/store';
import type { OnboardingBaseline } from '../../server/services/users/types';

class FakeClassifier implements FoodClassifierStore {
  rows = new Map<string, FoodClassification>();
  async findByName(n: string) { return this.rows.get(n) ?? null; }
  async upsert(p: UpsertParams) {
    const c: FoodClassification = {
      id: `f-${this.rows.size + 1}`,
      foodCanonicalName: p.foodCanonicalName,
      tcmLabel: p.tcmLabel,
      tcmProperty: p.tcmProperty,
      diiScore: p.diiScore ?? null,
      agesScore: p.agesScore ?? null,
      gi: p.gi ?? null,
      citations: p.citations,
      sourceVersions: p.sourceVersions
    };
    this.rows.set(p.foodCanonicalName, c);
    return c;
  }
  async count() { return this.rows.size; }
  async countWithCitations() { return 0; }
  async listByLabel(label: TcmLabel, limit: number): Promise<FoodClassification[]> {
    return [...this.rows.values()].filter((r) => r.tcmLabel === label).slice(0, limit);
  }
}

class FakeMealStore implements MealStore {
  rows: MealRow[] = [];
  async create(_p: StoreCreateMealParams) { return 'm'; }
  async findById() { return null; }
  async listByDate(uid: string, date: string) {
    return this.rows.filter((r) => r.userId === uid && r.ateAt.toISOString().slice(0, 10) === date);
  }
  async listInRange() { return []; }
  async appendFeedback() { /* noop */ }
}

class FakeUserStore implements UserStore {
  baseline: OnboardingBaseline | null = {
    reverseFilterChoice: 'rhinitis',
    symptomsFrequency: { nasal_congestion: 'often' }
  };
  cache: { date: string; payload: unknown } | null = null;
  cacheWrites = 0;
  async findByOpenid() { return null; }
  async findById(id: string): Promise<UserRow | null> {
    return {
      id, wxOpenid: 'x', consentVersionGranted: 1,
      baselineSummary: this.baseline as unknown as Record<string, unknown>,
      deletedAt: null
    };
  }
  async createUser() { return 'u'; }
  async createUserById() { /* noop */ }
  async updateBaseline() { /* noop */ }
  async getCachedRecommendation(_userId: string, date: string) {
    if (this.cache && this.cache.date === date) return this.cache.payload;
    return null;
  }
  async setCachedRecommendation(_userId: string, date: string, payload: unknown) {
    this.cache = { date, payload };
    this.cacheWrites++;
  }
}

function fakeLlm(content: string, calls: { n: number }): LlmTextClient {
  return {
    modelVersion: 'fake',
    async complete(_req: ChatCompletionRequest): Promise<ChatCompletionResponse> {
      calls.n++;
      return { content, modelVersion: 'fake', latencyMs: 1 };
    }
  };
}

function seedClassifier(s: FakeClassifier) {
  const cite = [{ source: 'canon' as const, reference: '《本草纲目》' }];
  for (const n of ['辣椒', '虾']) void s.upsert({ foodCanonicalName: n, tcmLabel: '发', tcmProperty: '热', citations: cite, sourceVersions: {} });
}

function seedMeal(store: FakeMealStore, ateAt: Date, fa: number) {
  store.rows.push({
    id: `m-${store.rows.length + 1}`,
    userId: 'u1',
    ateAt,
    photoOssKey: null,
    recognizedItemsCiphertext: 'x',
    tcmLabelsSummary: { 发: fa, 温和: 0, 平: 1, unknown: 0 },
    westernNutritionSummary: {},
    fireScore: 60,
    sugarGrams: null,
    feedback: [],
    createdAt: new Date()
  });
}

const NOW = new Date('2026-05-04T03:00:00Z');

describe('personalized recommendation', () => {
  test('cache hit:不调 LLM,直接返回', async () => {
    const userStore = new FakeUserStore();
    const cached = { mode: 'mild_balanced', headline: 'cached', tagline: 't', avoid: [], meals: [], basis: { fa: 0, mild: 0, calm: 0, days: 1 } };
    userStore.cache = { date: '2026-05-04', payload: cached };
    const calls = { n: 0 };
    const result = await buildTodayRecommendation(
      {
        mealStore: new FakeMealStore(),
        classifierStore: new FakeClassifier(),
        userStore,
        llm: fakeLlm('{}', calls),
        now: () => NOW
      },
      'u1'
    );
    expect(result.headline).toBe('cached');
    expect(calls.n).toBe(0);
    expect(userStore.cacheWrites).toBe(0);
  });

  test('LLM 路径:有数据 + 合法 JSON → 用 LLM 输出 + 写缓存', async () => {
    const meals = new FakeMealStore();
    seedMeal(meals, new Date('2026-05-04T08:00:00Z'), 3);
    seedMeal(meals, new Date('2026-05-03T08:00:00Z'), 2);
    const llmJson = JSON.stringify({
      mode: 'fa_heavy',
      headline: '近 3 天偏炎症 — 给你换换餐',
      tagline: '今天少踩促炎食材,优先 omega-3 + 高纤维。',
      avoid_focus: [
        { name: '辣椒', reason: '辣椒素 + 高辣度提升黏膜炎症,你鼻塞经常发,先避开' }
      ],
      picks: [
        { slot: 'breakfast', recipe_name: '燕麦坚果碗', why_for_user: '高纤维 + 坚果 omega-3,适合慢性鼻黏膜状态', swap: null },
        { slot: 'lunch', recipe_name: '三文鱼藜麦碗', why_for_user: 'EPA/DHA 直击炎症通路,藜麦低 GI', swap: null },
        { slot: 'dinner', recipe_name: '清蒸鲈鱼 + 凉拌菠娘', why_for_user: 'invalid recipe', swap: null }
      ]
    });
    // 故意把第 3 个 recipe_name 写错 → 验证失败 → fallback 到 template
    const userStore = new FakeUserStore();
    const classifier = new FakeClassifier();
    seedClassifier(classifier);
    const calls = { n: 0 };
    const result = await buildTodayRecommendation(
      {
        mealStore: meals,
        classifierStore: classifier,
        userStore,
        llm: fakeLlm(llmJson, calls),
        now: () => NOW
      },
      'u1'
    );
    expect(calls.n).toBe(1);
    // 第 3 个 recipe 不存在 → validation 失败 → 走 template
    expect(result.headline).not.toBe('近 3 天偏炎症 — 给你换换餐');
    // template 仍然写缓存
    expect(userStore.cacheWrites).toBe(1);
  });

  test('LLM 路径:全部 recipe_name 合法 → 用 LLM 输出', async () => {
    const meals = new FakeMealStore();
    seedMeal(meals, new Date('2026-05-04T08:00:00Z'), 3);
    const llmJson = JSON.stringify({
      mode: 'fa_heavy',
      headline: '近期偏炎症,今天换组合',
      tagline: '低 GI + omega-3 优先。',
      avoid_focus: [{ name: '虾', reason: '部分人群 IgE 反应' }],
      picks: [
        { slot: 'breakfast', recipe_name: '燕麦坚果碗', why_for_user: '坚果 omega-3 + 全谷物,稳血糖', swap: null },
        { slot: 'lunch', recipe_name: '三文鱼藜麦碗', why_for_user: 'EPA/DHA + 完整蛋白', swap: null },
        { slot: 'dinner', recipe_name: '豆腐海带汤 + 杂粮饭', why_for_user: '植物蛋白 + 海带矿物质,清淡收尾', swap: null }
      ]
    });
    const userStore = new FakeUserStore();
    const calls = { n: 0 };
    const result = await buildTodayRecommendation(
      {
        mealStore: meals,
        classifierStore: new FakeClassifier(),
        userStore,
        llm: fakeLlm(llmJson, calls),
        now: () => NOW
      },
      'u1'
    );
    expect(calls.n).toBe(1);
    expect(result.headline).toBe('近期偏炎症,今天换组合');
    expect(result.meals.map((m) => m.slot).sort()).toEqual(['breakfast', 'dinner', 'lunch']);
    expect(result.meals[0].items[0]).toBe('燕麦坚果碗');
    expect(result.avoid).toHaveLength(1);
    expect(result.avoid[0].name).toBe('虾');
    expect(userStore.cacheWrites).toBe(1);
  });

  test('insufficient_data(0 餐):跳过 LLM 调用,直接 template', async () => {
    const userStore = new FakeUserStore();
    const calls = { n: 0 };
    const result = await buildTodayRecommendation(
      {
        mealStore: new FakeMealStore(),
        classifierStore: new FakeClassifier(),
        userStore,
        llm: fakeLlm('{}', calls),
        now: () => NOW
      },
      'u1'
    );
    expect(calls.n).toBe(0); // generator 早退,没调 LLM
    expect(result.mode).toBe('insufficient_data');
  });

  test('LLM 抛错:fallback 到 template 不报错', async () => {
    const meals = new FakeMealStore();
    seedMeal(meals, new Date('2026-05-04T08:00:00Z'), 2);
    const userStore = new FakeUserStore();
    const llm: LlmTextClient = {
      modelVersion: 'fake',
      async complete() { throw new Error('LLM down'); }
    };
    const result = await buildTodayRecommendation(
      {
        mealStore: meals,
        classifierStore: new FakeClassifier(),
        userStore,
        llm,
        now: () => NOW
      },
      'u1'
    );
    expect(result).toBeTruthy();
    expect(result.meals).toHaveLength(3); // template 仍给 3 餐
  });
});
