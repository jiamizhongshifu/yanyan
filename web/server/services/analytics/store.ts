/**
 * AnalyticsStore — 埋点事件读写
 */

import { withClient } from '../../db/client';
import type { EventInput, EventName } from './types';

export interface InsertedEvent {
  userId: string | null;
  eventName: EventName;
  payload: Record<string, unknown>;
  occurredAt: Date;
}

export interface AnalyticsStore {
  /** 批量插入事件;userId 可为 null(匿名访问) */
  insertBatch(userId: string | null, events: EventInput[]): Promise<number>;
  /** 过去 N 天 distinct user_id 数 */
  countActiveUsers(sinceDaysAgo: number): Promise<number>;
  /** 当日 distinct user_id */
  countDauForDate(dateUtc: string): Promise<number>;
  /** 过去 N 天某事件 distinct user_id */
  countDistinctUsersForEvent(eventName: EventName, sinceDaysAgo: number): Promise<number>;
  /** 过去 N 天某事件中 payload[key] = value 的事件数 */
  countEventsWithPayload(
    eventName: EventName,
    payloadKey: string,
    payloadValue: string,
    sinceDaysAgo: number
  ): Promise<number>;
  /** 总事件数 */
  countAll(): Promise<number>;
}

export class PgAnalyticsStore implements AnalyticsStore {
  async insertBatch(userId: string | null, events: EventInput[]): Promise<number> {
    if (events.length === 0) return 0;
    return withClient(async (c) => {
      let inserted = 0;
      for (const e of events) {
        await c.query(
          `INSERT INTO analytics_events (user_id, event_name, payload) VALUES ($1, $2, $3)`,
          [userId, e.eventName, JSON.stringify({ ...(e.payload ?? {}), clientOccurredAt: e.clientOccurredAt })]
        );
        inserted += 1;
      }
      return inserted;
    });
  }

  async countActiveUsers(sinceDaysAgo: number): Promise<number> {
    return withClient(async (c) => {
      const r = await c.query<{ count: string }>(
        `SELECT COUNT(DISTINCT user_id)::text AS count
           FROM analytics_events
          WHERE user_id IS NOT NULL
            AND occurred_at >= now() - ($1::int || ' days')::interval`,
        [sinceDaysAgo]
      );
      return Number(r.rows[0]?.count ?? 0);
    });
  }

  async countDauForDate(dateUtc: string): Promise<number> {
    return withClient(async (c) => {
      const r = await c.query<{ count: string }>(
        `SELECT COUNT(DISTINCT user_id)::text AS count
           FROM analytics_events
          WHERE user_id IS NOT NULL
            AND occurred_at::date = $1::date`,
        [dateUtc]
      );
      return Number(r.rows[0]?.count ?? 0);
    });
  }

  async countDistinctUsersForEvent(eventName: EventName, sinceDaysAgo: number): Promise<number> {
    return withClient(async (c) => {
      const r = await c.query<{ count: string }>(
        `SELECT COUNT(DISTINCT user_id)::text AS count
           FROM analytics_events
          WHERE event_name = $1
            AND user_id IS NOT NULL
            AND occurred_at >= now() - ($2::int || ' days')::interval`,
        [eventName, sinceDaysAgo]
      );
      return Number(r.rows[0]?.count ?? 0);
    });
  }

  async countEventsWithPayload(
    eventName: EventName,
    payloadKey: string,
    payloadValue: string,
    sinceDaysAgo: number
  ): Promise<number> {
    return withClient(async (c) => {
      const r = await c.query<{ count: string }>(
        `SELECT COUNT(*)::text AS count
           FROM analytics_events
          WHERE event_name = $1
            AND payload ->> $2 = $3
            AND occurred_at >= now() - ($4::int || ' days')::interval`,
        [eventName, payloadKey, payloadValue, sinceDaysAgo]
      );
      return Number(r.rows[0]?.count ?? 0);
    });
  }

  async countAll(): Promise<number> {
    return withClient(async (c) => {
      const r = await c.query<{ count: string }>(`SELECT COUNT(*)::text AS count FROM analytics_events`);
      return Number(r.rows[0]?.count ?? 0);
    });
  }
}
