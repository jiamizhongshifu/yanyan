/**
 * Phase 2 U9 — 真实 Web Push + in-app 兜底队列 测试
 *
 * 覆盖:
 *   - sendToUser:多订阅并发 + 部分 gone cleanup
 *   - sendToUser:全部失败 → inapp 兜底
 *   - sendToUser:无订阅 → 直接 inapp 兜底
 *   - sendToUser:hasPendingToday=true → 跳过(防重复打扰)
 *   - GET /push/inapp/pending + POST /push/inapp/:id/dismiss
 */

import type { FastifyInstance } from 'fastify';
import { buildApp } from '../../server/app';
import {
  sendToUser,
  type InappReminder,
  type InappReminderStore,
  type PushPayload,
  type PushSender,
  type PushSubscriptionInput,
  type PushSubscriptionRow,
  type PushSubscriptionStore,
  type ReminderKind,
  type SendResult
} from '../../server/services/push';

// ─── Fakes ───
class FakePushStore implements PushSubscriptionStore {
  rows: PushSubscriptionRow[] = [];
  async upsert(userId: string, sub: PushSubscriptionInput): Promise<PushSubscriptionRow> {
    const row: PushSubscriptionRow = {
      id: `ps-${this.rows.length + 1}`,
      userId,
      endpoint: sub.endpoint,
      p256dh: sub.p256dh,
      auth: sub.auth,
      userAgent: sub.userAgent ?? null,
      createdAt: new Date(),
      lastUsedAt: null
    };
    this.rows.push(row);
    return row;
  }
  async removeByEndpoint(userId: string, endpoint: string): Promise<boolean> {
    const before = this.rows.length;
    this.rows = this.rows.filter((r) => !(r.userId === userId && r.endpoint === endpoint));
    return this.rows.length < before;
  }
  async listByUser(userId: string): Promise<PushSubscriptionRow[]> {
    return this.rows.filter((r) => r.userId === userId);
  }
  async markUsed(): Promise<void> {
    /* noop */
  }
}

class FakeInappStore implements InappReminderStore {
  rows: InappReminder[] = [];
  pendingTodayMap = new Map<string, boolean>();
  async enqueue(p: { userId: string; kind: ReminderKind; title: string; body: string; url?: string }): Promise<string> {
    const id = `r-${this.rows.length + 1}`;
    this.rows.push({
      id,
      userId: p.userId,
      kind: p.kind,
      title: p.title,
      body: p.body,
      url: p.url ?? null,
      createdAt: new Date(),
      dismissedAt: null
    });
    return id;
  }
  async listPending(userId: string): Promise<InappReminder[]> {
    return this.rows.filter((r) => r.userId === userId && r.dismissedAt === null);
  }
  async dismiss(userId: string, id: string): Promise<boolean> {
    const r = this.rows.find((x) => x.id === id && x.userId === userId && x.dismissedAt === null);
    if (!r) return false;
    r.dismissedAt = new Date();
    return true;
  }
  async hasPendingToday(userId: string, kind: ReminderKind): Promise<boolean> {
    return this.pendingTodayMap.get(`${userId}|${kind}`) ?? false;
  }
}

class ScriptedSender implements PushSender {
  // endpoint → result
  scripts = new Map<string, SendResult>();
  setResult(endpoint: string, r: SendResult): void {
    this.scripts.set(endpoint, r);
  }
  async send(endpoint: string): Promise<SendResult> {
    return this.scripts.get(endpoint) ?? { endpoint, ok: true };
  }
}

const PAYLOAD: PushPayload = { title: 'T', body: 'B', url: '/check-in/step1' };

describe('U9 sendToUser', () => {
  test('两个订阅,一个 gone 一个 ok → cleanup gone + delivered=1', async () => {
    const store = new FakePushStore();
    await store.upsert('u1', { endpoint: 'https://e1', p256dh: 'k1', auth: 'a1' });
    await store.upsert('u1', { endpoint: 'https://e2', p256dh: 'k2', auth: 'a2' });
    const sender = new ScriptedSender();
    sender.setResult('https://e1', { endpoint: 'https://e1', ok: false, gone: true });
    sender.setResult('https://e2', { endpoint: 'https://e2', ok: true });

    const r = await sendToUser('u1', PAYLOAD, { store, sender });
    expect(r.delivered).toBe(1);
    expect(store.rows).toHaveLength(1);
    expect(store.rows[0].endpoint).toBe('https://e2');
    expect(r.fallbackQueued).toBe(false);
  });

  test('全部失败 → inapp 兜底 enqueue', async () => {
    const store = new FakePushStore();
    await store.upsert('u1', { endpoint: 'https://e1', p256dh: 'k', auth: 'a' });
    const sender = new ScriptedSender();
    sender.setResult('https://e1', { endpoint: 'https://e1', ok: false, error: '500' });
    const inappStore = new FakeInappStore();
    const r = await sendToUser('u1', PAYLOAD, { store, sender, inappStore });
    expect(r.delivered).toBe(0);
    expect(r.fallbackQueued).toBe(true);
    expect(inappStore.rows).toHaveLength(1);
    expect(inappStore.rows[0].title).toBe('T');
  });

  test('无订阅 → 直接 inapp 兜底', async () => {
    const store = new FakePushStore();
    const sender = new ScriptedSender();
    const inappStore = new FakeInappStore();
    const r = await sendToUser('u1', PAYLOAD, { store, sender, inappStore });
    expect(r.delivered).toBe(0);
    expect(r.results).toHaveLength(0);
    expect(r.fallbackQueued).toBe(true);
    expect(inappStore.rows).toHaveLength(1);
  });

  test('当日已有 pending → 跳过 inapp(防重复打扰)', async () => {
    const store = new FakePushStore();
    const sender = new ScriptedSender();
    const inappStore = new FakeInappStore();
    inappStore.pendingTodayMap.set('u1|morning_checkin', true);
    const r = await sendToUser('u1', PAYLOAD, { store, sender, inappStore, inappKind: 'morning_checkin' });
    expect(r.fallbackQueued).toBe(true); // 标记为已尝试 fallback
    expect(inappStore.rows).toHaveLength(0); // 但实际未入库
  });

  test('无 inappStore 时不写兜底', async () => {
    const store = new FakePushStore();
    const sender = new ScriptedSender();
    const r = await sendToUser('u1', PAYLOAD, { store, sender });
    expect(r.fallbackQueued).toBe(false);
  });

  test('并发 cap 生效:5 订阅 cap=2 仍全发完', async () => {
    const store = new FakePushStore();
    for (let i = 0; i < 5; i++) {
      await store.upsert('u1', { endpoint: `https://e${i}`, p256dh: 'k', auth: 'a' });
    }
    const sender = new ScriptedSender();
    const r = await sendToUser('u1', PAYLOAD, { store, sender, concurrency: 2 });
    expect(r.delivered).toBe(5);
  });
});

describe('U9 push routes — inapp pending + dismiss', () => {
  let app: FastifyInstance;
  let pushStore: FakePushStore;
  let inappStore: FakeInappStore;

  beforeEach(async () => {
    pushStore = new FakePushStore();
    inappStore = new FakeInappStore();
    app = await buildApp({
      v1: {
        push: {
          deps: { store: pushStore, inappStore, vapidPublicKey: 'P' }
        }
      }
    });
  });
  afterEach(async () => {
    await app.close();
  });

  test('GET /push/inapp/pending 鉴权 401', async () => {
    const r = await app.inject({ method: 'GET', url: '/api/v1/push/inapp/pending' });
    expect(r.statusCode).toBe(401);
  });

  test('GET /push/inapp/pending 列出未 dismiss 的', async () => {
    await inappStore.enqueue({
      userId: 'u1',
      kind: 'morning_checkin',
      title: 'T1',
      body: 'B1',
      url: '/check-in/step1'
    });
    await inappStore.enqueue({ userId: 'u1', kind: 'pdf_ready', title: 'T2', body: 'B2' });
    await inappStore.enqueue({ userId: 'u2', kind: 'morning_checkin', title: 'X', body: 'X' });
    const r = await app.inject({
      method: 'GET',
      url: '/api/v1/push/inapp/pending',
      headers: { 'x-user-id': 'u1' }
    });
    expect(r.statusCode).toBe(200);
    const body = r.json();
    expect(body.reminders).toHaveLength(2);
    expect(body.reminders.map((x: { title: string }) => x.title).sort()).toEqual(['T1', 'T2']);
  });

  test('POST /push/inapp/:id/dismiss 标 dismissed', async () => {
    const id = await inappStore.enqueue({
      userId: 'u1',
      kind: 'morning_checkin',
      title: 'T',
      body: 'B'
    });
    const r = await app.inject({
      method: 'POST',
      url: `/api/v1/push/inapp/${id}/dismiss`,
      headers: { 'x-user-id': 'u1' }
    });
    expect(r.statusCode).toBe(200);
    expect(r.json()).toEqual({ ok: true, dismissed: true });
    expect(inappStore.rows[0].dismissedAt).not.toBeNull();
  });

  test('POST /push/inapp/:id/dismiss 跨用户 → dismissed:false', async () => {
    const id = await inappStore.enqueue({
      userId: 'u1',
      kind: 'morning_checkin',
      title: 'T',
      body: 'B'
    });
    const r = await app.inject({
      method: 'POST',
      url: `/api/v1/push/inapp/${id}/dismiss`,
      headers: { 'x-user-id': 'attacker' }
    });
    expect(r.json()).toEqual({ ok: true, dismissed: false });
    expect(inappStore.rows[0].dismissedAt).toBeNull();
  });
});
