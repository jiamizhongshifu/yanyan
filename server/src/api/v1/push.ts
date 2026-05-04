/**
 * /api/v1/push 路由 (plan U11)
 *
 * GET  /push/vapid-public-key    — 前端 PushManager.subscribe 需要的 applicationServerKey
 * POST /push/subscribe           — 浏览器拿到 endpoint+keys 后回传入库
 * POST /push/unsubscribe         — 用户在 Me 页关闭推送时调用
 *
 * VAPID 公钥可公开;私钥仅服务端持有,不暴露。
 */

import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { requireUser } from '../../auth';
import {
  PgPushSubscriptionStore,
  PgInappReminderStore,
  type PushSubscriptionStore,
  type InappReminderStore
} from '../../services/push';

const SubscribeBody = z.object({
  endpoint: z.string().url(),
  p256dh: z.string().min(1),
  auth: z.string().min(1),
  userAgent: z.string().max(512).optional()
});

const UnsubscribeBody = z.object({
  endpoint: z.string().url()
});

export interface RegisterPushOptions {
  deps?: {
    store?: PushSubscriptionStore;
    inappStore?: InappReminderStore;
    vapidPublicKey?: string;
  };
}

const DismissParams = z.object({ id: z.string().min(1) });

export async function registerPushRoutes(app: FastifyInstance, opts: RegisterPushOptions = {}): Promise<void> {
  const store = opts.deps?.store ?? new PgPushSubscriptionStore();
  const inappStore = opts.deps?.inappStore ?? new PgInappReminderStore();
  const vapidPublicKey = opts.deps?.vapidPublicKey ?? process.env.VAPID_PUBLIC_KEY ?? '';

  app.get('/push/vapid-public-key', async () => {
    if (!vapidPublicKey) {
      return { ok: false, error: 'vapid_not_configured' };
    }
    return { ok: true, publicKey: vapidPublicKey };
  });

  app.post('/push/subscribe', async (req, reply) => {
    const user = requireUser(req, reply);
    if (!user) return;
    const parsed = SubscribeBody.safeParse(req.body);
    if (!parsed.success) {
      reply.code(400);
      return { ok: false, error: 'invalid_body', issues: parsed.error.issues };
    }
    const ua = parsed.data.userAgent ?? (req.headers['user-agent'] as string | undefined);
    const row = await store.upsert(user.userId, {
      endpoint: parsed.data.endpoint,
      p256dh: parsed.data.p256dh,
      auth: parsed.data.auth,
      userAgent: ua
    });
    return { ok: true, id: row.id };
  });

  app.post('/push/unsubscribe', async (req, reply) => {
    const user = requireUser(req, reply);
    if (!user) return;
    const parsed = UnsubscribeBody.safeParse(req.body);
    if (!parsed.success) {
      reply.code(400);
      return { ok: false, error: 'invalid_body', issues: parsed.error.issues };
    }
    const removed = await store.removeByEndpoint(user.userId, parsed.data.endpoint);
    return { ok: true, removed };
  });

  // U9 in-app 兜底
  app.get('/push/inapp/pending', async (req, reply) => {
    const user = requireUser(req, reply);
    if (!user) return;
    const reminders = await inappStore.listPending(user.userId);
    return {
      ok: true,
      reminders: reminders.map((r) => ({
        id: r.id,
        kind: r.kind,
        title: r.title,
        body: r.body,
        url: r.url,
        createdAt: r.createdAt
      }))
    };
  });

  app.post('/push/inapp/:id/dismiss', async (req, reply) => {
    const user = requireUser(req, reply);
    if (!user) return;
    const parsed = DismissParams.safeParse(req.params);
    if (!parsed.success) {
      reply.code(400);
      return { ok: false, error: 'invalid_params' };
    }
    const dismissed = await inappStore.dismiss(user.userId, parsed.data.id);
    return { ok: true, dismissed };
  });
}
