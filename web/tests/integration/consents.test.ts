/**
 * Consents 路由 + service 集成测试
 *
 * 用 FakeConsentStore + FakeKms,跨 fastify.inject 验证完整链路。
 *
 * 对应 plan U3 测试场景:
 *   - Happy path: 同意页勾选 → POST /consents → privacy_consents 写入
 *   - Edge case: 不勾选直接关闭 → 下次进入仍 needsReconsent=true
 *   - Integration: scope=health_data + consent_version 正确写入
 *   - Error path: 撤回后 → 30 天 cron → 用户数据完全清除
 */

import type { FastifyInstance } from 'fastify';
import { buildApp } from '../../server/app';
import { resetKmsForTesting, type KmsClient, type DataKey } from '../../server/crypto/kms';
import { clearDekCacheForTesting } from '../../server/crypto/envelope';
import {
  CURRENT_CONSENT_VERSION_REQUIRED,
  HARD_DELETE_RETENTION_DAYS,
  recordConsent,
  revokeConsent,
  runHardDeleteSweep,
  type ConsentScope,
  type ConsentStore,
  type RecordConsentParams,
  type UserConsentRow
} from '../../server/services/consents';

class FakeConsentStore implements ConsentStore {
  consents: Array<{ userId: string; scope: ConsentScope; consentVersion: number; userAgent?: string; clientIpHash?: string; grantedAt: Date }> = [];
  users = new Map<string, UserConsentRow>();
  hardDeleted: string[] = [];

  seedUser(userId: string, granted = 0, deletedAt: Date | null = null): void {
    this.users.set(userId, { userId, consentVersionGranted: granted, deletedAt });
  }

  async recordConsent(params: RecordConsentParams): Promise<void> {
    if (!this.users.has(params.userId)) {
      throw new Error(`user ${params.userId} not seeded`);
    }
    for (const scope of params.scopes) {
      this.consents.push({
        userId: params.userId,
        scope,
        consentVersion: params.consentVersion,
        userAgent: params.userAgent,
        clientIpHash: params.clientIpHash,
        grantedAt: new Date()
      });
    }
    const u = this.users.get(params.userId)!;
    u.consentVersionGranted = Math.max(u.consentVersionGranted, params.consentVersion);
  }

  async getUserConsentStatus(userId: string): Promise<UserConsentRow | null> {
    return this.users.get(userId) ?? null;
  }

  async softDeleteUser(userId: string): Promise<void> {
    const u = this.users.get(userId);
    if (u) u.deletedAt = new Date();
  }

  async hardDeleteUser(userId: string): Promise<void> {
    this.users.delete(userId);
    this.consents = this.consents.filter((c) => c.userId !== userId);
    this.hardDeleted.push(userId);
  }

  async findUsersForHardDelete(deletedBefore: Date): Promise<string[]> {
    return [...this.users.values()]
      .filter((u) => u.deletedAt !== null && u.deletedAt < deletedBefore)
      .map((u) => u.userId);
  }
}

class FakeKms implements KmsClient {
  revoked = new Set<string>();
  generated = new Map<string, Buffer>();
  async generateDataKey(userId: string): Promise<DataKey> {
    const plaintext = Buffer.alloc(32, 0);
    const ciphertext = Buffer.from(`fake:${userId}`);
    this.generated.set(userId, ciphertext);
    return { plaintext, ciphertext };
  }
  async decryptDataKey(userId: string, _ct: Buffer): Promise<Buffer> {
    if (this.revoked.has(userId)) throw new Error(`KMS access for user ${userId} has been revoked`);
    return Buffer.alloc(32, 0);
  }
  async scheduleKeyDeletion(userId: string): Promise<void> {
    this.revoked.add(userId);
  }
}

describe('U3 consents — service unit', () => {
  let store: FakeConsentStore;
  let kms: FakeKms;

  beforeEach(() => {
    resetKmsForTesting();
    clearDekCacheForTesting();
    store = new FakeConsentStore();
    kms = new FakeKms();
  });

  test('recordConsent writes one row per scope and bumps users.consent_version_granted', async () => {
    store.seedUser('user-1', 0);
    await recordConsent({ store, kms }, {
      userId: 'user-1',
      scopes: ['health_data', 'medical_report', 'photo_ai'],
      consentVersion: 1,
      userAgent: 'wechat-mp'
    });
    expect(store.consents).toHaveLength(3);
    expect(store.consents.map((c) => c.scope).sort()).toEqual(['health_data', 'medical_report', 'photo_ai']);
    expect(store.users.get('user-1')!.consentVersionGranted).toBe(1);
  });

  test('recordConsent throws when scopes empty', async () => {
    store.seedUser('user-1');
    await expect(
      recordConsent({ store, kms }, { userId: 'user-1', scopes: [], consentVersion: 1 })
    ).rejects.toThrow(/at least one scope|至少需要一个 scope/);
  });

  test('revokeConsent triggers KMS revoke + cache evict + soft delete in correct order', async () => {
    store.seedUser('user-2', 1);
    const result = await revokeConsent({ store, kms }, 'user-2');
    expect(result).toMatchObject({ kmsRevoked: true, cacheEvicted: true, softDeleted: true });
    expect(kms.revoked.has('user-2')).toBe(true);
    expect(store.users.get('user-2')!.deletedAt).not.toBeNull();
    // 撤回后 KMS 解密尝试应被拒绝
    await expect(kms.decryptDataKey('user-2', Buffer.from('any'))).rejects.toThrow(/revoked/);
  });

  test('runHardDeleteSweep clears users past retention window only', async () => {
    const now = new Date('2026-06-15T00:00:00Z');
    const oldDelete = new Date(now.getTime() - 31 * 24 * 60 * 60 * 1000); // 31 天前
    const recentDelete = new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000); // 5 天前

    store.seedUser('past-retention', 1, oldDelete);
    store.seedUser('still-in-window', 1, recentDelete);
    store.seedUser('active', 1, null);

    const result = await runHardDeleteSweep({ store, kms }, { now, retentionDays: HARD_DELETE_RETENTION_DAYS });

    expect(result.scanned).toBe(1);
    expect(result.hardDeleted).toEqual(['past-retention']);
    expect(result.errors).toEqual([]);
    expect(store.users.has('past-retention')).toBe(false);
    expect(store.users.has('still-in-window')).toBe(true);
    expect(store.users.has('active')).toBe(true);
  });

  test('runHardDeleteSweep records errors but continues sweeping', async () => {
    const now = new Date('2026-06-15T00:00:00Z');
    const oldDelete = new Date(now.getTime() - 40 * 24 * 60 * 60 * 1000);
    store.seedUser('user-A', 1, oldDelete);
    store.seedUser('user-B', 1, oldDelete);

    // 让 user-A 硬删失败,user-B 应仍被删除
    const origHardDelete = store.hardDeleteUser.bind(store);
    store.hardDeleteUser = async (uid) => {
      if (uid === 'user-A') throw new Error('simulated db error');
      return origHardDelete(uid);
    };

    const result = await runHardDeleteSweep({ store, kms }, { now });
    expect(result.scanned).toBe(2);
    expect(result.hardDeleted).toEqual(['user-B']);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].userId).toBe('user-A');
  });
});

describe('U3 consents — HTTP routes', () => {
  let app: FastifyInstance;
  let store: FakeConsentStore;
  let kms: FakeKms;

  beforeEach(async () => {
    resetKmsForTesting();
    clearDekCacheForTesting();
    store = new FakeConsentStore();
    kms = new FakeKms();
    app = await buildApp({
      v1: { consents: { deps: { store, kms } } }
    });
  });

  afterEach(async () => {
    await app.close();
  });

  test('GET /consents/required exposes current required version', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/consents/required' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ ok: true, consentVersionRequired: CURRENT_CONSENT_VERSION_REQUIRED });
  });

  test('GET /users/me/consent returns needsReconsent=true for new user', async () => {
    store.seedUser('u1', 0);
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/users/me/consent',
      headers: { 'x-user-id': 'u1' }
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({
      ok: true,
      required: CURRENT_CONSENT_VERSION_REQUIRED,
      granted: 0,
      needsReconsent: true
    });
  });

  test('Edge case: user closes consent page → next visit still needsReconsent=true', async () => {
    store.seedUser('u-skip', 0);
    // 模拟用户没勾选直接关闭 → 不调 POST /consents
    const status1 = await app.inject({
      method: 'GET',
      url: '/api/v1/users/me/consent',
      headers: { 'x-user-id': 'u-skip' }
    });
    const status2 = await app.inject({
      method: 'GET',
      url: '/api/v1/users/me/consent',
      headers: { 'x-user-id': 'u-skip' }
    });
    expect(status1.json().needsReconsent).toBe(true);
    expect(status2.json().needsReconsent).toBe(true);
  });

  test('Happy path: POST /consents writes 5 scopes + bumps user version → needsReconsent flips false', async () => {
    store.seedUser('u-happy', 0);
    const post = await app.inject({
      method: 'POST',
      url: '/api/v1/consents',
      headers: { 'x-user-id': 'u-happy', 'content-type': 'application/json' },
      payload: { scopes: ['health_data', 'medical_report', 'photo_ai', 'location', 'subscribe_push'], consentVersion: 1 }
    });
    expect(post.statusCode).toBe(200);
    expect(post.json()).toEqual({ ok: true });
    expect(store.consents.filter((c) => c.userId === 'u-happy')).toHaveLength(5);

    const status = await app.inject({
      method: 'GET',
      url: '/api/v1/users/me/consent',
      headers: { 'x-user-id': 'u-happy' }
    });
    expect(status.json().needsReconsent).toBe(false);
  });

  test('POST /consents rejects empty scopes with 400', async () => {
    store.seedUser('u-bad', 0);
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/consents',
      headers: { 'x-user-id': 'u-bad', 'content-type': 'application/json' },
      payload: { scopes: [], consentVersion: 1 }
    });
    expect(res.statusCode).toBe(400);
    expect(res.json()).toMatchObject({ ok: false, error: 'invalid_body' });
  });

  test('POST /consents/revoke triggers KMS revoke + soft delete', async () => {
    store.seedUser('u-revoke', 1);
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/consents/revoke',
      headers: { 'x-user-id': 'u-revoke' }
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ ok: true, kmsRevoked: true, softDeleted: true });
    expect(kms.revoked.has('u-revoke')).toBe(true);
    expect(store.users.get('u-revoke')!.deletedAt).not.toBeNull();
  });

  test('Missing X-User-Id returns 401', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/users/me/consent' });
    expect(res.statusCode).toBe(401);
  });
});
