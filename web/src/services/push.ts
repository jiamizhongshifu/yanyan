/**
 * Web Push 客户端 (plan U11)
 *
 * 浏览器流程:
 *   1. 检查 PushManager + Notification 支持(iOS Safari 16.4+ + 添加到主屏才有)
 *   2. requestPermission → granted
 *   3. SW.pushManager.subscribe({ applicationServerKey: VAPID 公钥 })
 *   4. 拿到 endpoint+keys → POST /push/subscribe
 *
 * 取消:取出当前 subscription → unsubscribe() + POST /push/unsubscribe
 */

import { request } from './api';
import { getCurrentAccessToken } from './auth';

export interface PushSupport {
  supported: boolean;
  reason?: 'no_serviceworker' | 'no_pushmanager' | 'no_notification';
}

export function detectPushSupport(): PushSupport {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) {
    return { supported: false, reason: 'no_serviceworker' };
  }
  if (typeof window === 'undefined' || !('PushManager' in window)) {
    return { supported: false, reason: 'no_pushmanager' };
  }
  if (typeof Notification === 'undefined') {
    return { supported: false, reason: 'no_notification' };
  }
  return { supported: true };
}

async function withAuth(): Promise<{ authToken: string } | null> {
  const token = await getCurrentAccessToken();
  if (!token) return null;
  return { authToken: token };
}

async function fetchVapidPublicKey(): Promise<string | null> {
  const res = await request<{ ok: true; publicKey: string }>({ url: '/push/vapid-public-key' });
  if (!res.ok || !res.data?.publicKey) return null;
  return res.data.publicKey;
}

function urlBase64ToUint8Array(base64: string): ArrayBuffer {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(b64);
  const buf = new ArrayBuffer(raw.length);
  const out = new Uint8Array(buf);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return buf;
}

function arrayBufferToB64(buf: ArrayBuffer | null): string {
  if (!buf) return '';
  const bytes = new Uint8Array(buf);
  let s = '';
  for (let i = 0; i < bytes.byteLength; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s);
}

export async function getCurrentSubscription(): Promise<PushSubscription | null> {
  if (!detectPushSupport().supported) return null;
  const reg = await navigator.serviceWorker.ready;
  return reg.pushManager.getSubscription();
}

export async function subscribeToPush(): Promise<{ ok: boolean; reason?: string }> {
  const sup = detectPushSupport();
  if (!sup.supported) return { ok: false, reason: sup.reason };

  const auth = await withAuth();
  if (!auth) return { ok: false, reason: 'not_signed_in' };

  const perm = await Notification.requestPermission();
  if (perm !== 'granted') return { ok: false, reason: 'permission_denied' };

  const publicKey = await fetchVapidPublicKey();
  if (!publicKey) return { ok: false, reason: 'no_vapid_key' };

  const reg = await navigator.serviceWorker.ready;
  const sub = await reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(publicKey)
  });

  const json = sub.toJSON();
  const res = await request({
    url: '/push/subscribe',
    method: 'POST',
    ...auth,
    data: {
      endpoint: sub.endpoint,
      p256dh: json.keys?.p256dh ?? arrayBufferToB64(sub.getKey('p256dh')),
      auth: json.keys?.auth ?? arrayBufferToB64(sub.getKey('auth')),
      userAgent: navigator.userAgent
    }
  });
  if (!res.ok) {
    await sub.unsubscribe().catch(() => undefined);
    return { ok: false, reason: 'server_failed' };
  }
  return { ok: true };
}

export async function unsubscribeFromPush(): Promise<boolean> {
  const sub = await getCurrentSubscription();
  if (!sub) return true;
  const auth = await withAuth();
  if (auth) {
    await request({ url: '/push/unsubscribe', method: 'POST', ...auth, data: { endpoint: sub.endpoint } });
  }
  await sub.unsubscribe().catch(() => undefined);
  return true;
}
