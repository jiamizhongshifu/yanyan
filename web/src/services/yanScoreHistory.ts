/**
 * 炎症指数历史 — 客户端
 *
 * 默认拉过去 30 天;洞悉页趋势线读取 entries[].total/level。
 */
import { request } from './api';
import { getCurrentAccessToken } from './auth';
import type { FireLevel } from './symptoms';

export interface YanScoreHistoryEntry {
  date: string;
  total: number | null;
  level: FireLevel | null;
  partScores: { food: number | null; symptom: number | null; env: number | null; activity: number | null };
  cached: boolean;
}

export interface YanScoreHistory {
  since: string;
  until: string;
  entries: YanScoreHistoryEntry[];
}

async function withAuth() {
  const t = await getCurrentAccessToken();
  return t ? { authToken: t } : null;
}

export async function fetchYanScoreHistory(since?: string, until?: string): Promise<YanScoreHistory | null> {
  const auth = await withAuth();
  if (!auth) return null;
  const qs: string[] = [];
  if (since) qs.push(`since=${since}`);
  if (until) qs.push(`until=${until}`);
  const url = `/users/me/yan-score/history${qs.length ? `?${qs.join('&')}` : ''}`;
  const res = await request<{ ok: true } & YanScoreHistory>({ url, ...auth });
  if (!res.ok) return null;
  return { since: res.data.since, until: res.data.until, entries: res.data.entries };
}
