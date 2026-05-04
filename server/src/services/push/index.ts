/**
 * Push service (plan U11)
 *
 * 真实 web-push 发送在生产中通过 npm:web-push + VAPID 私钥;
 * v1 此处仅暴露接口 + 占位实现,U12 cron 调度次晨打卡提醒时接入。
 *
 * iOS Safari 16.4+ 才支持 Web Push,且需要"添加到主屏";不支持的浏览器
 * 前端会捕获 PushManager unsupported,提示用户切换到服务号备份(Phase 2)。
 */

export type { PushPayload, PushSubscriptionInput, PushSubscriptionRow } from './types';
export { PgPushSubscriptionStore } from './store';
export type { PushSubscriptionStore } from './store';

import type { PushPayload } from './types';
import type { PushSubscriptionStore } from './store';

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

export async function sendToUser(
  userId: string,
  payload: PushPayload,
  store: PushSubscriptionStore,
  sender: PushSender
): Promise<SendResult[]> {
  const subs = await store.listByUser(userId);
  const results: SendResult[] = [];
  for (const s of subs) {
    const r = await sender.send(s.endpoint, s.p256dh, s.auth, payload);
    results.push(r);
    if (r.gone) {
      await store.removeByEndpoint(userId, s.endpoint);
    } else if (r.ok) {
      await store.markUsed(s.endpoint);
    }
  }
  return results;
}
