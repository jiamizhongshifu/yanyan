/**
 * 健康数据 — 步数 / 静息心率(server-backed,跨设备)
 * 三种来源:Apple Health 快捷指令 / 手动录入 / .zip 解析(留接口)
 */
import { request } from './api';
import { getCurrentAccessToken } from './auth';

export interface HealthDaily {
  date: string;
  steps: number | null;
  restingHr: number | null;
  source: string | null;
  updatedAt: string | null;
}

async function withAuth() {
  const t = await getCurrentAccessToken();
  return t ? { authToken: t } : null;
}

export async function fetchHealthToday(date?: string): Promise<HealthDaily | null> {
  const auth = await withAuth();
  if (!auth) return null;
  const url = `/users/me/health/today${date ? `?date=${date}` : ''}`;
  const res = await request<{ ok: true } & HealthDaily>({ url, ...auth });
  if (!res.ok) return null;
  return {
    date: res.data.date,
    steps: res.data.steps,
    restingHr: res.data.restingHr,
    source: res.data.source,
    updatedAt: res.data.updatedAt
  };
}

export async function postHealthSteps(payload: {
  date: string;
  steps?: number;
  restingHr?: number;
  source?: 'shortcut' | 'manual' | 'import';
}): Promise<boolean> {
  const auth = await withAuth();
  if (!auth) return false;
  const res = await request<{ ok: true }>({
    url: '/users/me/health/steps',
    method: 'POST',
    ...auth,
    data: payload
  });
  return res.ok;
}
