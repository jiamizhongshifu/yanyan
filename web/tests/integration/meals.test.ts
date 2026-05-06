/**
 * U6 拍照即时反馈链路测试
 *
 * 对应 plan U6 测试场景:
 *   - Happy path: 拍清蒸鲈鱼+西兰花+米饭 → 火分 < 25(平和) + 3 食物条目
 *   - Edge case: 火锅 10+ 食材 → 整餐火分按聚合规则(U8 公式,非 max)
 *   - Edge case: LLM 整体置信度 < 0.6 → 提示补拍 (422)
 *   - Edge case: 用户选了非食物图片 → recognized 0 食材 → 503 recognition_failed
 *   - Error path: 单 recognizer 超时 → fallback 到第二个(hedged 并行,不等)
 *   - Integration: feedback 写入 meals.feedback jsonb
 *   - 多菜肴聚合规则:不被 max 钉天花板 — Round 2 review 修订
 *   - 越权:storageKey 不带本人前缀 → 403
 */

import type { FastifyInstance } from 'fastify';
import { buildApp } from '../../server/app';
import { resetKmsForTesting, getKms, type KmsClient } from '../../server/crypto/kms';
import { clearDekCacheForTesting, encryptField, decryptField } from '../../server/crypto/envelope';
import {
  aggregateMeal,
  scoreToLevel,
  PgMealStore,
  type MealRow,
  type MealStore
} from '../../server/services/meals';
import {
  DevLlmFoodRecognizer,
  HedgedFoodRecognizer,
  type LlmFoodRecognizer
} from '../../server/services/recognition';
import type { RecognizedItem } from '../../server/services/recognition/types';
import {
  type FoodClassification,
  type FoodClassifierStore,
  type UpsertParams,
  loadFixture,
  seedFromFixture
} from '../../server/services/classifier';
import { join } from 'path';

// ─── Fakes ──────────────────────────────────────────────────────────────

class FakeFoodClassifierStore implements FoodClassifierStore {
  rows = new Map<string, FoodClassification>();
  async findByName(name: string): Promise<FoodClassification | null> {
    return this.rows.get(name) ?? null;
  }
  async upsert(p: UpsertParams): Promise<FoodClassification> {
    const id = `food-${this.rows.size + 1}`;
    const c: FoodClassification = {
      id,
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
  async count(): Promise<number> {
    return this.rows.size;
  }
  async countWithCitations(): Promise<number> {
    return this.rows.size;
  }
  async listByLabel(label: FoodClassification['tcmLabel'], limit: number): Promise<FoodClassification[]> {
    return [...this.rows.values()].filter((c) => c.tcmLabel === label).slice(0, limit);
  }
}

class FakeMealStore implements MealStore {
  rows = new Map<string, MealRow>();
  nextId = 1;
  async create(p: Parameters<MealStore['create']>[0]): Promise<string> {
    const id = `meal-${this.nextId++}`;
    this.rows.set(id, {
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
  async findById(id: string, userId: string): Promise<MealRow | null> {
    const r = this.rows.get(id);
    return r && r.userId === userId ? r : null;
  }
  async listByDate(userId: string, date: string): Promise<MealRow[]> {
    return [...this.rows.values()]
      .filter((r) => r.userId === userId && r.ateAt.toISOString().slice(0, 10) === date)
      .sort((a, b) => a.ateAt.getTime() - b.ateAt.getTime());
  }
  async listInRange(userId: string, since: string, until: string): Promise<MealRow[]> {
    return [...this.rows.values()]
      .filter((r) => {
        const k = r.ateAt.toISOString().slice(0, 10);
        return r.userId === userId && k >= since && k <= until;
      })
      .sort((a, b) => a.ateAt.getTime() - b.ateAt.getTime());
  }
  async appendFeedback(mealId: string, userId: string, entry: MealRow['feedback'][number]): Promise<void> {
    const r = this.rows.get(mealId);
    if (r && r.userId === userId) r.feedback.push(entry);
  }
}

const FIXTURE_PATH = join(__dirname, '..', '..', 'data', 'seed-foods', 'v1.json');

// ─── Pure fn tests ─────────────────────────────────────────────────────

describe('U6 aggregator — meal fire score (Round 2 review:统一公式,非 max)', () => {
  const fakeCls = (name: string, label: '发' | '温和' | '平', addedSugarG: number | null = null): FoodClassification => ({
    id: `f-${name}`,
    foodCanonicalName: name,
    tcmLabel: label,
    tcmProperty: '平',
    diiScore: 0,
    agesScore: 0,
    gi: null,
    addedSugarG,
    carbsG: null,
    citations: [],
    sourceVersions: {}
  });

  const it = (name: string): RecognizedItem => ({ name, confidence: 0.9 });

  test('全平和:fireScore = 0,level=平', () => {
    const items = [it('白米饭'), it('清蒸鲈鱼'), it('西兰花')];
    const cls = items.map((i) => fakeCls(i.name, '平'));
    const a = aggregateMeal(items, cls);
    expect(a.fireScore).toBe(0);
    expect(a.level).toBe('平');
    expect(a.counts).toEqual({ 发: 0, 温和: 0, 平: 3, unknown: 0 });
  });

  test('全发物 → fireScore 落在大火/中火区间(>=50)', () => {
    // v2 多信号:每条发物贡献 55 (TCM only, dii=0 在 fakeCls);均值 55,落 中火
    const items = [it('炸鸡'), it('烤羊肉串'), it('辣椒')];
    const cls = items.map((i) => fakeCls(i.name, '发'));
    const score = aggregateMeal(items, cls).fireScore;
    expect(score).toBeGreaterThanOrEqual(50);
    expect(score).toBeLessThan(75);
  });

  test('火锅 12 食材 4 发 + 8 平 → 中等偏低(微火/平)', () => {
    const items: RecognizedItem[] = [];
    const cls: FoodClassification[] = [];
    for (let i = 0; i < 4; i++) {
      items.push(it(`发${i}`));
      cls.push(fakeCls(`发${i}`, '发'));
    }
    for (let i = 0; i < 8; i++) {
      items.push(it(`平${i}`));
      cls.push(fakeCls(`平${i}`, '平'));
    }
    const a = aggregateMeal(items, cls);
    // (4 × 55 + 8 × 0) / 12 ≈ 18.3
    expect(a.fireScore).toBeCloseTo(18.3, 0);
    expect(a.level).toBe('平');
  });

  test('未识别项贡献 +12 不确定性,记入 unrecognizedNames', () => {
    const items = [it('清蒸鲈鱼'), it('佛跳墙未知')];
    const cls = [fakeCls('清蒸鲈鱼', '平'), null];
    const a = aggregateMeal(items, cls);
    expect(a.unrecognizedNames).toEqual(['佛跳墙未知']);
    expect(a.counts.unknown).toBe(1);
    // (0 + 12) / 2 = 6
    expect(a.fireScore).toBe(6);
  });

  test('scoreToLevel boundary: 25 → 微火, 75 → 大火', () => {
    expect(scoreToLevel(0)).toBe('平');
    expect(scoreToLevel(24.9)).toBe('平');
    expect(scoreToLevel(25)).toBe('微火');
    expect(scoreToLevel(49.9)).toBe('微火');
    expect(scoreToLevel(50)).toBe('中火');
    expect(scoreToLevel(74.9)).toBe('中火');
    expect(scoreToLevel(75)).toBe('大火');
  });

  test('糖分聚合:DB 命中 addedSugarG → 用 DB 值', () => {
    const items: RecognizedItem[] = [
      { name: '奶茶', confidence: 0.9 },
      { name: '可乐', confidence: 0.9 }
    ];
    const cls = [fakeCls('奶茶', '发', 50), fakeCls('可乐', '发', 35)];
    const a = aggregateMeal(items, cls);
    expect(a.sugarGrams).toBe(85);
  });

  test('糖分聚合:DB 缺 addedSugarG → 回落 LLM addedSugarGEstimate', () => {
    const items: RecognizedItem[] = [
      { name: '某新品奶茶', confidence: 0.9, addedSugarGEstimate: 42 },
      { name: '可乐', confidence: 0.9 }
    ];
    const cls = [null, fakeCls('可乐', '发', 35)];
    const a = aggregateMeal(items, cls);
    expect(a.sugarGrams).toBe(77);
    expect(a.unrecognizedNames).toEqual(['某新品奶茶']);
  });

  test('糖分聚合:DB 命中但 addedSugarG=null + LLM 给值 → 用 LLM 值', () => {
    const items: RecognizedItem[] = [
      { name: '炒河粉', confidence: 0.9, addedSugarGEstimate: 8 }
    ];
    const cls = [fakeCls('炒河粉', '温和', null)];
    const a = aggregateMeal(items, cls);
    expect(a.sugarGrams).toBe(8);
  });

  test('糖分聚合:全部 null → sugarGrams=null', () => {
    const items: RecognizedItem[] = [
      { name: '神秘菜 A', confidence: 0.9 },
      { name: '神秘菜 B', confidence: 0.9 }
    ];
    const cls = [fakeCls('神秘菜 A', '平', null), null];
    const a = aggregateMeal(items, cls);
    expect(a.sugarGrams).toBeNull();
  });
});

// ─── Hedged router tests ───────────────────────────────────────────────

describe('U6 HedgedFoodRecognizer — 并行 hedged request', () => {
  test('谁先返回用谁,不等慢的', async () => {
    const fast = new DevLlmFoodRecognizer();
    fast.add('users/u1/abc.jpg', {
      items: [{ name: '清蒸鲈鱼', confidence: 0.9 }],
      overallConfidence: 0.9,
      latencyMs: 100
    });
    const slow: LlmFoodRecognizer = {
      modelVersion: 'slow',
      async recognize() {
        await new Promise((r) => setTimeout(r, 300));
        return null;
      }
    };
    const hedged = new HedgedFoodRecognizer([fast, slow]);
    const start = Date.now();
    const res = await hedged.recognize('users/u1/abc.jpg');
    expect(res?.items[0].name).toBe('清蒸鲈鱼');
    expect(Date.now() - start).toBeLessThan(250);
  });

  test('单 recognizer reject → 另一个 ok', async () => {
    const broken: LlmFoodRecognizer = {
      modelVersion: 'broken',
      async recognize() {
        throw new Error('豆包 timeout');
      }
    };
    const ok = new DevLlmFoodRecognizer();
    ok.add('users/u1/x.jpg', {
      items: [{ name: '苹果', confidence: 0.85 }],
      overallConfidence: 0.85,
      latencyMs: 200
    });
    const hedged = new HedgedFoodRecognizer([broken, ok]);
    const res = await hedged.recognize('users/u1/x.jpg');
    expect(res?.items[0].name).toBe('苹果');
  });

  test('全部失败 → null', async () => {
    const a: LlmFoodRecognizer = {
      modelVersion: 'a',
      async recognize() {
        return null;
      }
    };
    const b: LlmFoodRecognizer = {
      modelVersion: 'b',
      async recognize() {
        throw new Error('fail');
      }
    };
    const hedged = new HedgedFoodRecognizer([a, b]);
    expect(await hedged.recognize('users/u1/y.jpg')).toBeNull();
  });
});

// ─── HTTP routes ────────────────────────────────────────────────────────

describe('U6 meals routes', () => {
  let app: FastifyInstance;
  let mealStore: FakeMealStore;
  let classifierStore: FakeFoodClassifierStore;
  let recognizer: DevLlmFoodRecognizer;
  let userDek: string; // base64 of dek ciphertext for user

  beforeEach(async () => {
    resetKmsForTesting();
    clearDekCacheForTesting();

    mealStore = new FakeMealStore();
    classifierStore = new FakeFoodClassifierStore();
    await seedFromFixture({ store: classifierStore }, loadFixture(FIXTURE_PATH));
    recognizer = new DevLlmFoodRecognizer();

    // 准备用户 DEK
    const kms: KmsClient = getKms();
    const dk = await kms.generateDataKey('u1');
    userDek = dk.ciphertext.toString('base64');

    app = await buildApp({
      v1: {
        meals: {
          deps: {
            mealStore,
            classifierStore,
            recognizer,
            getUserDek: async (uid) => (uid === 'u1' ? userDek : null)
          }
        }
      }
    });
  });

  afterEach(async () => {
    await app.close();
  });

  test('Happy: POST /meals with 清蒸鲈鱼+西兰花+白米饭 → fireScore<25(平) + 3 items', async () => {
    recognizer.add('users/u1/2026-05-04/m1.jpg', {
      items: [
        { name: '清蒸鲈鱼', confidence: 0.92 },
        { name: '西兰花', confidence: 0.9 },
        { name: '白米饭', confidence: 0.95 }
      ],
      overallConfidence: 0.92,
      latencyMs: 250
    });

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/meals',
      headers: { 'content-type': 'application/json', 'x-user-id': 'u1' },
      payload: { storageKey: 'users/u1/2026-05-04/m1.jpg' }
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.ok).toBe(true);
    // 白米饭 GI 73 → +10,清蒸鲈鱼 0、西兰花 0;均值 ≈ 3.3,仍落 平
    expect(body.fireScore).toBeLessThan(25);
    expect(body.level).toBe('平');
    expect(body.items).toHaveLength(3);
    expect(body.items[0].classification?.tcmLabel).toBe('平');

    // 入库验证 + 密文可解
    const stored = [...mealStore.rows.values()][0];
    const decrypted = await decryptField<{ items: RecognizedItem[] }>(
      'u1',
      userDek,
      stored.recognizedItemsCiphertext
    );
    expect(decrypted.items.map((i) => i.name)).toEqual(['清蒸鲈鱼', '西兰花', '白米饭']);
  });

  test('Edge: 火锅 10+ 食材高发物 → 不被钉到 100', async () => {
    recognizer.add('users/u1/hotpot.jpg', {
      items: [
        { name: '羊肉', confidence: 0.9 },
        { name: '虾', confidence: 0.88 },
        { name: '螃蟹', confidence: 0.85 },
        { name: '辣椒', confidence: 0.9 },
        { name: '白菜', confidence: 0.92 },
        { name: '豆腐', confidence: 0.94 },
        { name: '菠菜', confidence: 0.9 },
        { name: '山药', confidence: 0.87 },
        { name: '苹果', confidence: 0.91 } // 9 items: 4发 + 5平
      ],
      overallConfidence: 0.9,
      latencyMs: 300
    });

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/meals',
      headers: { 'content-type': 'application/json', 'x-user-id': 'u1' },
      payload: { storageKey: 'users/u1/hotpot.jpg' }
    });
    const body = res.json();
    // v2 多信号:4 发(每条 55) + 5 平(每条 0~10),均值 ~24-30,落 平/微火
    expect(body.fireScore).toBeGreaterThan(15);
    expect(body.fireScore).toBeLessThan(50);
    expect(['平', '微火']).toContain(body.level);
  });

  test('Edge: 整体置信度 < 0.6 → 422 low_confidence', async () => {
    recognizer.add('users/u1/blurry.jpg', {
      items: [{ name: '看不清', confidence: 0.5 }],
      overallConfidence: 0.45,
      latencyMs: 200
    });
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/meals',
      headers: { 'content-type': 'application/json', 'x-user-id': 'u1' },
      payload: { storageKey: 'users/u1/blurry.jpg' }
    });
    expect(res.statusCode).toBe(422);
    expect(res.json().error).toBe('low_confidence');
  });

  test('Edge: 非食物图片 → recognizer 返回空 items → 503 recognition_failed', async () => {
    // 不为这个 key 添加 fixture → DevRecognizer 返回 null
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/meals',
      headers: { 'content-type': 'application/json', 'x-user-id': 'u1' },
      payload: { storageKey: 'users/u1/not-food.jpg' }
    });
    expect(res.statusCode).toBe(503);
    expect(res.json().error).toBe('recognition_failed');
  });

  test('Defense: storageKey 不带本人前缀 → 403 forbidden_storage_key', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/meals',
      headers: { 'content-type': 'application/json', 'x-user-id': 'u1' },
      payload: { storageKey: 'users/u2/someone-elses.jpg' }
    });
    expect(res.statusCode).toBe(403);
    expect(res.json().error).toBe('forbidden_storage_key');
  });

  test('用户未初始化(没 DEK)→ 403 user_not_initialized', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/meals',
      headers: { 'content-type': 'application/json', 'x-user-id': 'u-no-dek' },
      payload: { storageKey: 'users/u-no-dek/x.jpg' }
    });
    expect(res.statusCode).toBe(403);
    expect(res.json().error).toBe('user_not_initialized');
  });

  test('Integration: POST /meals/:id/feedback 写入 jsonb', async () => {
    recognizer.add('users/u1/m.jpg', {
      items: [{ name: '清蒸鲈鱼', confidence: 0.9 }],
      overallConfidence: 0.9,
      latencyMs: 200
    });
    const create = await app.inject({
      method: 'POST',
      url: '/api/v1/meals',
      headers: { 'content-type': 'application/json', 'x-user-id': 'u1' },
      payload: { storageKey: 'users/u1/m.jpg' }
    });
    const mealId = create.json().mealId;

    const fb = await app.inject({
      method: 'POST',
      url: `/api/v1/meals/${mealId}/feedback`,
      headers: { 'content-type': 'application/json', 'x-user-id': 'u1' },
      payload: { itemName: '清蒸鲈鱼', kind: 'no_reaction' }
    });
    expect(fb.statusCode).toBe(200);
    expect(fb.json().entry.kind).toBe('no_reaction');

    expect(mealStore.rows.get(mealId)!.feedback).toHaveLength(1);
  });

  test('未识别食物名进入 onMissingFood 队列', async () => {
    const missing: string[] = [];
    const a = await buildApp({
      v1: {
        meals: {
          deps: {
            mealStore,
            classifierStore,
            recognizer,
            onMissingFood: (name) => missing.push(name),
            getUserDek: async () => userDek
          }
        }
      }
    });
    recognizer.add('users/u1/exotic.jpg', {
      items: [
        { name: '清蒸鲈鱼', confidence: 0.9 }, // 已知
        { name: '神秘食物 X', confidence: 0.8 } // 未知
      ],
      overallConfidence: 0.85,
      latencyMs: 250
    });
    await a.inject({
      method: 'POST',
      url: '/api/v1/meals',
      headers: { 'content-type': 'application/json', 'x-user-id': 'u1' },
      payload: { storageKey: 'users/u1/exotic.jpg' }
    });
    expect(missing).toEqual(['神秘食物 X']);
    await a.close();
  });

  test('鉴权:无 X-User-Id → 401', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/meals',
      headers: { 'content-type': 'application/json' },
      payload: { storageKey: 'users/u1/x.jpg' }
    });
    expect(res.statusCode).toBe(401);
  });

  test('zod: missing storageKey → 400', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/meals',
      headers: { 'content-type': 'application/json', 'x-user-id': 'u1' },
      payload: {}
    });
    expect(res.statusCode).toBe(400);
  });
});

// 让 Pg* 类被引用避免 TS 警告(部分用作类型断言)
void PgMealStore;
void encryptField;
