/**
 * Symptoms / Yan-Score 客户端服务
 *
 * 注意:Step 1 提交前**严禁**调 fetchYesterdayCompare(plan R12 — Step 1 必须盲)
 * Step 2 才允许查昨日对照。
 */

import { request } from './api';
import { getCurrentAccessToken } from './auth';
import { cached, invalidate, peekCache } from './cache';

export const SYMPTOM_DIMENSIONS = [
  'nasal_congestion',
  'acne',
  'dry_mouth',
  'bowel',
  'fatigue',
  'edema',
  'throat_itch'
] as const;
export type SymptomDimension = (typeof SYMPTOM_DIMENSIONS)[number];

export const SYMPTOM_DIMENSION_LEVELS: Record<SymptomDimension, number> = {
  nasal_congestion: 4,
  acne: 4,
  dry_mouth: 4,
  bowel: 5,
  fatigue: 4,
  edema: 4,
  throat_itch: 4
};

/** 各维度档位文案(从 1 到 N,1 为最轻) */
export const SYMPTOM_LEVEL_LABELS: Record<SymptomDimension, string[]> = {
  nasal_congestion: ['轻度', '一鼻塞', '双鼻塞', '完全堵'],
  acne: ['零星', '几颗', '多颗', '大面积'],
  dry_mouth: ['微干', '想喝水', '嘴唇干裂', '舌苔厚'],
  bowel: ['正常', '偏稀', '偏硬', '黏腻', '腹泻'],
  fatigue: ['良好', '一般', '困倦', '极度疲惫'],
  edema: ['无', '眼袋', '面部', '全身'],
  throat_itch: ['无', '偶尔', '持续', '痛']
};

export const SYMPTOM_DIMENSION_LABELS: Record<SymptomDimension, string> = {
  nasal_congestion: '鼻塞',
  acne: '起痘',
  dry_mouth: '口干',
  bowel: '大便异常',
  fatigue: '精神差 / 困倦',
  edema: '浮肿',
  throat_itch: '喉咙痒'
};

export interface SymptomDimensionEntry {
  engaged: boolean;
  severity: number | null;
}

export type SymptomCheckinPayload = Partial<Record<SymptomDimension, SymptomDimensionEntry>>;

async function authHeader(): Promise<{ authToken: string } | null> {
  const t = await getCurrentAccessToken();
  return t ? { authToken: t } : null;
}

export async function postCheckin(
  payload: SymptomCheckinPayload,
  recordedForDate?: string
): Promise<boolean> {
  const auth = await authHeader();
  if (!auth) return false;
  const res = await request({
    url: '/symptoms/checkin',
    method: 'POST',
    ...auth,
    data: { payload, ...(recordedForDate ? { recordedForDate } : {}) }
  });
  if (res.ok) {
    invalidate('yan-score:today');
    invalidate('progress:me');
  }
  return res.ok;
}

export interface YesterdayCompare {
  hasYesterday: boolean;
  recordedForDate?: string;
  payload?: SymptomCheckinPayload;
}

export async function fetchYesterdayCompare(today?: string): Promise<YesterdayCompare | null> {
  const auth = await authHeader();
  if (!auth) return null;
  const url = today ? `/symptoms/yesterday/compare?today=${today}` : '/symptoms/yesterday/compare';
  const res = await request<{ ok: true } & YesterdayCompare>({
    url,
    ...auth
  });
  if (!res.ok) return null;
  return res.data;
}

export type FireLevel = '平' | '微火' | '中火' | '大火';

export interface YanScoreResult {
  score: number;
  level: FireLevel;
  breakdown: { food: number; symptom: number; env: number; activity: number };
  effectiveWeights: { food: number; symptom: number; env: number; activity: number };
  missingParts: Array<'food' | 'symptom' | 'env' | 'activity'>;
  partScores: { food: number | null; symptom: number | null; env: number | null; activity: number | null };
}

/** Post-U8 标准化响应 */
export interface YanScoreToday {
  hasCheckin: boolean;
  result: YanScoreResult | null;
  partScores: { food: number | null; symptom: number | null; env: number | null; activity: number | null };
  unavailableReason?: 'insufficient_parts' | 'no_data';
}

export async function fetchYanScoreToday(): Promise<YanScoreToday | null> {
  return cached('yan-score:today', 30_000, async () => {
    const auth = await authHeader();
    if (!auth) return null;
    const res = await request<{ ok: true } & YanScoreToday>({
      url: '/yan-score/today',
      ...auth
    });
    if (!res.ok) return null;
    return res.data;
  });
}

/** 同步读今日 yan-score 缓存(useState 初始化用) */
export function peekYanScoreToday(): YanScoreToday | null {
  return peekCache<YanScoreToday>('yan-score:today') ?? null;
}
