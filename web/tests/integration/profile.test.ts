/**
 * U13b Day 30 体质档案 v0.5 测试
 *
 * - Edge: 累计 < 30 天 → 200 + ok:false reason:not_eligible
 * - Happy: 累计 >= 30 天 → 30 个 dailyTrend 点 + faCounts 累加 + commonFaFoods + 免责声明
 * - 鉴权:无 X-User-Id → 401
 * - 纯函数:DISCLAIMERS_V05 / PROFILE_TITLE / PROFILE_WINDOW_DAYS 常量稳定
 */

import type { FastifyInstance } from 'fastify';
import { buildApp } from '../../server/app';
import type {
  FoodClassification,
  FoodClassifierStore,
  TcmLabel,
  UpsertParams
} from '../../server/services/classifier';
import type { MealRow, MealStore } from '../../server/services/meals';
import type { CreateMealParams as StoreCreateMealParams } from '../../server/services/meals/store';
import type {
  CheckinSource,
  CreateSymptomParams,
  SymptomRow,
  SymptomStore
} from '../../server/services/symptoms';
import {
  DISCLAIMERS_V05,
  PROFILE_TITLE,
  PROFILE_WINDOW_DAYS
} from '../../server/services/profile';

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
  async findById() {
    return null;
  }
  async listByDate(uid: string, date: string) {
    return this.rows.filter(
      (r) => r.userId === uid && r.ateAt.toISOString().slice(0, 10) === date
    );
  }
  async listInRange(uid: string, since: string, until: string) {
    return this.rows
      .filter((r) => {
        const k = r.ateAt.toISOString().slice(0, 10);
        return r.userId === uid && k >= since && k <= until;
      })
      .sort((a, b) => a.ateAt.getTime() - b.ateAt.getTime());
  }
  async appendFeedback() {
    /* noop */
  }
}

class FakeSymptomStore implements SymptomStore {
  rows: SymptomRow[] = [];
  async upsert(p: CreateSymptomParams): Promise<string> {
    const id = `s-${this.rows.length + 1}`;
    this.rows.push({
      id,
      userId: p.userId,
      recordedForDate: p.recordedForDate,
      blindInputCiphertext: p.blindInputCiphertext,
      severityCiphertext: p.severityCiphertext,
      definitionVersion: p.definitionVersion,
      source: p.source,
      createdAt: new Date()
    });
    return id;
  }
  async findByDate() {
    return null;
  }
  async findYesterday() {
    return null;
  }
  async countDistinctCheckinDates(userId: string) {
    const set = new Set<string>();
    for (const r of this.rows) {
      if (r.userId === userId && r.source === 'next_morning') set.add(r.recordedForDate);
    }
    return set.size;
  }
}

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
  async listByLabel(label: TcmLabel, limit: number) {
    return [...this.rows.values()]
      .filter((r) => r.tcmLabel === label)
      .sort((a, b) => b.citations.length - a.citations.length)
      .slice(0, limit);
  }
}

const FIXED = new Date('2026-05-04T03:00:00Z');
const USER = 'u1';

function seedSymptomDates(store: FakeSymptomStore, count: number): void {
  for (let i = 0; i < count; i++) {
    const d = new Date('2026-04-01T00:00:00Z');
    d.setUTCDate(d.getUTCDate() + i);
    void store.upsert({
      userId: USER,
      recordedForDate: d.toISOString().slice(0, 10),
      blindInputCiphertext: 'x',
      severityCiphertext: 'x',
      definitionVersion: 1,
      source: 'next_morning' as CheckinSource
    });
  }
}

describe('U13b profile v0.5', () => {
  let app: FastifyInstance;
  let mealStore: FakeMealStore;
  let symptomStore: FakeSymptomStore;
  let classifierStore: FakeClassifierStore;

  beforeEach(async () => {
    mealStore = new FakeMealStore();
    symptomStore = new FakeSymptomStore();
    classifierStore = new FakeClassifierStore();
    // 种 5 条"发"食物
    const cite = [{ source: 'canon' as const, reference: '《本草纲目》' }];
    for (const n of ['鲈鱼', '虾', '辣椒', '油炸', '羊肉']) {
      void classifierStore.upsert({
        foodCanonicalName: n,
        tcmLabel: '发',
        tcmProperty: '热',
        citations: cite,
        sourceVersions: {}
      });
    }
    app = await buildApp({
      v1: {
        profile: {
          deps: { mealStore, symptomStore, classifierStore, now: () => FIXED }
        }
      }
    });
  });

  afterEach(async () => {
    await app.close();
  });

  test('累计 < 30 天 → ok:false reason:not_eligible', async () => {
    seedSymptomDates(symptomStore, 10);
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/profile/v05',
      headers: { 'x-user-id': USER }
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({
      ok: false,
      reason: 'not_eligible',
      cumulativeCheckinDays: 10,
      required: 30
    });
  });

  test('累计 >= 30 天 → ok:true + 30 dailyTrend 点 + faCounts + commonFaFoods', async () => {
    seedSymptomDates(symptomStore, 30);
    // 在窗口内某些日期投放餐食(2026-04-15 / 2026-05-04)
    void mealStore.create({
      userId: USER,
      ateAt: new Date('2026-04-15T05:00:00Z'),
      photoOssKey: 'k1',
      recognizedItemsCiphertext: 'x',
      tcmLabelsSummary: { 发: 2, 温和: 1, 平: 0, unknown: 0 },
      westernNutritionSummary: {},
      fireScore: 50
    });
    void mealStore.create({
      userId: USER,
      ateAt: new Date('2026-05-04T11:00:00Z'),
      photoOssKey: 'k2',
      recognizedItemsCiphertext: 'x',
      tcmLabelsSummary: { 发: 1, 温和: 2, 平: 1, unknown: 0 },
      westernNutritionSummary: {},
      fireScore: 30
    });
    const body = (await app.inject({
      method: 'GET',
      url: '/api/v1/profile/v05',
      headers: { 'x-user-id': USER }
    })).json();
    expect(body.ok).toBe(true);
    expect(body.data.title).toBe(PROFILE_TITLE);
    expect(body.data.cumulativeCheckinDays).toBe(30);
    expect(body.data.dailyTrend).toHaveLength(30);
    // 最后一天是 2026-05-04
    expect(body.data.dailyTrend[29].date).toBe('2026-05-04');
    expect(body.data.dailyTrend[29].avgFireScore).toBe(30);
    expect(body.data.dailyTrend[29].mealCount).toBe(1);
    // 中间某天有餐食
    const apr15 = body.data.dailyTrend.find((p: { date: string }) => p.date === '2026-04-15');
    expect(apr15.avgFireScore).toBe(50);
    expect(apr15.mealCount).toBe(1);
    // 累加
    expect(body.data.faCounts).toEqual({ faTotal: 3, mildTotal: 3, calmTotal: 1, unknownTotal: 0 });
    // 群体先验取库内 5 条"发"
    expect(body.data.commonFaFoods).toHaveLength(5);
    expect(body.data.commonFaFoods[0]).toHaveProperty('name');
    expect(body.data.commonFaFoods[0].citations.length).toBeGreaterThan(0);
    // 免责声明
    expect(body.data.disclaimers).toEqual(DISCLAIMERS_V05);
    expect(body.data.disclaimers.length).toBeGreaterThanOrEqual(3);
    expect(body.data.checkupSummary).toBeNull();
  });

  test('30 天内无餐食 → dailyTrend 全是 null + faCounts 全 0', async () => {
    seedSymptomDates(symptomStore, 30);
    const body = (await app.inject({
      method: 'GET',
      url: '/api/v1/profile/v05',
      headers: { 'x-user-id': USER }
    })).json();
    expect(body.data.dailyTrend.every((p: { avgFireScore: number | null }) => p.avgFireScore === null)).toBe(true);
    expect(body.data.faCounts).toEqual({ faTotal: 0, mildTotal: 0, calmTotal: 0, unknownTotal: 0 });
  });

  test('鉴权:无 X-User-Id → 401', async () => {
    const r = await app.inject({ method: 'GET', url: '/api/v1/profile/v05' });
    expect(r.statusCode).toBe(401);
  });
});

describe('U13b constants', () => {
  test('PROFILE_WINDOW_DAYS = 30', () => {
    expect(PROFILE_WINDOW_DAYS).toBe(30);
  });
  test('DISCLAIMERS_V05 至少 3 条且包含医疗免责语', () => {
    expect(DISCLAIMERS_V05.length).toBeGreaterThanOrEqual(3);
    expect(DISCLAIMERS_V05.some((d) => d.includes('医') || d.includes('诊'))).toBe(true);
  });
  test('PROFILE_TITLE 含 v0.5', () => {
    expect(PROFILE_TITLE).toContain('v0.5');
  });
});
