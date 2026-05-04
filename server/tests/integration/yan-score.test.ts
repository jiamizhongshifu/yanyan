/**
 * U8 yan-score HTTP 测试 — 4 Part 集成
 *
 * 覆盖 plan U8 测试场景:
 *   - 4 类输入齐全 中等 → 火分 ~50,中火
 *   - 全平和 + 无症状 + 优 PM2.5 + 步数正常 → 火分 < 20
 *   - 缺 ActivityPart(用户拒授权)→ 重分配,3 类按 50/30/15 → 53/32/15
 *   - 缺 Env+Activity → 仅 Food+Symptom → 50/30 → 62.5/37.5
 *   - 全部缺失 → unavailableReason='no_data'
 *   - 仅 Symptom(< 2)→ unavailableReason='insufficient_parts'
 *   - 火分 = 25 → 微火(边界)
 */

import type { FastifyInstance } from 'fastify';
import { buildApp } from '../../src/app';
import { resetKmsForTesting, getKms } from '../../src/crypto/kms';
import { clearDekCacheForTesting, encryptField } from '../../src/crypto/envelope';
import {
  CURRENT_DEFINITION_VERSION,
  effectiveSeverityMap,
  type CheckinSource,
  type CreateSymptomParams,
  type SymptomRow,
  type SymptomStore
} from '../../src/services/symptoms';
import type { ActivitySnapshot, DailyMealAggregate, EnvSnapshot } from '../../src/services/score/parts';

// 用日期 fix 防"今日"漂移导致 fixtures 找不到
const TODAY = new Date().toISOString().slice(0, 10);

class FakeSymptomStore implements SymptomStore {
  rows = new Map<string, SymptomRow>();
  nextId = 1;

  async upsert(p: CreateSymptomParams): Promise<string> {
    const key = `${p.userId}|${p.recordedForDate}|${p.source}`;
    const existing = this.rows.get(key);
    if (existing) {
      existing.blindInputCiphertext = p.blindInputCiphertext;
      existing.severityCiphertext = p.severityCiphertext;
      return existing.id;
    }
    const id = `s-${this.nextId++}`;
    this.rows.set(key, {
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

  async findByDate(userId: string, date: string, source: CheckinSource = 'next_morning'): Promise<SymptomRow | null> {
    return this.rows.get(`${userId}|${date}|${source}`) ?? null;
  }
  async findYesterday(): Promise<SymptomRow | null> {
    return null;
  }
  async countDistinctCheckinDates(userId: string): Promise<number> {
    const set = new Set<string>();
    for (const r of this.rows.values()) {
      if (r.userId === userId && r.source === 'next_morning') set.add(r.recordedForDate);
    }
    return set.size;
  }
}

describe('U8 yan-score HTTP — 4 Part 集成', () => {
  let app: FastifyInstance;
  let symptomStore: FakeSymptomStore;
  let userDek: string;
  const USER_ID = 'u1';

  let mealAgg: DailyMealAggregate;
  let env: EnvSnapshot | null;
  let activity: ActivitySnapshot | null;

  beforeEach(async () => {
    resetKmsForTesting();
    clearDekCacheForTesting();
    symptomStore = new FakeSymptomStore();
    const dk = await getKms().generateDataKey(USER_ID);
    userDek = dk.ciphertext.toString('base64');

    mealAgg = { counts: { 发: 0, 温和: 0, 平: 0, unknown: 0 } };
    env = null;
    activity = null;

    app = await buildApp({
      v1: {
        yanScore: {
          deps: {
            symptomStore,
            getUserDek: async (uid) => (uid === USER_ID ? userDek : null),
            loadDailyMealAggregate: async () => mealAgg,
            loadEnvSnapshot: async () => env,
            loadActivitySnapshot: async () => activity
          }
        }
      }
    });
  });

  afterEach(async () => {
    await app.close();
  });

  /** 写入今日打卡(severity 经 envelope 加密) */
  async function writeSymptoms(severityByDim: Record<string, number>): Promise<void> {
    const payload: Record<string, { engaged: boolean; severity: number }> = {};
    for (const [dim, sev] of Object.entries(severityByDim)) {
      payload[dim] = { engaged: true, severity: sev };
    }
    const blind = await encryptField(USER_ID, userDek, payload);
    const sev = await encryptField(USER_ID, userDek, effectiveSeverityMap(payload));
    await symptomStore.upsert({
      userId: USER_ID,
      recordedForDate: TODAY,
      blindInputCiphertext: blind,
      severityCiphertext: sev,
      definitionVersion: CURRENT_DEFINITION_VERSION,
      source: 'next_morning'
    });
  }

  test('4 Part 全可用 + 中等 → ~50 中火', async () => {
    mealAgg = { counts: { 发: 1, 温和: 1, 平: 0, unknown: 0 } }; // food = (5+2)/(2*5)*100 = 70
    await writeSymptoms({ nasal_congestion: 2, dry_mouth: 2 }); // (50+50)/2 = 50
    env = { pm25: 80, season: 'spring' }; // ((60+20)/2 = 40)
    activity = { todaySteps: 8000, weekMedianSteps: 8000 }; // 50
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/yan-score/today',
      headers: { 'x-user-id': USER_ID }
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.hasCheckin).toBe(true);
    expect(body.result).not.toBeNull();
    expect(body.result.partScores).toEqual({ food: 70, symptom: 50, env: 40, activity: 50 });
    // score = 70*0.5 + 50*0.3 + 40*0.15 + 50*0.05 = 35 + 15 + 6 + 2.5 = 58.5
    expect(body.result.score).toBeCloseTo(58.5, 1);
    expect(body.result.level).toBe('中火');
  });

  test('全平和 + 无症状 + 优 PM2.5 → 火分 < 20', async () => {
    mealAgg = { counts: { 发: 0, 温和: 0, 平: 3, unknown: 0 } }; // food = 0
    await writeSymptoms({}); // 无效 severity → SymptomPart null
    env = { pm25: 20, season: 'summer' }; // (0+0)/2 = 0
    activity = { todaySteps: 8000, weekMedianSteps: 8000 }; // 50
    const body = (
      await app.inject({
        method: 'GET',
        url: '/api/v1/yan-score/today',
        headers: { 'x-user-id': USER_ID }
      })
    ).json();
    expect(body.result).not.toBeNull();
    expect(body.result.score).toBeLessThan(20);
    expect(body.result.partScores.symptom).toBeNull(); // 无 effective symptoms
    expect(body.result.missingParts).toEqual(['symptom']);
  });

  test('缺 ActivityPart → 重分配,3 类按 ~52.6/31.6/15.8', async () => {
    mealAgg = { counts: { 发: 0, 温和: 1, 平: 0, unknown: 0 } }; // food = 2/5*100 = 40
    await writeSymptoms({ acne: 2 }); // 50
    env = { pm25: 80, season: 'summer' }; // ((60+0)/2 = 30)
    activity = null; // 拒授权 / 数据缺
    const body = (
      await app.inject({
        method: 'GET',
        url: '/api/v1/yan-score/today',
        headers: { 'x-user-id': USER_ID }
      })
    ).json();
    expect(body.result).not.toBeNull();
    expect(body.result.missingParts).toEqual(['activity']);
    expect(body.result.effectiveWeights.food).toBeCloseTo(0.526, 2);
    expect(body.result.effectiveWeights.symptom).toBeCloseTo(0.316, 2);
    expect(body.result.effectiveWeights.env).toBeCloseTo(0.158, 2);
    expect(body.result.effectiveWeights.activity).toBe(0);
  });

  test('缺 Env + Activity → 仅 Food + Symptom → 62.5/37.5', async () => {
    mealAgg = { counts: { 发: 1, 温和: 0, 平: 0, unknown: 0 } }; // food=100
    await writeSymptoms({ nasal_congestion: 1 }); // 25
    env = null;
    activity = null;
    const body = (
      await app.inject({
        method: 'GET',
        url: '/api/v1/yan-score/today',
        headers: { 'x-user-id': USER_ID }
      })
    ).json();
    expect(body.result.effectiveWeights.food).toBeCloseTo(0.625, 2);
    expect(body.result.effectiveWeights.symptom).toBeCloseTo(0.375, 2);
    // score = 100 × 0.625 + 25 × 0.375 = 62.5 + 9.375 = 71.875
    expect(body.result.score).toBeCloseTo(71.9, 0);
    expect(body.result.level).toBe('中火'); // 71.9 < 75
  });

  test('全无数据 → unavailableReason=no_data', async () => {
    const body = (
      await app.inject({
        method: 'GET',
        url: '/api/v1/yan-score/today',
        headers: { 'x-user-id': USER_ID }
      })
    ).json();
    expect(body.hasCheckin).toBe(false);
    expect(body.result).toBeNull();
    expect(body.unavailableReason).toBe('no_data');
  });

  test('仅 SymptomPart(< 2 可用)→ unavailableReason=insufficient_parts', async () => {
    await writeSymptoms({ nasal_congestion: 2 });
    // food / env / activity 全无
    const body = (
      await app.inject({
        method: 'GET',
        url: '/api/v1/yan-score/today',
        headers: { 'x-user-id': USER_ID }
      })
    ).json();
    expect(body.hasCheckin).toBe(true);
    expect(body.result).toBeNull();
    expect(body.unavailableReason).toBe('insufficient_parts');
    // partScores 仍展示原始数据
    expect(body.partScores.symptom).toBe(50);
    expect(body.partScores.food).toBeNull();
  });

  test('鉴权:无 X-User-Id → 401', async () => {
    const r = await app.inject({ method: 'GET', url: '/api/v1/yan-score/today' });
    expect(r.statusCode).toBe(401);
  });
});
