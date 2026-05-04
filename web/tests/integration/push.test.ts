/**
 * U11 Web Push 路由测试
 *
 * - GET  /push/vapid-public-key — 返回 publicKey 或 vapid_not_configured
 * - POST /push/subscribe        — upsert by endpoint
 * - POST /push/unsubscribe      — 删除指定 endpoint
 * - 鉴权:无 X-User-Id → 401
 */

import type { FastifyInstance } from 'fastify';
import { buildApp } from '../../server/app';
import type {
  PushSubscriptionInput,
  PushSubscriptionRow,
  PushSubscriptionStore
} from '../../server/services/push';

class FakePushStore implements PushSubscriptionStore {
  rows = new Map<string, PushSubscriptionRow>();
  nextId = 1;
  async upsert(userId: string, sub: PushSubscriptionInput): Promise<PushSubscriptionRow> {
    const existing = this.rows.get(sub.endpoint);
    if (existing) {
      const updated: PushSubscriptionRow = {
        ...existing,
        userId,
        p256dh: sub.p256dh,
        auth: sub.auth,
        userAgent: sub.userAgent ?? null,
        lastUsedAt: new Date()
      };
      this.rows.set(sub.endpoint, updated);
      return updated;
    }
    const row: PushSubscriptionRow = {
      id: `ps-${this.nextId++}`,
      userId,
      endpoint: sub.endpoint,
      p256dh: sub.p256dh,
      auth: sub.auth,
      userAgent: sub.userAgent ?? null,
      createdAt: new Date(),
      lastUsedAt: null
    };
    this.rows.set(sub.endpoint, row);
    return row;
  }
  async removeByEndpoint(userId: string, endpoint: string): Promise<boolean> {
    const row = this.rows.get(endpoint);
    if (!row || row.userId !== userId) return false;
    this.rows.delete(endpoint);
    return true;
  }
  async listByUser(userId: string): Promise<PushSubscriptionRow[]> {
    return [...this.rows.values()].filter((r) => r.userId === userId);
  }
  async markUsed(): Promise<void> {
    /* noop */
  }
}

const USER = 'u1';
const ENDPOINT = 'https://fcm.googleapis.com/fcm/send/abc';

describe('U11 push', () => {
  let app: FastifyInstance;
  let store: FakePushStore;

  beforeEach(async () => {
    store = new FakePushStore();
    app = await buildApp({
      v1: { push: { deps: { store, vapidPublicKey: 'BPUBLIC_KEY_DEMO' } } }
    });
  });
  afterEach(async () => {
    await app.close();
  });

  test('GET /push/vapid-public-key 返回 publicKey', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/push/vapid-public-key' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ ok: true, publicKey: 'BPUBLIC_KEY_DEMO' });
  });

  test('GET /push/vapid-public-key 未配置时返回 vapid_not_configured', async () => {
    await app.close();
    app = await buildApp({ v1: { push: { deps: { store, vapidPublicKey: '' } } } });
    const res = await app.inject({ method: 'GET', url: '/api/v1/push/vapid-public-key' });
    expect(res.json()).toEqual({ ok: false, error: 'vapid_not_configured' });
  });

  test('POST /push/subscribe 入库,重复 endpoint upsert', async () => {
    const r1 = await app.inject({
      method: 'POST',
      url: '/api/v1/push/subscribe',
      headers: { 'x-user-id': USER, 'content-type': 'application/json' },
      payload: { endpoint: ENDPOINT, p256dh: 'k1', auth: 'a1' }
    });
    expect(r1.statusCode).toBe(200);
    expect(r1.json().ok).toBe(true);
    expect(store.rows.size).toBe(1);

    const r2 = await app.inject({
      method: 'POST',
      url: '/api/v1/push/subscribe',
      headers: { 'x-user-id': USER, 'content-type': 'application/json' },
      payload: { endpoint: ENDPOINT, p256dh: 'k2', auth: 'a2' }
    });
    expect(r2.statusCode).toBe(200);
    expect(store.rows.size).toBe(1);
    expect(store.rows.get(ENDPOINT)?.p256dh).toBe('k2');
  });

  test('POST /push/subscribe 校验 invalid endpoint → 400', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/push/subscribe',
      headers: { 'x-user-id': USER, 'content-type': 'application/json' },
      payload: { endpoint: 'not-a-url', p256dh: 'k', auth: 'a' }
    });
    expect(res.statusCode).toBe(400);
  });

  test('POST /push/unsubscribe 删除订阅', async () => {
    await store.upsert(USER, { endpoint: ENDPOINT, p256dh: 'k', auth: 'a' });
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/push/unsubscribe',
      headers: { 'x-user-id': USER, 'content-type': 'application/json' },
      payload: { endpoint: ENDPOINT }
    });
    expect(res.json()).toEqual({ ok: true, removed: true });
    expect(store.rows.size).toBe(0);
  });

  test('POST /push/unsubscribe 跨用户 → removed=false', async () => {
    await store.upsert('other-user', { endpoint: ENDPOINT, p256dh: 'k', auth: 'a' });
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/push/unsubscribe',
      headers: { 'x-user-id': USER, 'content-type': 'application/json' },
      payload: { endpoint: ENDPOINT }
    });
    expect(res.json()).toEqual({ ok: true, removed: false });
    expect(store.rows.size).toBe(1);
  });

  test('鉴权:无 X-User-Id → 401', async () => {
    const r1 = await app.inject({
      method: 'POST',
      url: '/api/v1/push/subscribe',
      headers: { 'content-type': 'application/json' },
      payload: { endpoint: ENDPOINT, p256dh: 'k', auth: 'a' }
    });
    expect(r1.statusCode).toBe(401);

    const r2 = await app.inject({
      method: 'POST',
      url: '/api/v1/push/unsubscribe',
      headers: { 'content-type': 'application/json' },
      payload: { endpoint: ENDPOINT }
    });
    expect(r2.statusCode).toBe(401);
  });
});
