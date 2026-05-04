/**
 * PushSubscriptionStore — 数据访问接口
 *
 * 生产用 PgPushSubscriptionStore;测试用 fake (Map).
 */

import { withClient } from '../../db/client';
import type { PushSubscriptionInput, PushSubscriptionRow } from './types';

export interface PushSubscriptionStore {
  /** upsert by endpoint(同一浏览器重新订阅会覆盖 keys) */
  upsert(userId: string, sub: PushSubscriptionInput): Promise<PushSubscriptionRow>;
  removeByEndpoint(userId: string, endpoint: string): Promise<boolean>;
  listByUser(userId: string): Promise<PushSubscriptionRow[]>;
  markUsed(endpoint: string): Promise<void>;
}

interface DbRow {
  id: string;
  user_id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  user_agent: string | null;
  created_at: Date;
  last_used_at: Date | null;
}

function toRow(r: DbRow): PushSubscriptionRow {
  return {
    id: r.id,
    userId: r.user_id,
    endpoint: r.endpoint,
    p256dh: r.p256dh,
    auth: r.auth,
    userAgent: r.user_agent,
    createdAt: r.created_at,
    lastUsedAt: r.last_used_at
  };
}

export class PgPushSubscriptionStore implements PushSubscriptionStore {
  async upsert(userId: string, sub: PushSubscriptionInput): Promise<PushSubscriptionRow> {
    return withClient(async (c) => {
      const result = await c.query<DbRow>(
        `INSERT INTO push_subscriptions (user_id, endpoint, p256dh, auth, user_agent)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (endpoint) DO UPDATE
           SET user_id = EXCLUDED.user_id,
               p256dh = EXCLUDED.p256dh,
               auth = EXCLUDED.auth,
               user_agent = EXCLUDED.user_agent,
               last_used_at = now()
         RETURNING *`,
        [userId, sub.endpoint, sub.p256dh, sub.auth, sub.userAgent ?? null]
      );
      return toRow(result.rows[0]);
    });
  }

  async removeByEndpoint(userId: string, endpoint: string): Promise<boolean> {
    return withClient(async (c) => {
      const result = await c.query(
        `DELETE FROM push_subscriptions WHERE user_id = $1 AND endpoint = $2`,
        [userId, endpoint]
      );
      return (result.rowCount ?? 0) > 0;
    });
  }

  async listByUser(userId: string): Promise<PushSubscriptionRow[]> {
    return withClient(async (c) => {
      const result = await c.query<DbRow>(
        `SELECT * FROM push_subscriptions WHERE user_id = $1 ORDER BY created_at DESC`,
        [userId]
      );
      return result.rows.map(toRow);
    });
  }

  async markUsed(endpoint: string): Promise<void> {
    await withClient((c) =>
      c.query(`UPDATE push_subscriptions SET last_used_at = now() WHERE endpoint = $1`, [endpoint])
    );
  }
}
