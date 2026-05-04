/**
 * In-app 兜底提醒客户端(Phase 2 U9)
 *
 * Web Push 不可达时,服务端写入 inapp_reminders 队列;
 * 用户进 /app 时拉取 + 显示 banner;dismiss / 跳走时调 dismiss API
 */

import { request } from './api';
import { getCurrentAccessToken } from './auth';

export type ReminderKind = 'morning_checkin' | 'pdf_ready' | 'weekly_digest';

export interface InappReminder {
  id: string;
  kind: ReminderKind;
  title: string;
  body: string;
  url: string | null;
  createdAt: string;
}

interface ListResponse {
  ok: true;
  reminders: InappReminder[];
}

export async function fetchPendingReminders(): Promise<InappReminder[]> {
  const t = await getCurrentAccessToken();
  if (!t) return [];
  const res = await request<ListResponse>({ url: '/push/inapp/pending', authToken: t });
  if (!res.ok) return [];
  return res.data.reminders;
}

export async function dismissReminder(id: string): Promise<boolean> {
  const t = await getCurrentAccessToken();
  if (!t) return false;
  const res = await request<{ ok: true; dismissed: boolean }>({
    url: `/push/inapp/${id}/dismiss`,
    method: 'POST',
    authToken: t
  });
  return res.ok && res.data.dismissed;
}
