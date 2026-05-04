/**
 * 真实 Web Push 发送器(Phase 2 U9)
 *
 * 替换 Phase 1 StubPushSender。
 *
 * 关键行为:
 *   - 用 npm:web-push + VAPID 密钥(已在 .env 占位,生产由 Vercel env 注入)
 *   - 410 Gone / 404 / 403 → mark gone(上层 sendToUser 触发 removeByEndpoint)
 *   - 5xx → 标记 ok=false,上层走 in-app 兜底
 *   - 单次发送有内置 timeout(web-push lib 默认 ~30s,这里再加外层 8s 保护防 cron 超时)
 */

import webpush from 'web-push';
import type { PushPayload } from './types';
import type { PushSender, SendResult } from './index';

export interface WebPushVapidConfig {
  publicKey: string;
  privateKey: string;
  /** mailto: 格式,飞书 / 邮箱均可 */
  subject: string;
}

const SEND_TIMEOUT_MS = 8_000;
const TTL_SECONDS = 60 * 60 * 4; // 4h:超时未送达就丢弃

export class WebPushSender implements PushSender {
  constructor(cfg: WebPushVapidConfig) {
    if (!cfg.publicKey || !cfg.privateKey) throw new Error('VAPID 公私钥不能为空');
    if (!cfg.subject || !cfg.subject.startsWith('mailto:')) {
      throw new Error('VAPID subject 必须是 mailto: 开头');
    }
    webpush.setVapidDetails(cfg.subject, cfg.publicKey, cfg.privateKey);
  }

  async send(endpoint: string, p256dh: string, auth: string, payload: PushPayload): Promise<SendResult> {
    const subscription = { endpoint, keys: { p256dh, auth } };
    const body = JSON.stringify({
      title: payload.title,
      body: payload.body,
      url: payload.url ?? '/',
      tag: payload.tag ?? 'yanyan-default'
    });

    try {
      // 包一层 timeout 防 cron 函数 60s 上限被单次慢请求吃光
      const sendPromise = webpush.sendNotification(subscription, body, { TTL: TTL_SECONDS });
      const r = await Promise.race([
        sendPromise,
        new Promise<never>((_, rej) => setTimeout(() => rej(new Error('send_timeout')), SEND_TIMEOUT_MS))
      ]);
      // r.statusCode 在 2xx 时正常,web-push 抛错时不会到这
      void r;
      return { endpoint, ok: true };
    } catch (err) {
      const status = (err as { statusCode?: number; status?: number }).statusCode ?? (err as { status?: number }).status;
      // 410 Gone / 404 Not Found / 403 Forbidden = 订阅死了
      if (status === 410 || status === 404 || status === 403) {
        return { endpoint, ok: false, gone: true, error: `subscription_dead_${status}` };
      }
      const errMsg = err instanceof Error ? err.message : String(err);
      return { endpoint, ok: false, error: errMsg };
    }
  }
}
