/**
 * Onboarding 后端 — POST /users (login-or-create) + POST /users/me/baseline
 *
 * 对应 plan U4 测试场景:
 *   - Happy path: 5 步完成 → 主屏可正常显示(此处验证后端写入)
 *   - Edge case: step2 全选"几乎没有" → step3 体质提示展示"目前看起来很平和"
 *                (这个分支由 inferInitialFireLevel 单测覆盖)
 *   - Edge case: step4 微信运动授权拒绝 → 流程继续 — 与后端无关,mp 测试覆盖
 *   - Edge case: 中途强退 → 重进回到上一步 — mp 测试覆盖
 */

import type { FastifyInstance } from 'fastify';
import { buildApp } from '../../server/app';
import { resetKmsForTesting, type KmsClient, type DataKey } from '../../server/crypto/kms';
import { clearDekCacheForTesting } from '../../server/crypto/envelope';
import {
  inferInitialFireLevel,
  type CodeToSessionResolver,
  type OnboardingBaseline,
  type UserStore,
  type UserRow
} from '../../server/services/users';

class FakeUserStore implements UserStore {
  byOpenid = new Map<string, UserRow>();
  byId = new Map<string, UserRow>();
  baselines = new Map<string, Record<string, unknown>>();
  nextId = 1;

  async findByOpenid(openid: string): Promise<UserRow | null> {
    return this.byOpenid.get(openid) ?? null;
  }
  async findById(id: string): Promise<UserRow | null> {
    return this.byId.get(id) ?? null;
  }
  async createUser(params: { wxOpenid: string; dekCiphertextB64: string }): Promise<string> {
    const id = `u-${this.nextId++}`;
    const row: UserRow = {
      id,
      wxOpenid: params.wxOpenid,
      consentVersionGranted: 0,
      baselineSummary: {},
      deletedAt: null
    };
    this.byOpenid.set(params.wxOpenid, row);
    this.byId.set(id, row);
    return id;
  }
  async createUserById(params: { id: string; dekCiphertextB64: string }): Promise<void> {
    if (this.byId.has(params.id)) return;
    const row: UserRow = {
      id: params.id,
      wxOpenid: `supabase:${params.id}`,
      consentVersionGranted: 0,
      baselineSummary: {},
      deletedAt: null
    };
    this.byId.set(params.id, row);
    this.byOpenid.set(`supabase:${params.id}`, row);
  }
  async updateBaseline(userId: string, baseline: OnboardingBaseline): Promise<void> {
    this.baselines.set(userId, baseline as unknown as Record<string, unknown>);
    const row = this.byId.get(userId);
    if (row) row.baselineSummary = baseline as unknown as Record<string, unknown>;
  }
}

class FakeKms implements KmsClient {
  async generateDataKey(_userId: string): Promise<DataKey> {
    return { plaintext: Buffer.alloc(32, 0), ciphertext: Buffer.from('fake-dek-ciphertext') };
  }
  async decryptDataKey(_userId: string, _ct: Buffer): Promise<Buffer> {
    return Buffer.alloc(32, 0);
  }
  async scheduleKeyDeletion(_userId: string): Promise<void> {
    /* noop */
  }
}

class FakeResolver implements CodeToSessionResolver {
  async resolve(code: string): Promise<{ openid: string }> {
    return { openid: `openid-${code}` };
  }
}

describe('U4 onboarding — inferInitialFireLevel', () => {
  test('all "rare" → 平', () => {
    const res = inferInitialFireLevel({
      reverseFilterChoice: 'curious',
      symptomsFrequency: {
        nasal_congestion: 'rare',
        acne: 'rare',
        dry_mouth: 'rare',
        bowel: 'rare',
        fatigue: 'rare',
        edema: 'rare',
        throat_itch: 'rare'
      }
    });
    expect(res.level).toBe('平');
  });

  test('mixed sometimes/often → 中火 or 大火', () => {
    const res = inferInitialFireLevel({
      reverseFilterChoice: 'rhinitis',
      symptomsFrequency: {
        nasal_congestion: 'often',
        acne: 'often',
        dry_mouth: 'sometimes',
        bowel: 'sometimes',
        fatigue: 'often',
        edema: 'rare',
        throat_itch: 'sometimes'
      }
    });
    expect(['中火', '大火']).toContain(res.level);
  });

  test('empty frequency → 平 (ratio=0)', () => {
    const res = inferInitialFireLevel({
      reverseFilterChoice: 'curious',
      symptomsFrequency: {}
    });
    expect(res.level).toBe('平');
    expect(res.ratio).toBe(0);
  });
});

describe('U4 onboarding — HTTP routes', () => {
  let app: FastifyInstance;
  let store: FakeUserStore;
  let kms: FakeKms;
  let resolver: FakeResolver;

  beforeEach(async () => {
    resetKmsForTesting();
    clearDekCacheForTesting();
    store = new FakeUserStore();
    kms = new FakeKms();
    resolver = new FakeResolver();
    app = await buildApp({
      v1: {
        // KMS 走全局(getKms),但测试用 LocalKmsStub master key 在 setup.ts 注入,行为类似
        consents: { deps: { store: { recordConsent: jest.fn(), getUserConsentStatus: jest.fn(), softDeleteUser: jest.fn(), hardDeleteUser: jest.fn(), findUsersForHardDelete: jest.fn(async () => []) } as never, kms } },
        onboarding: { deps: { store, resolver } }
      }
    });
  });

  afterEach(async () => {
    await app.close();
  });

  test('POST /users with new code creates a user and returns isNew=true', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/users',
      headers: { 'content-type': 'application/json' },
      payload: { code: 'wx-code-1' }
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.ok).toBe(true);
    expect(body.isNew).toBe(true);
    expect(body.userId).toMatch(/^u-/);
    expect(store.byOpenid.has('openid-wx-code-1')).toBe(true);
  });

  test('POST /users with same code twice → second is isNew=false (idempotent)', async () => {
    const r1 = await app.inject({
      method: 'POST',
      url: '/api/v1/users',
      headers: { 'content-type': 'application/json' },
      payload: { code: 'wx-code-2' }
    });
    const r2 = await app.inject({
      method: 'POST',
      url: '/api/v1/users',
      headers: { 'content-type': 'application/json' },
      payload: { code: 'wx-code-2' }
    });
    expect(r1.json().userId).toBe(r2.json().userId);
    expect(r1.json().isNew).toBe(true);
    expect(r2.json().isNew).toBe(false);
  });

  test('POST /users with empty code → 400', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/users',
      headers: { 'content-type': 'application/json' },
      payload: { code: '' }
    });
    expect(res.statusCode).toBe(400);
  });

  test('POST /users/me/baseline writes baseline_summary + returns initialFireLevel', async () => {
    const create = await app.inject({
      method: 'POST',
      url: '/api/v1/users',
      headers: { 'content-type': 'application/json' },
      payload: { code: 'wx-code-3' }
    });
    const userId = create.json().userId;

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/users/me/baseline',
      headers: { 'content-type': 'application/json', 'x-user-id': userId },
      payload: {
        reverseFilterChoice: 'rhinitis',
        symptomsFrequency: {
          nasal_congestion: 'often',
          acne: 'sometimes',
          dry_mouth: 'rare'
        }
      }
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.ok).toBe(true);
    expect(['平', '微火', '中火', '大火']).toContain(body.initialFireLevel);
    expect(store.baselines.get(userId)).toMatchObject({
      reverseFilterChoice: 'rhinitis',
      symptomsFrequency: { nasal_congestion: 'often' }
    });
  });

  test('POST /users/me/baseline rejects invalid reverseFilterChoice with 400', async () => {
    const create = await app.inject({
      method: 'POST',
      url: '/api/v1/users',
      headers: { 'content-type': 'application/json' },
      payload: { code: 'wx-code-4' }
    });
    const userId = create.json().userId;

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/users/me/baseline',
      headers: { 'content-type': 'application/json', 'x-user-id': userId },
      payload: {
        reverseFilterChoice: 'lose_weight',  // 不在 enum
        symptomsFrequency: {}
      }
    });
    expect(res.statusCode).toBe(400);
  });

  test('POST /users/me/ensure creates public.users row when missing (idempotent)', async () => {
    const userId = 'auth-user-supabase-uuid-1';
    expect(store.byId.has(userId)).toBe(false);

    const r1 = await app.inject({
      method: 'POST',
      url: '/api/v1/users/me/ensure',
      headers: { 'x-user-id': userId }
    });
    expect(r1.statusCode).toBe(200);
    expect(r1.json()).toEqual({ ok: true, userId, wasCreated: true });
    expect(store.byId.has(userId)).toBe(true);

    // 第二次幂等
    const r2 = await app.inject({
      method: 'POST',
      url: '/api/v1/users/me/ensure',
      headers: { 'x-user-id': userId }
    });
    expect(r2.json()).toEqual({ ok: true, userId, wasCreated: false });
  });

  test('POST /users/me/ensure without auth → 401', async () => {
    const res = await app.inject({ method: 'POST', url: '/api/v1/users/me/ensure' });
    expect(res.statusCode).toBe(401);
  });

  test('POST /users/me/baseline without X-User-Id → 401', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/users/me/baseline',
      headers: { 'content-type': 'application/json' },
      payload: {
        reverseFilterChoice: 'curious',
        symptomsFrequency: {}
      }
    });
    expect(res.statusCode).toBe(401);
  });
});
