/**
 * 食物分类引擎集成测试
 *
 * 对应 plan U5 测试场景:
 *   - Happy path: 种子入库,查询返回完整双层数据
 *   - Edge case: 查询不存在的食物 → 404 + 异步触发 LLM 回填
 *   - Integration: 种子完成后 store.count() 反映 fixture 数量
 *   - Verification: USDA spot check 误差率 ≤ 10%
 */

import type { FastifyInstance } from 'fastify';
import { join } from 'path';
import { buildApp } from '../../server/app';
import {
  DevLlmDeriver,
  InMemoryBackfillQueue,
  loadFixture,
  loadUsdaReference,
  runUsdaSpotCheck,
  seedFromFixture,
  type Citation,
  type FoodClassification,
  type FoodClassifierStore,
  type LlmDerivation,
  type UpsertParams
} from '../../server/services/classifier';

class FakeFoodClassifierStore implements FoodClassifierStore {
  rows = new Map<string, FoodClassification>();

  async findByName(name: string): Promise<FoodClassification | null> {
    return this.rows.get(name) ?? null;
  }

  async upsert(params: UpsertParams): Promise<FoodClassification> {
    const existing = this.rows.get(params.foodCanonicalName);
    const id = existing?.id ?? `food-${this.rows.size + 1}`;
    const next: FoodClassification = {
      id,
      foodCanonicalName: params.foodCanonicalName,
      tcmLabel: params.tcmLabel,
      tcmProperty: params.tcmProperty,
      diiScore: params.diiScore ?? null,
      agesScore: params.agesScore ?? null,
      gi: params.gi ?? null,
      citations: params.citations,
      sourceVersions: params.sourceVersions
    };
    this.rows.set(params.foodCanonicalName, next);
    return next;
  }

  async count(): Promise<number> {
    return this.rows.size;
  }

  async countWithCitations(): Promise<number> {
    let n = 0;
    for (const r of this.rows.values()) {
      if (r.citations.length > 0) n++;
    }
    return n;
  }
  async listByLabel(label: 'fa' | '发' | '温和' | '平' | string, limit: number) {
    return [...this.rows.values()].filter((r) => r.tcmLabel === label).slice(0, limit);
  }
}

const FIXTURE_PATH = join(__dirname, '..', '..', 'data', 'seed-foods', 'v1.json');
const USDA_REF_PATH = join(__dirname, '..', '..', 'data', 'western-nutrition', 'usda-reference.json');

describe('U5 classifier — seed + query', () => {
  test('seedFromFixture loads all 30 foods + dual-layer fields preserved', async () => {
    const store = new FakeFoodClassifierStore();
    const fixture = loadFixture(FIXTURE_PATH);
    expect(fixture.length).toBeGreaterThanOrEqual(30);

    const result = await seedFromFixture({ store }, fixture);
    expect(result.errors).toEqual([]);
    expect(result.inserted).toBe(fixture.length);

    const fish = await store.findByName('清蒸鲈鱼');
    expect(fish).not.toBeNull();
    expect(fish!.tcmLabel).toBe('平');
    expect(fish!.tcmProperty).toBe('平');
    expect(fish!.citations.some((c) => c.reference.includes('本草纲目'))).toBe(true);

    const friedChicken = await store.findByName('炸鸡');
    expect(friedChicken!.tcmLabel).toBe('发');
    expect(friedChicken!.diiScore).toBeGreaterThan(1);
    expect(friedChicken!.agesScore).toBeGreaterThan(50);
  });

  test('citations 字段非空率 ≥ 95%(R5 verification)', async () => {
    const store = new FakeFoodClassifierStore();
    await seedFromFixture({ store }, loadFixture(FIXTURE_PATH));
    const total = await store.count();
    const withCit = await store.countWithCitations();
    expect(withCit / total).toBeGreaterThanOrEqual(0.95);
  });
});

describe('U5 classifier — HTTP route + 404 backfill', () => {
  let app: FastifyInstance;
  let store: FakeFoodClassifierStore;
  let missingCalls: string[];

  beforeEach(async () => {
    store = new FakeFoodClassifierStore();
    await seedFromFixture({ store }, loadFixture(FIXTURE_PATH));
    missingCalls = [];
    app = await buildApp({
      v1: {
        foods: { deps: { store, onMissingFood: (n) => missingCalls.push(n) } }
      }
    });
  });

  afterEach(async () => {
    await app.close();
  });

  test('GET /foods/清蒸鲈鱼/classification → 200 with dual-layer payload', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/foods/' + encodeURIComponent('清蒸鲈鱼') + '/classification'
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.ok).toBe(true);
    expect(body.data).toMatchObject({
      foodCanonicalName: '清蒸鲈鱼',
      tcmLabel: '平',
      tcmProperty: '平'
    });
    expect(body.data.citations.length).toBeGreaterThan(0);
  });

  test('GET unknown food → 404 + onMissingFood enqueued for backfill', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/foods/' + encodeURIComponent('佛跳墙') + '/classification'
    });
    expect(res.statusCode).toBe(404);
    expect(res.json().error).toBe('food_not_found');
    expect(missingCalls).toEqual(['佛跳墙']);
  });
});

describe('U5 classifier — InMemoryBackfillQueue', () => {
  test('high-confidence LLM derivation auto-upserts', async () => {
    const store = new FakeFoodClassifierStore();
    const llm = new DevLlmDeriver();
    llm.add('佛跳墙', {
      tcmLabel: '发',
      tcmProperty: '热',
      citations: [{ source: 'paper' as const, reference: 'LLM derived v1' }],
      confidence: 0.85,
      modelVersion: 'doubao-multimodal-v1'
    });
    const queue = new InMemoryBackfillQueue({ store, llm });
    queue.enqueue('佛跳墙');
    await queue.drainNow();
    const stored = await store.findByName('佛跳墙');
    expect(stored).not.toBeNull();
    expect(stored!.tcmLabel).toBe('发');
  });

  test('low-confidence LLM derivation does NOT auto-upsert (goes to human review)', async () => {
    const store = new FakeFoodClassifierStore();
    const llm = new DevLlmDeriver();
    llm.add('未知食物', {
      tcmLabel: '温和',
      tcmProperty: '平',
      citations: [],
      confidence: 0.4, // < 0.6 threshold
      modelVersion: 'doubao-multimodal-v1'
    } as LlmDerivation);
    const queue = new InMemoryBackfillQueue({ store, llm });
    queue.enqueue('未知食物');
    await queue.drainNow();
    expect(await store.findByName('未知食物')).toBeNull();
  });

  test('LLM returns null → silently dropped', async () => {
    const store = new FakeFoodClassifierStore();
    const llm = new DevLlmDeriver(); // no fixtures
    const queue = new InMemoryBackfillQueue({ store, llm });
    queue.enqueue('真的没有这个');
    await queue.drainNow();
    expect(await store.findByName('真的没有这个')).toBeNull();
  });
});

describe('U5 classifier — USDA spot check (Round 2 review verification gate)', () => {
  test('seeded data passes spot check with 0% error rate', async () => {
    const store = new FakeFoodClassifierStore();
    await seedFromFixture({ store }, loadFixture(FIXTURE_PATH));
    const ref = loadUsdaReference(USDA_REF_PATH);
    const result = await runUsdaSpotCheck(store, { reference: ref, thresholdRate: 0.10 });

    expect(result.missingFromStore).toEqual([]);
    expect(result.errorRate).toBeLessThanOrEqual(0.10);
    expect(result.passes).toBe(true);
  });

  test('out-of-tolerance values trigger failures', async () => {
    const store = new FakeFoodClassifierStore();
    // 故意写入与 reference 严重偏离的 dii_score
    await store.upsert({
      foodCanonicalName: '白米饭',
      tcmLabel: '平',
      tcmProperty: '平',
      diiScore: 10.0, // reference: 0.06,误差远超 tolerance 0.5
      agesScore: 9,
      gi: 73,
      citations: [{ source: 'modern_nutrition' as Citation['source'], reference: 'broken' }],
      sourceVersions: {}
    });
    const ref = {
      description: '',
      tolerance: { diiScore: 0.5, agesScore: 15, gi: 10 },
      samples: [{ foodCanonicalName: '白米饭', diiScore: 0.06, agesScore: 9, gi: 73 }]
    };
    const result = await runUsdaSpotCheck(store, { reference: ref, thresholdRate: 0.10 });
    expect(result.failures.length).toBeGreaterThan(0);
    expect(result.passes).toBe(false);
  });

  test('missing foods from store fail the gate even if no tolerance violations', async () => {
    const store = new FakeFoodClassifierStore();
    const ref = {
      description: '',
      tolerance: { diiScore: 0.5, agesScore: 15, gi: 10 },
      samples: [{ foodCanonicalName: '不存在的食物', diiScore: 0 }]
    };
    const result = await runUsdaSpotCheck(store, { reference: ref });
    expect(result.missingFromStore).toEqual(['不存在的食物']);
    expect(result.passes).toBe(false);
  });
});
