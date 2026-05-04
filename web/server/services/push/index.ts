/**
 * Push service (Phase 1 U11 + Phase 2 U9 升级)
 *
 * Phase 2 U9:替换 StubPushSender 为真实 WebPushSender(./web-push-sender.ts);
 * 推送失败 / 用户未订阅 / iOS 不支持 → 写 inapp_reminders 兜底队列。
 */

export type { PushPayload, PushSubscriptionInput, PushSubscriptionRow } from './types';
export { PgPushSubscriptionStore } from './store';
export type { PushSubscriptionStore } from './store';
export { WebPushSender, type WebPushVapidConfig } from './web-push-sender';
export {
  PgInappReminderStore,
  type InappReminder,
  type InappReminderStore,
  type ReminderKind
} from './inapp-fallback';

import type { PushPayload } from './types';
import type { PushSubscriptionStore } from './store';
import type { InappReminderStore, ReminderKind } from './inapp-fallback';

export interface SendResult {
  endpoint: string;
  ok: boolean;
  /** 410 Gone / 404 — 订阅已失效,前端清理 */
  gone?: boolean;
  error?: string;
}

export interface PushSender {
  send(endpoint: string, p256dh: string, auth: string, payload: PushPayload): Promise<SendResult>;
}

/** 占位发送器:真正发送在 U12 cron 接入 web-push library */
export class StubPushSender implements PushSender {
  async send(endpoint: string): Promise<SendResult> {
    return { endpoint, ok: true };
  }
}

export interface SendToUserDeps {
  store: PushSubscriptionStore;
  sender: PushSender;
  /** 可选:推送失败 / 无订阅时写 in-app 兜底队列 */
  inappStore?: InappReminderStore;
  /** 可选:in-app 兜底时归类(默认 'morning_checkin') */
  inappKind?: ReminderKind;
  /** 并发 cap(防 Vercel cron 60s 限制下排长队) */
  concurrency?: number;
}

export interface SendToUserResult {
  results: SendResult[];
  /** 真正送达 push(ok && !gone)的订阅数 */
  delivered: number;
  /** 已写 inapp_reminders fallback */
  fallbackQueued: boolean;
}

/**
 * 向单个用户的所有订阅推送 + 失败兜底到 inapp_reminders。
 * 如果用户没有任何活跃订阅 → 直接写 inapp_reminders。
 * 至少一条订阅成功送达 → 不写 inapp(避免重复打扰)。
 */
export async function sendToUser(
  userId: string,
  payload: PushPayload,
  depsOrStore: SendToUserDeps | PushSubscriptionStore,
  legacySender?: PushSender
): Promise<SendToUserResult> {
  // 兼容旧调用签名(Phase 1 测试用 store + sender 两参)
  const deps: SendToUserDeps =
    'store' in depsOrStore
      ? depsOrStore
      : { store: depsOrStore, sender: legacySender! };

  const subs = await deps.store.listByUser(userId);

  // 没订阅 → 直接 inapp 兜底
  if (subs.length === 0) {
    await maybeQueueInapp(userId, payload, deps);
    return { results: [], delivered: 0, fallbackQueued: !!deps.inappStore };
  }

  const concurrency = Math.max(1, deps.concurrency ?? 20);
  const results: SendResult[] = [];

  // 简单的并发分批(不引 p-limit,Beta 量级足够)
  for (let i = 0; i < subs.length; i += concurrency) {
    const batch = subs.slice(i, i + concurrency);
    const batchResults = await Promise.all(
      batch.map((s) => deps.sender.send(s.endpoint, s.p256dh, s.auth, payload))
    );
    for (let j = 0; j < batch.length; j++) {
      const s = batch[j];
      const r = batchResults[j];
      results.push(r);
      if (r.gone) {
        await deps.store.removeByEndpoint(userId, s.endpoint);
      } else if (r.ok) {
        await deps.store.markUsed(s.endpoint);
      }
    }
  }

  const delivered = results.filter((r) => r.ok).length;
  let fallbackQueued = false;

  // 全部失败(都 gone 或 5xx)→ inapp 兜底
  if (delivered === 0 && deps.inappStore) {
    await maybeQueueInapp(userId, payload, deps);
    fallbackQueued = true;
  }
  return { results, delivered, fallbackQueued };
}

async function maybeQueueInapp(
  userId: string,
  payload: PushPayload,
  deps: SendToUserDeps
): Promise<void> {
  if (!deps.inappStore) return;
  const kind: ReminderKind = deps.inappKind ?? 'morning_checkin';
  // 同 kind 当日已有 pending → 跳过(避免重复打扰)
  if (await deps.inappStore.hasPendingToday(userId, kind)) return;
  await deps.inappStore.enqueue({
    userId,
    kind,
    title: payload.title,
    body: payload.body,
    url: payload.url
  });
}
