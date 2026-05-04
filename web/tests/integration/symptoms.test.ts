/**
 * U7 次晨打卡测试
 *
 * 对应 plan U7 测试场景:
 *   AE1: Step 1 写入(7 维度,默认 engaged=false)— 不读昨日
 *   AE3: Day 1 用户(无打卡)→ /yan-score/today hasCheckin=false
 *   R12: 不展示昨日(API 强制分离 — Step 1 写,/symptoms/yesterday/compare 给 Step 2)
 *   R14: Yan-Score 揭晓(占位算法 → SymptomPart only)
 *   定义版本:写入时记录 definition_version
 *   越权:无 X-User-Id → 401
 *   未初始化:user_not_initialized → 403
 *   Edge:engaged=true + severity=null 视为无效(default-effect 防御 / Round 2 修订)
 */

import type { FastifyInstance } from 'fastify';
import { buildApp } from '../../server/app';
import { resetKmsForTesting, getKms } from '../../server/crypto/kms';
import { clearDekCacheForTesting, decryptField } from '../../server/crypto/envelope';
import {
  effectiveSeverityMap,
  type CheckinSource,
  type CreateSymptomParams,
  type SymptomCheckinPayload,
  type SymptomDimension,
  type SymptomRow,
  type SymptomStore
} from '../../server/services/symptoms';

class FakeSymptomStore implements SymptomStore {
  rows: SymptomRow[] = [];
  nextId = 1;

  async upsert(p: CreateSymptomParams): Promise<string> {
    const existing = this.rows.find(
      (r) => r.userId === p.userId && r.recordedForDate === p.recordedForDate && r.source === p.source
    );
    if (existing) {
      existing.blindInputCiphertext = p.blindInputCiphertext;
      existing.severityCiphertext = p.severityCiphertext;
      existing.definitionVersion = p.definitionVersion;
      return existing.id;
    }
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

  async findByDate(userId: string, date: string, source: CheckinSource = 'next_morning'): Promise<SymptomRow | null> {
    return this.rows.find((r) => r.userId === userId && r.recordedForDate === date && r.source === source) ?? null;
  }

  async findYesterday(userId: string, today: string, source: CheckinSource = 'next_morning'): Promise<SymptomRow | null> {
    const y = new Date(today);
    y.setUTCDate(y.getUTCDate() - 1);
    const yesterday = y.toISOString().slice(0, 10);
    return this.findByDate(userId, yesterday, source);
  }
  async countDistinctCheckinDates(userId: string): Promise<number> {
    const set = new Set<string>();
    for (const r of this.rows) {
      if (r.userId === userId && r.source === 'next_morning') set.add(r.recordedForDate);
    }
    return set.size;
  }
}

// ─── effectiveSeverityMap pure tests ───────────────────────────────────

describe('U7 effectiveSeverityMap (default-effect 防御)', () => {
  test('engaged=true + severity 有效 → 进 map', () => {
    const p: SymptomCheckinPayload = {
      nasal_congestion: { engaged: true, severity: 2 }
    };
    expect(effectiveSeverityMap(p)).toEqual({ nasal_congestion: 2 });
  });

  test('engaged=true + severity=null(用户勾了没滑)→ 不进 map', () => {
    const p: SymptomCheckinPayload = {
      acne: { engaged: true, severity: null },
      bowel: { engaged: true, severity: 3 }
    };
    expect(effectiveSeverityMap(p)).toEqual({ bowel: 3 });
  });

  test('engaged=false → 不进 map(无论 severity 是否)', () => {
    const p: SymptomCheckinPayload = {
      nasal_congestion: { engaged: false, severity: 2 }
    };
    expect(effectiveSeverityMap(p)).toEqual({});
  });
});

// ─── HTTP routes ───────────────────────────────────────────────────────

describe('U7 HTTP — symptoms + yan-score 占位', () => {
  let app: FastifyInstance;
  let store: FakeSymptomStore;
  let userDek: string;
  const USER_ID = 'u1';

  beforeEach(async () => {
    resetKmsForTesting();
    clearDekCacheForTesting();
    store = new FakeSymptomStore();
    const dk = await getKms().generateDataKey(USER_ID);
    userDek = dk.ciphertext.toString('base64');

    const getUserDek = async (uid: string) => (uid === USER_ID ? userDek : null);
    app = await buildApp({
      v1: {
        symptoms: { deps: { store, getUserDek } },
        yanScore: {
          deps: {
            symptomStore: store,
            getUserDek,
            // 不连真 DB:meals 聚合 / env / activity 全占位
            loadDailyMealAggregate: async () => ({ counts: { 发: 0, 温和: 0, 平: 0, unknown: 0 } }),
            loadEnvSnapshot: async () => null,
            loadActivitySnapshot: async () => null
          }
        }
      }
    });
  });

  afterEach(async () => {
    await app.close();
  });

  test('AE3 Day 1: 没打卡 → /yan-score/today hasCheckin=false + unavailableReason=no_data (post-U8)', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/yan-score/today',
      headers: { 'x-user-id': USER_ID }
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.hasCheckin).toBe(false);
    expect(body.result).toBeNull();
    expect(body.unavailableReason).toBe('no_data');
  });

  test('Step 1 提交盲打卡 → 写入,definition_version 记录', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/symptoms/checkin',
      headers: { 'content-type': 'application/json', 'x-user-id': USER_ID },
      payload: {
        recordedForDate: '2026-05-04',
        payload: {
          nasal_congestion: { engaged: true, severity: 2 },
          acne: { engaged: false, severity: null },
          bowel: { engaged: true, severity: null }, // 勾了没滑 → 视为无效
          dry_mouth: { engaged: true, severity: 1 }
        }
      }
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().recordedForDate).toBe('2026-05-04');

    const row = store.rows[0];
    expect(row.definitionVersion).toBe(1);
    expect(row.source).toBe('next_morning');

    // 解密 blindInput → 完整 payload(含 engaged=true severity=null 项)
    const blind = await decryptField<SymptomCheckinPayload>(USER_ID, userDek, row.blindInputCiphertext);
    expect(blind.bowel).toEqual({ engaged: true, severity: null });

    // severity_ciphertext → 仅含真正滑动的(default-effect 防御)
    const sev = await decryptField<Record<SymptomDimension, number>>(USER_ID, userDek, row.severityCiphertext);
    expect(sev).toEqual({ nasal_congestion: 2, dry_mouth: 1 });
  });

  test('R12: GET /symptoms/yesterday/compare 不存在时 hasYesterday=false', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/symptoms/yesterday/compare?today=2026-05-04',
      headers: { 'x-user-id': USER_ID }
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ ok: true, hasYesterday: false });
  });

  test('Step 2 对照:昨天打卡过 → 今早查 yesterday/compare 拿到 payload', async () => {
    // Day N-1 打卡
    await app.inject({
      method: 'POST',
      url: '/api/v1/symptoms/checkin',
      headers: { 'content-type': 'application/json', 'x-user-id': USER_ID },
      payload: {
        recordedForDate: '2026-05-03',
        payload: {
          nasal_congestion: { engaged: true, severity: 2 },
          dry_mouth: { engaged: true, severity: 3 }
        }
      }
    });
    // Day N 拉对照
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/symptoms/yesterday/compare?today=2026-05-04',
      headers: { 'x-user-id': USER_ID }
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.hasYesterday).toBe(true);
    expect(body.recordedForDate).toBe('2026-05-03');
    expect(body.payload.nasal_congestion).toEqual({ engaged: true, severity: 2 });
  });

  test('R14 post-U8: 仅 SymptomPart 可用(< 2)→ unavailableReason=insufficient_parts', async () => {
    // U8 算法要求 ≥ 2 个 Part 可用,单 Symptom 不够 → null
    await app.inject({
      method: 'POST',
      url: '/api/v1/symptoms/checkin',
      headers: { 'content-type': 'application/json', 'x-user-id': USER_ID },
      payload: {
        payload: {
          nasal_congestion: { engaged: true, severity: 4 },
          dry_mouth: { engaged: true, severity: 2 }
        }
      }
    });
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/yan-score/today',
      headers: { 'x-user-id': USER_ID }
    });
    const body = res.json();
    expect(body.hasCheckin).toBe(true);
    expect(body.result).toBeNull();
    expect(body.unavailableReason).toBe('insufficient_parts');
    // partScores 仍展示给前端原始 Symptom 分数
    expect(body.partScores.symptom).toBe(75);
    expect(body.partScores.food).toBeNull();
  });

  test('Edge: 用户未初始化 → POST /symptoms/checkin 返回 403', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/symptoms/checkin',
      headers: { 'content-type': 'application/json', 'x-user-id': 'u-no-dek' },
      payload: {
        payload: {
          nasal_congestion: { engaged: true, severity: 1 }
        }
      }
    });
    expect(res.statusCode).toBe(403);
    expect(res.json().error).toBe('user_not_initialized');
  });

  test('鉴权: 无 X-User-Id → 401', async () => {
    const r1 = await app.inject({
      method: 'POST',
      url: '/api/v1/symptoms/checkin',
      headers: { 'content-type': 'application/json' },
      payload: { payload: {} }
    });
    expect(r1.statusCode).toBe(401);

    const r2 = await app.inject({ method: 'GET', url: '/api/v1/yan-score/today' });
    expect(r2.statusCode).toBe(401);

    const r3 = await app.inject({ method: 'GET', url: '/api/v1/symptoms/yesterday/compare' });
    expect(r3.statusCode).toBe(401);
  });

  test('zod: invalid severity → 400', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/symptoms/checkin',
      headers: { 'content-type': 'application/json', 'x-user-id': USER_ID },
      payload: {
        payload: {
          nasal_congestion: { engaged: true, severity: 99 } // out of range
        }
      }
    });
    expect(res.statusCode).toBe(400);
  });

  test('幂等:同一天同 source 第二次提交 = upsert 覆盖', async () => {
    const a = await app.inject({
      method: 'POST',
      url: '/api/v1/symptoms/checkin',
      headers: { 'content-type': 'application/json', 'x-user-id': USER_ID },
      payload: {
        recordedForDate: '2026-05-04',
        payload: { nasal_congestion: { engaged: true, severity: 1 } }
      }
    });
    const b = await app.inject({
      method: 'POST',
      url: '/api/v1/symptoms/checkin',
      headers: { 'content-type': 'application/json', 'x-user-id': USER_ID },
      payload: {
        recordedForDate: '2026-05-04',
        payload: { nasal_congestion: { engaged: true, severity: 4 } }
      }
    });
    expect(a.json().id).toBe(b.json().id);
    expect(store.rows).toHaveLength(1);
    const sev = await decryptField<Record<string, number>>(
      USER_ID,
      userDek,
      store.rows[0].severityCiphertext
    );
    expect(sev.nasal_congestion).toBe(4);
  });
});
