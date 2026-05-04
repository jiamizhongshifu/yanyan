/**
 * 客户端埋点 (plan U12)
 *
 * 设计:
 *   - 任意调用 track(name, payload) 不阻塞 UI
 *   - 失败 / 离线时入 localStorage 队列;flush() 在网络恢复 / 应用启动 / 路由切换时批量上传
 *   - 鉴权失败(未登录)直接丢弃匿名事件 — server /events 需 user 鉴权
 */

import { request } from './api';
import { getCurrentAccessToken } from './auth';

export const EVENT_NAMES = [
  'onboarding_step_complete',
  'photo_uploaded',
  'meal_recognized',
  'checkin_step1_complete',
  'checkin_step2_view',
  'score_revealed',
  'tab_findings_visit',
  'tab_home_visit',
  'push_subscribed',
  'push_unsubscribed'
] as const;

export type EventName = (typeof EVENT_NAMES)[number];

interface QueuedEvent {
  eventName: EventName;
  payload?: Record<string, unknown>;
  clientOccurredAt: string;
}

const QUEUE_KEY = 'yanyan.tracker.queue.v1';
const MAX_QUEUE = 200;
const BATCH_SIZE = 50;

function readQueue(): QueuedEvent[] {
  if (typeof localStorage === 'undefined') return [];
  try {
    const raw = localStorage.getItem(QUEUE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeQueue(q: QueuedEvent[]): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(QUEUE_KEY, JSON.stringify(q.slice(-MAX_QUEUE)));
  } catch {
    /* 存储满 — 静默放弃 */
  }
}

let flushing = false;

export function track(eventName: EventName, payload?: Record<string, unknown>): void {
  const ev: QueuedEvent = { eventName, payload, clientOccurredAt: new Date().toISOString() };
  const q = readQueue();
  q.push(ev);
  writeQueue(q);
  // 异步 flush;失败保留队列等下次
  void flush();
}

export async function flush(): Promise<void> {
  if (flushing) return;
  const q = readQueue();
  if (q.length === 0) return;
  const token = await getCurrentAccessToken();
  if (!token) return; // 未登录不上报,事件留在队列等登录后再 flush

  flushing = true;
  try {
    while (true) {
      const current = readQueue();
      if (current.length === 0) break;
      const batch = current.slice(0, BATCH_SIZE);
      const res = await request({
        url: '/events',
        method: 'POST',
        authToken: token,
        data: { events: batch }
      });
      if (!res.ok) break; // 失败保留队列
      // 成功:从队列前部摘掉已上传部分(防 track() 在 flush 中追加而丢事件)
      const remaining = readQueue().slice(batch.length);
      writeQueue(remaining);
      if (remaining.length === 0) break;
    }
  } finally {
    flushing = false;
  }
}

/** 测试钩子 — 重置内部状态 */
export function _resetForTests(): void {
  flushing = false;
  if (typeof localStorage !== 'undefined') localStorage.removeItem(QUEUE_KEY);
}

/** 浏览器全局事件:网络恢复 + 页面可见时尝试 flush */
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => void flush());
  window.addEventListener('focus', () => void flush());
}
