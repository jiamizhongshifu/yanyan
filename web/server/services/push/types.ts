/**
 * Web Push 类型 (plan U11)
 *
 * 用户在 PWA 中点击"开启次晨打卡推送"后,前端调用 PushManager.subscribe
 * 拿到 endpoint + p256dh + auth keys,POST 到 /push/subscribe 入库。
 *
 * 同一用户可能在多设备订阅,每个 endpoint 一行;UNIQUE(endpoint) 防重复。
 */

export interface PushSubscriptionInput {
  endpoint: string;
  p256dh: string;
  auth: string;
  userAgent?: string;
}

export interface PushSubscriptionRow {
  id: string;
  userId: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  userAgent: string | null;
  createdAt: Date;
  lastUsedAt: Date | null;
}

export interface PushPayload {
  title: string;
  body: string;
  url?: string;
  tag?: string;
}
