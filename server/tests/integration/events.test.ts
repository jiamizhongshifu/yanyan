/**
 * U12 埋点 + 仪表盘聚合测试
 *
 * - POST /events:白名单事件入库;非法事件名拒绝
 * - GET /events/dashboard:WAU/DAU/次晨打卡率/减肥目标率/WAR 计算
 * - 减肥占比 > 30% → alerts.weightLossExceedsThreshold=true
 * - 鉴权:无 X-User-Id → 401
 */

import type { FastifyInstance } from 'fastify';
import { buildApp } from '../../src/app';
import {
  buildDashboardSummary,
  EVENT_NAMES,
  shouldAlertWeightLoss,
  type AnalyticsStore,
  type EventInput,
  type EventName
} from '../../src/services/analytics';

interface FakeRow {
  userId: string | null;
  eventName: EventName;
  payload: Record<string, unknown>;
  occurredAt: Date;
}

class FakeAnalyticsStore implements AnalyticsStore {
  rows: FakeRow[] = [];
  now: () => Date = () => new Date();
  async insertBatch(userId: string | null, events: EventInput[]): Promise<number> {
    for (const e of events) {
      this.rows.push({
        userId,
        eventName: e.eventName,
        payload: { ...(e.payload ?? {}), clientOccurredAt: e.clientOccurredAt },
        occurredAt: this.now()
      });
    }
    return events.length;
  }
  private since(days: number): Date {
    const d = new Date(this.now().getTime());
    d.setUTCDate(d.getUTCDate() - days);
    return d;
  }
  async countActiveUsers(sinceDaysAgo: number): Promise<number> {
    const cutoff = this.since(sinceDaysAgo);
    const set = new Set<string>();
    for (const r of this.rows) {
      if (r.userId && r.occurredAt >= cutoff) set.add(r.userId);
    }
    return set.size;
  }
  async countDauForDate(dateUtc: string): Promise<number> {
    const set = new Set<string>();
    for (const r of this.rows) {
      if (r.userId && r.occurredAt.toISOString().slice(0, 10) === dateUtc) set.add(r.userId);
    }
    return set.size;
  }
  async countDistinctUsersForEvent(eventName: EventName, sinceDaysAgo: number): Promise<number> {
    const cutoff = this.since(sinceDaysAgo);
    const set = new Set<string>();
    for (const r of this.rows) {
      if (r.userId && r.eventName === eventName && r.occurredAt >= cutoff) set.add(r.userId);
    }
    return set.size;
  }
  async countEventsWithPayload(
    eventName: EventName,
    payloadKey: string,
    payloadValue: string,
    sinceDaysAgo: number
  ): Promise<number> {
    const cutoff = this.since(sinceDaysAgo);
    let n = 0;
    for (const r of this.rows) {
      if (r.eventName === eventName && r.occurredAt >= cutoff && r.payload[payloadKey] === payloadValue) n += 1;
    }
    return n;
  }
  async countAll(): Promise<number> {
    return this.rows.length;
  }
}

const FIXED = new Date('2026-05-04T03:00:00Z');
const USER = 'u1';

describe('U12 events', () => {
  let app: FastifyInstance;
  let store: FakeAnalyticsStore;

  beforeEach(async () => {
    store = new FakeAnalyticsStore();
    store.now = () => FIXED;
    app = await buildApp({ v1: { events: { deps: { store, now: () => FIXED } } } });
  });
  afterEach(async () => {
    await app.close();
  });

  test('POST /events 入库白名单事件', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/events',
      headers: { 'x-user-id': USER, 'content-type': 'application/json' },
      payload: {
        events: [
          { eventName: 'photo_uploaded' },
          { eventName: 'checkin_step1_complete', payload: { dimension: '鼻塞' } }
        ]
      }
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ ok: true, accepted: 2, rejected: 0 });
    expect(store.rows).toHaveLength(2);
  });

  test('POST /events 非法事件名 → zod 400', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/events',
      headers: { 'x-user-id': USER, 'content-type': 'application/json' },
      payload: { events: [{ eventName: 'evil_event' }] }
    });
    expect(res.statusCode).toBe(400);
  });

  test('POST /events 空数组 → 400', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/events',
      headers: { 'x-user-id': USER, 'content-type': 'application/json' },
      payload: { events: [] }
    });
    expect(res.statusCode).toBe(400);
  });

  test('GET /events/dashboard:无数据时全 0', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/events/dashboard',
      headers: { 'x-user-id': USER }
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().summary).toEqual({
      wau: 0,
      dau: 0,
      morningCheckinRate: 0,
      weightLossTargetRate: 0,
      warRate: 0,
      totalEvents: 0
    });
  });

  test('GET /events/dashboard:次晨打卡率 = 拍照用户中完成打卡的比例', async () => {
    // 3 个拍照用户,其中 2 个完成次晨打卡
    for (const u of ['a', 'b', 'c']) {
      store.rows.push({ userId: u, eventName: 'photo_uploaded', payload: {}, occurredAt: FIXED });
    }
    for (const u of ['a', 'b']) {
      store.rows.push({ userId: u, eventName: 'checkin_step1_complete', payload: {}, occurredAt: FIXED });
    }
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/events/dashboard',
      headers: { 'x-user-id': USER }
    });
    expect(res.json().summary.morningCheckinRate).toBeCloseTo(2 / 3, 2);
  });

  test('减肥占比 > 30% → alerts.weightLossExceedsThreshold=true', async () => {
    // 10 个 onboarding 完成,其中 4 个 primaryGoal=weight_loss → 0.4 > 0.3
    for (let i = 0; i < 10; i++) {
      store.rows.push({
        userId: `u${i}`,
        eventName: 'onboarding_step_complete',
        payload: i < 4 ? { primaryGoal: 'weight_loss' } : { primaryGoal: 'inflammation' },
        occurredAt: FIXED
      });
    }
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/events/dashboard',
      headers: { 'x-user-id': USER }
    });
    expect(res.json().summary.weightLossTargetRate).toBeCloseTo(0.4, 2);
    expect(res.json().alerts.weightLossExceedsThreshold).toBe(true);
  });

  test('鉴权:无 X-User-Id → 401', async () => {
    expect((await app.inject({ method: 'POST', url: '/api/v1/events', payload: { events: [] } })).statusCode).toBe(401);
    expect((await app.inject({ method: 'GET', url: '/api/v1/events/dashboard' })).statusCode).toBe(401);
  });
});

describe('U12 dashboard pure functions', () => {
  test('shouldAlertWeightLoss 阈值 0.3', () => {
    expect(shouldAlertWeightLoss({ wau: 0, dau: 0, morningCheckinRate: 0, weightLossTargetRate: 0.31, warRate: 0, totalEvents: 0 })).toBe(true);
    expect(shouldAlertWeightLoss({ wau: 0, dau: 0, morningCheckinRate: 0, weightLossTargetRate: 0.3, warRate: 0, totalEvents: 0 })).toBe(false);
  });

  test('buildDashboardSummary 用 fake store 直接算', async () => {
    const store = new FakeAnalyticsStore();
    store.now = () => FIXED;
    store.rows.push({ userId: 'a', eventName: 'photo_uploaded', payload: {}, occurredAt: FIXED });
    const s = await buildDashboardSummary(store, FIXED);
    expect(s.wau).toBe(1);
    expect(s.dau).toBe(1);
  });

  test('EVENT_NAMES 包含 plan U12 列出的关键事件', () => {
    expect(EVENT_NAMES).toEqual(
      expect.arrayContaining([
        'onboarding_step_complete',
        'photo_uploaded',
        'checkin_step1_complete',
        'checkin_step2_view',
        'score_revealed',
        'tab_findings_visit'
      ])
    );
  });
});
