/**
 * U10 主屏 + progress 路由测试
 *
 * 对应 plan U10 测试场景:
 *   - Happy: 累计 5 天 → progress.cumulativeCheckinDays=5,canDrawTrend=false
 *   - 累计 25 天 → canDrawTrend=true(R20b 21 天阈值)
 *   - 累计 30 天 → eligibleForProfilePdf=true(R24)
 *   - /home/today 列出今日 N 餐 + 每餐 fireScore + level
 *   - 鉴权:无 X-User-Id → 401
 */

import type { FastifyInstance } from 'fastify';
import { buildApp } from '../../src/app';
import type { MealRow, MealStore } from '../../src/services/meals';
// store 层的 CreateMealParams(与 service 层 createMeal 的同名 type 区分)
import type { CreateMealParams as StoreCreateMealParams } from '../../src/services/meals/store';
import type {
  CheckinSource,
  CreateSymptomParams,
  SymptomRow,
  SymptomStore
} from '../../src/services/symptoms';

class FakeMealStore implements MealStore {
  rows = new Map<string, MealRow>();
  nextId = 1;
  async create(p: StoreCreateMealParams): Promise<string> {
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
  async appendFeedback(): Promise<void> {
    /* noop */
  }
}

class FakeSymptomStore implements SymptomStore {
  rows: SymptomRow[] = [];
  nextId = 1;
  async upsert(p: CreateSymptomParams): Promise<string> {
    const existing = this.rows.find(
      (r) => r.userId === p.userId && r.recordedForDate === p.recordedForDate && r.source === p.source
    );
    if (existing) return existing.id;
    const id = `s-${this.nextId++}`;
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
  async findByDate(): Promise<SymptomRow | null> {
    return null;
  }
  async findYesterday(): Promise<SymptomRow | null> {
    return null;
  }
  async countDistinctCheckinDates(userId: string): Promise<number> {
    const set = new Set<string>();
    for (const r of this.rows) {
      if (r.userId === userId && r.source === 'next_morning') {
        set.add(r.recordedForDate);
      }
    }
    return set.size;
  }
}

const FIXED_DATE = new Date('2026-05-04T03:00:00Z');
const TODAY = '2026-05-04';

describe('U10 home + progress', () => {
  let app: FastifyInstance;
  let mealStore: FakeMealStore;
  let symptomStore: FakeSymptomStore;
  const USER_ID = 'u1';

  beforeEach(async () => {
    mealStore = new FakeMealStore();
    symptomStore = new FakeSymptomStore();
    app = await buildApp({
      v1: {
        home: { deps: { mealStore, symptomStore, now: () => FIXED_DATE } }
      }
    });
  });

  afterEach(async () => {
    await app.close();
  });

  function seedSymptomDates(dates: string[]): void {
    let i = 100;
    for (const d of dates) {
      symptomStore.rows.push({
        id: `s-${i++}`,
        userId: USER_ID,
        recordedForDate: d,
        blindInputCiphertext: 'x',
        severityCiphertext: 'x',
        definitionVersion: 1,
        source: 'next_morning' as CheckinSource,
        createdAt: new Date()
      });
    }
  }

  function seedMeal(ateAt: Date, fireScore: number, counts = { 发: 0, 温和: 0, 平: 0, unknown: 0 }): void {
    void mealStore.create({
      userId: USER_ID,
      ateAt,
      photoOssKey: `users/${USER_ID}/m/${ateAt.getTime()}.jpg`,
      recognizedItemsCiphertext: 'x',
      tcmLabelsSummary: counts,
      westernNutritionSummary: {},
      fireScore
    });
  }

  test('GET /home/today: 今日 0 餐 → 空列表 + date 字段', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/home/today',
      headers: { 'x-user-id': USER_ID }
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ ok: true, date: TODAY, meals: [] });
  });

  test('GET /home/today: 今日 2 餐 → 按 ateAt 升序返回 + 每餐 level/fireScore', async () => {
    seedMeal(new Date('2026-05-04T05:00:00Z'), 22.5);  // 早餐
    seedMeal(new Date('2026-05-04T11:30:00Z'), 60);    // 午餐
    seedMeal(new Date('2026-05-03T19:00:00Z'), 80);    // 昨晚 — 不该出现
    const body = (await app.inject({
      method: 'GET',
      url: '/api/v1/home/today',
      headers: { 'x-user-id': USER_ID }
    })).json();
    expect(body.meals).toHaveLength(2);
    expect(body.meals[0].fireScore).toBe(22.5);
    expect(body.meals[0].level).toBe('平');
    expect(body.meals[1].fireScore).toBe(60);
    expect(body.meals[1].level).toBe('中火');
  });

  test('GET /users/me/progress: 0 天 → 不能画趋势 / 不可生成 PDF', async () => {
    const body = (await app.inject({
      method: 'GET',
      url: '/api/v1/users/me/progress',
      headers: { 'x-user-id': USER_ID }
    })).json();
    expect(body).toMatchObject({
      ok: true,
      cumulativeCheckinDays: 0,
      thresholds: { trendLineDays: 21, profilePdfDay: 30 },
      flags: { canDrawTrend: false, eligibleForProfilePdf: false }
    });
  });

  test('GET /users/me/progress: 5 天 → canDrawTrend=false', async () => {
    seedSymptomDates(['2026-04-30', '2026-05-01', '2026-05-02', '2026-05-03', '2026-05-04']);
    const body = (await app.inject({
      method: 'GET',
      url: '/api/v1/users/me/progress',
      headers: { 'x-user-id': USER_ID }
    })).json();
    expect(body.cumulativeCheckinDays).toBe(5);
    expect(body.flags.canDrawTrend).toBe(false);
    expect(body.flags.eligibleForProfilePdf).toBe(false);
  });

  test('GET /users/me/progress: 25 天 → R20b canDrawTrend=true,< 30 PDF 不可', async () => {
    const dates = Array.from({ length: 25 }, (_, i) => {
      const d = new Date('2026-04-10T00:00:00Z');
      d.setUTCDate(d.getUTCDate() + i);
      return d.toISOString().slice(0, 10);
    });
    seedSymptomDates(dates);
    const body = (await app.inject({
      method: 'GET',
      url: '/api/v1/users/me/progress',
      headers: { 'x-user-id': USER_ID }
    })).json();
    expect(body.cumulativeCheckinDays).toBe(25);
    expect(body.flags.canDrawTrend).toBe(true);
    expect(body.flags.eligibleForProfilePdf).toBe(false);
  });

  test('GET /users/me/progress: 30 天 → R24 PDF 可生成', async () => {
    const dates = Array.from({ length: 30 }, (_, i) => {
      const d = new Date('2026-04-05T00:00:00Z');
      d.setUTCDate(d.getUTCDate() + i);
      return d.toISOString().slice(0, 10);
    });
    seedSymptomDates(dates);
    const body = (await app.inject({
      method: 'GET',
      url: '/api/v1/users/me/progress',
      headers: { 'x-user-id': USER_ID }
    })).json();
    expect(body.flags.canDrawTrend).toBe(true);
    expect(body.flags.eligibleForProfilePdf).toBe(true);
  });

  test('progress 重复打卡不重复计数(distinct dates)', async () => {
    seedSymptomDates(['2026-05-01', '2026-05-01', '2026-05-02']); // 故意重复
    const body = (await app.inject({
      method: 'GET',
      url: '/api/v1/users/me/progress',
      headers: { 'x-user-id': USER_ID }
    })).json();
    expect(body.cumulativeCheckinDays).toBe(2);
  });

  test('鉴权:无 X-User-Id → 401', async () => {
    expect((await app.inject({ method: 'GET', url: '/api/v1/home/today' })).statusCode).toBe(401);
    expect((await app.inject({ method: 'GET', url: '/api/v1/users/me/progress' })).statusCode).toBe(401);
  });
});
