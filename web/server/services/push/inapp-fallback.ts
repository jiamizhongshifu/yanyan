/**
 * In-app 通知兜底队列(Phase 2 U9)
 *
 * 触发场景:
 *   - 用户未授权 Web Push(iOS Safari < 16.4 / 浏览器 deny)
 *   - WebPushSender 真实推送失败(5xx / network error / send_timeout)
 *   - 浏览器后台被 OS 限流
 *
 * 设计:
 *   - PG 表 inapp_reminders(独立 store,小到不必跟 push_subscriptions 混)
 *   - 用户每次进入主屏调 GET /push/inapp-pending 拿待显示 banner
 *   - 用户操作后(打卡 / 关闭 banner)→ POST /push/inapp/:id/dismiss 标 dismissed
 */

import { withClient } from '../../db/client';

export type ReminderKind = 'morning_checkin' | 'pdf_ready' | 'weekly_digest';

export interface InappReminder {
  id: string;
  userId: string;
  kind: ReminderKind;
  title: string;
  body: string;
  url: string | null;
  createdAt: Date;
  dismissedAt: Date | null;
}

export interface InappReminderStore {
  enqueue(p: { userId: string; kind: ReminderKind; title: string; body: string; url?: string }): Promise<string>;
  /** 列出未 dismiss 的提醒(最新在前) */
  listPending(userId: string): Promise<InappReminder[]>;
  dismiss(userId: string, id: string): Promise<boolean>;
  /** 防同一用户同一 kind 当日重复入队;返回是否已存在 */
  hasPendingToday(userId: string, kind: ReminderKind): Promise<boolean>;
}

interface DbRow {
  id: string;
  user_id: string;
  kind: ReminderKind;
  title: string;
  body: string;
  url: string | null;
  created_at: Date;
  dismissed_at: Date | null;
}

function toRow(r: DbRow): InappReminder {
  return {
    id: r.id,
    userId: r.user_id,
    kind: r.kind,
    title: r.title,
    body: r.body,
    url: r.url,
    createdAt: r.created_at,
    dismissedAt: r.dismissed_at
  };
}

export class PgInappReminderStore implements InappReminderStore {
  async enqueue(p: { userId: string; kind: ReminderKind; title: string; body: string; url?: string }): Promise<string> {
    return withClient(async (c) => {
      const r = await c.query<{ id: string }>(
        `INSERT INTO inapp_reminders (user_id, kind, title, body, url)
         VALUES ($1, $2, $3, $4, $5) RETURNING id`,
        [p.userId, p.kind, p.title, p.body, p.url ?? null]
      );
      return r.rows[0].id;
    });
  }

  async listPending(userId: string): Promise<InappReminder[]> {
    return withClient(async (c) => {
      const r = await c.query<DbRow>(
        `SELECT * FROM inapp_reminders
          WHERE user_id = $1 AND dismissed_at IS NULL
          ORDER BY created_at DESC`,
        [userId]
      );
      return r.rows.map(toRow);
    });
  }

  async dismiss(userId: string, id: string): Promise<boolean> {
    return withClient(async (c) => {
      const r = await c.query(
        `UPDATE inapp_reminders SET dismissed_at = now()
          WHERE id = $1 AND user_id = $2 AND dismissed_at IS NULL`,
        [id, userId]
      );
      return (r.rowCount ?? 0) > 0;
    });
  }

  async hasPendingToday(userId: string, kind: ReminderKind): Promise<boolean> {
    return withClient(async (c) => {
      const r = await c.query<{ count: string }>(
        `SELECT COUNT(*)::text AS count FROM inapp_reminders
          WHERE user_id = $1 AND kind = $2 AND dismissed_at IS NULL
            AND created_at::date = CURRENT_DATE`,
        [userId, kind]
      );
      return Number(r.rows[0]?.count ?? 0) > 0;
    });
  }
}
