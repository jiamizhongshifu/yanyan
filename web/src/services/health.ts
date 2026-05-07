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
  waterCups: number | null;
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
    waterCups: res.data.waterCups,
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

/**
 * 上报今日喝水杯数(整数 0-20)。每次本地 zustand 加/减都调一次,跨设备同步。
 * 失败不打扰用户:本地 zustand 已即时更新,server 同步是最佳努力。
 */
export async function postHealthWater(payload: { date: string; cups: number }): Promise<boolean> {
  const auth = await withAuth();
  if (!auth) return false;
  const res = await request<{ ok: true }>({
    url: '/users/me/health/water',
    method: 'POST',
    ...auth,
    data: payload
  });
  return res.ok;
}
