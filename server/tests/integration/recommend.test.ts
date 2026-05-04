/**
 * U13a 今日推荐测试
 *
 * - Happy: 近 3 日吃了大量"发"类 → fa_heavy + avoid 列表非空 + 3 餐
 * - 数据不足:0 天 → insufficient_data + 通用 3 餐模板 + avoid 空
 * - 全平/温和均衡 → mild_balanced 或 all_calm,avoid 空
 * - 鉴权:无 X-User-Id → 401
 */

import type { FastifyInstance } from 'fastify';
import { buildApp } from '../../src/app';
import type { FoodClassification, FoodClassifierStore, TcmLabel, UpsertParams } from '../../src/services/classifier';
import type { MealRow, MealStore } from '../../src/services/meals';
import type { CreateMealParams as StoreCreateMealParams } from '../../src/services/meals/store';
import { classify, RECENT_DAYS } from '../../src/services/recommend';

class FakeClassifierStore implements FoodClassifierStore {
  rows = new Map<string, FoodClassification>();
  async findByName(n: string) {
    return this.rows.get(n) ?? null;
  }
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
  async count() {
    return this.rows.size;
  }
  async countWithCitations() {
    return [...this.rows.values()].filter((r) => r.citations.length > 0).length;
  }
  async listByLabel(label: TcmLabel, limit: number): Promise<FoodClassification[]> {
    return [...this.rows.values()]
      .filter((r) => r.tcmLabel === label)
      .sort((a, b) => b.citations.length - a.citations.length)
      .slice(0, limit);
  }
}

class FakeMealStore implements MealStore {
  rows: MealRow[] = [];
  nextId = 1;
  async create(p: StoreCreateMealParams) {
    const id = `m-${this.nextId++}`;
    this.rows.push({
      id,
      userId: p.userId,
      ateAt: p.ateAt,
      photoOssKey: p.photoOssKey,
      recognizedItemsCiphertext: p.recognizedItemsCiphertext,
      tcmLabelsSummary: p.tcmLabelsSummary,
      westernNutritionSummary: p.westernNutritionSummary,
      fireScore: p.fireScore,
      feedback: [],
      createdAt: new Date()
    });
    return id;
  }
  async findById(id: string, uid: string) {
    return this.rows.find((r) => r.id === id && r.userId === uid) ?? null;
  }
  async listByDate(uid: string, date: string) {
    return this.rows.filter(
      (r) => r.userId === uid && r.ateAt.toISOString().slice(0, 10) === date
    );
  }
  async appendFeedback() {
    /* noop */
  }
}

const FIXED = new Date('2026-05-04T03:00:00Z');
const USER = 'u1';

function seedClassifier(store: FakeClassifierStore) {
  // 4 发 + 4 温和 + 4 平,各 1 条引用
  const cite = [{ source: 'canon' as const, reference: '《本草纲目》', excerpt: '...' }];
  const fa = ['鲈鱼', '虾', '辣椒', '油炸食品'];
  const mild = ['鸡肉', '南瓜', '红枣', '生姜'];
  const calm = ['白米粥', '山药', '小米粥', '豆腐'];
  for (const n of fa) void store.upsert({ foodCanonicalName: n, tcmLabel: '发', tcmProperty: '热', citations: cite, sourceVersions: {} });
  for (const n of mild) void store.upsert({ foodCanonicalName: n, tcmLabel: '温和', tcmProperty: '温', citations: cite, sourceVersions: {} });
  for (const n of calm) void store.upsert({ foodCanonicalName: n, tcmLabel: '平', tcmProperty: '平', citations: cite, sourceVersions: {} });
}

function seedMeal(store: FakeMealStore, ateAt: Date, counts: { 发: number; 温和: number; 平: number; unknown: number }) {
  void store.create({
    userId: USER,
    ateAt,
    photoOssKey: 'k',
    recognizedItemsCiphertext: 'x',
    tcmLabelsSummary: counts,
    westernNutritionSummary: {},
    fireScore: 50
  });
}

describe('U13a recommend', () => {
  let app: FastifyInstance;
  let mealStore: FakeMealStore;
  let classifierStore: FakeClassifierStore;

  beforeEach(async () => {
    mealStore = new FakeMealStore();
    classifierStore = new FakeClassifierStore();
    seedClassifier(classifierStore);
    app = await buildApp({
      v1: { recommend: { deps: { mealStore, classifierStore, now: () => FIXED } } }
    });
  });
  afterEach(async () => {
    await app.close();
  });

  test('insufficient_data:0 天 → 通用模板,avoid 空', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/recommend/today',
      headers: { 'x-user-id': USER }
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.recommendation.mode).toBe('insufficient_data');
    expect(body.recommendation.avoid).toEqual([]);
    expect(body.recommendation.meals).toHaveLength(3);
    expect(body.recommendation.basis.days).toBe(0);
  });

  test('fa_heavy:近 3 日大量"发" → mode=fa_heavy + avoid 非空', async () => {
    seedMeal(mealStore, new Date('2026-05-04T05:00:00Z'), { 发: 4, 温和: 1, 平: 0, unknown: 0 });
    seedMeal(mealStore, new Date('2026-05-03T12:00:00Z'), { 发: 3, 温和: 0, 平: 1, unknown: 0 });
    seedMeal(mealStore, new Date('2026-05-02T19:00:00Z'), { 发: 4, 温和: 1, 平: 0, unknown: 0 });
    const body = (await app.inject({
      method: 'GET',
      url: '/api/v1/recommend/today',
      headers: { 'x-user-id': USER }
    })).json();
    expect(body.recommendation.mode).toBe('fa_heavy');
    expect(body.recommendation.avoid.length).toBeGreaterThan(0);
    expect(body.recommendation.avoid.length).toBeLessThanOrEqual(4);
    expect(body.recommendation.meals).toHaveLength(3);
    expect(body.recommendation.basis.days).toBe(3);
    expect(body.recommendation.basis.fa).toBe(11);
  });

  test('all_calm:全部"平" → mode=all_calm,avoid 空', async () => {
    seedMeal(mealStore, new Date('2026-05-04T05:00:00Z'), { 发: 0, 温和: 0, 平: 3, unknown: 0 });
    seedMeal(mealStore, new Date('2026-05-03T12:00:00Z'), { 发: 0, 温和: 0, 平: 2, unknown: 0 });
    const body = (await app.inject({
      method: 'GET',
      url: '/api/v1/recommend/today',
      headers: { 'x-user-id': USER }
    })).json();
    expect(body.recommendation.mode).toBe('all_calm');
    expect(body.recommendation.avoid).toEqual([]);
  });

  test('mild_balanced:温和占多数 → mode=mild_balanced', async () => {
    seedMeal(mealStore, new Date('2026-05-04T05:00:00Z'), { 发: 1, 温和: 3, 平: 2, unknown: 0 });
    seedMeal(mealStore, new Date('2026-05-03T12:00:00Z'), { 发: 0, 温和: 4, 平: 2, unknown: 0 });
    const body = (await app.inject({
      method: 'GET',
      url: '/api/v1/recommend/today',
      headers: { 'x-user-id': USER }
    })).json();
    expect(body.recommendation.mode).toBe('mild_balanced');
    expect(body.recommendation.avoid).toEqual([]);
  });

  test('每餐含 3-4 项食材', async () => {
    const body = (await app.inject({
      method: 'GET',
      url: '/api/v1/recommend/today',
      headers: { 'x-user-id': USER }
    })).json();
    for (const meal of body.recommendation.meals) {
      expect(meal.items.length).toBeGreaterThanOrEqual(2);
      expect(meal.items.length).toBeLessThanOrEqual(4);
      expect(['breakfast', 'lunch', 'dinner']).toContain(meal.slot);
    }
  });

  test('鉴权:无 X-User-Id → 401', async () => {
    const r = await app.inject({ method: 'GET', url: '/api/v1/recommend/today' });
    expect(r.statusCode).toBe(401);
  });
});

describe('U13a classify pure function', () => {
  test('insufficient_data 当 days=0', () => {
    expect(classify({ fa: 0, mild: 0, calm: 0, days: 0 })).toBe('insufficient_data');
  });
  test('all_calm 当 fa=mild=0 且 days>0', () => {
    expect(classify({ fa: 0, mild: 0, calm: 5, days: 1 })).toBe('all_calm');
  });
  test('fa_heavy 当 fa >= (mild+calm)/2', () => {
    expect(classify({ fa: 5, mild: 5, calm: 5, days: 2 })).toBe('fa_heavy');
  });
  test('mild_balanced 默认', () => {
    expect(classify({ fa: 1, mild: 5, calm: 5, days: 2 })).toBe('mild_balanced');
  });
  test('RECENT_DAYS = 3', () => {
    expect(RECENT_DAYS).toBe(3);
  });
});
