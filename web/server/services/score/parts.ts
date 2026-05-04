/**
 * 各 Part 的标准化算法 — 输出 [0, 100] 或 null(无数据)
 *
 * Round 2 + plan U8 spec:
 *   FoodPart   = (Σ weight) / (N × 5) × 100
 *                weights: 发=5, 温和=2, 平=0, unknown=0
 *                N=食物条目数;N=0 → null
 *   SymptomPart= 各维度 (severity / max_level × 100) 平均
 *                只算 effectiveSeverityMap 中的有效项;空 → null
 *   EnvPart    = PM2.5 + 季节加成 + 花粉(可获城市)
 *                U8 占位:仅 season 季节修正,U9 接 PM2.5 / 花粉 SDK
 *   ActivityPart = (今日步数 vs 7 日个人基线偏差)→ 0-100
 *                U8 阶段:步数缺失为常态(微信运动等数据通道 U9 才接)→ 永远 null
 */

import type { TcmLabel } from '../classifier';
import {
  effectiveSeverityMap,
  SYMPTOM_DIMENSIONS,
  SYMPTOM_DIMENSION_LEVELS,
  type SymptomCheckinPayload
} from '../symptoms';

// ─── Food Part ──────────────────────────────────────────────────────────

export interface DailyMealAggregate {
  /** 各档食物条目数(累加今日所有 meals 的 tcm_labels_summary) */
  counts: { 发: number; 温和: number; 平: number; unknown: number };
}

const TCM_WEIGHTS: Record<TcmLabel, number> = { 发: 5, 温和: 2, 平: 0 };

export function computeFoodPart(agg: DailyMealAggregate): number | null {
  const N = agg.counts.发 + agg.counts.温和 + agg.counts.平 + agg.counts.unknown;
  if (N === 0) return null;
  const weighted =
    agg.counts.发 * TCM_WEIGHTS.发 +
    agg.counts.温和 * TCM_WEIGHTS.温和 +
    agg.counts.平 * TCM_WEIGHTS.平; // unknown 视为 0(保守)
  const normalized = (weighted / (N * 5)) * 100;
  return clipScore(normalized);
}

// ─── Symptom Part ───────────────────────────────────────────────────────

export function computeSymptomPart(payload: SymptomCheckinPayload): number | null {
  const sev = effectiveSeverityMap(payload);
  const entries = Object.entries(sev) as Array<[(typeof SYMPTOM_DIMENSIONS)[number], number]>;
  if (entries.length === 0) return null;
  let total = 0;
  for (const [dim, severity] of entries) {
    const max = SYMPTOM_DIMENSION_LEVELS[dim];
    total += (severity / max) * 100;
  }
  return clipScore(total / entries.length);
}

// ─── Env Part ───────────────────────────────────────────────────────────

export interface EnvSnapshot {
  pm25?: number | null; // 0-500
  pollenLevel?: 'low' | 'mid' | 'high' | null;
  /** 季节 — 春/秋默认发物高发期 +5 */
  season?: 'spring' | 'summer' | 'autumn' | 'winter' | null;
}

export function computeEnvPart(env: EnvSnapshot | null): number | null {
  if (!env) return null;
  let signals = 0;
  let parts = 0;
  if (env.pm25 != null) {
    // 优 0 / 良 30 / 轻度 60 / 中度 80 / 重度 100(plan U9)
    let pm = 0;
    if (env.pm25 <= 35) pm = 0;
    else if (env.pm25 <= 75) pm = 30;
    else if (env.pm25 <= 115) pm = 60;
    else if (env.pm25 <= 150) pm = 80;
    else pm = 100;
    signals += pm;
    parts++;
  }
  if (env.pollenLevel) {
    const map: Record<NonNullable<EnvSnapshot['pollenLevel']>, number> = { low: 10, mid: 50, high: 90 };
    signals += map[env.pollenLevel];
    parts++;
  }
  if (env.season) {
    // 春秋发物季节 +20,夏冬 0
    signals += env.season === 'spring' || env.season === 'autumn' ? 20 : 0;
    parts++;
  }
  if (parts === 0) return null;
  return clipScore(signals / parts);
}

// ─── Activity Part ──────────────────────────────────────────────────────

export interface ActivitySnapshot {
  /** 今日步数 */
  todaySteps: number;
  /** 个人 7 日中位数;计算依赖足够样本,否则缺失 */
  weekMedianSteps?: number | null;
}

/**
 * 偏差 = (今日 - 中位数) / 中位数
 *   偏差 ≤ -50% → 100 分(明显比平时少)
 *   偏差 0  → 50  分
 *   偏差 ≥ +50% → 0  分(比平时多更多,身体活跃)
 */
export function computeActivityPart(activity: ActivitySnapshot | null): number | null {
  if (!activity) return null;
  if (activity.weekMedianSteps == null || activity.weekMedianSteps <= 0) return null;
  const ratio = (activity.todaySteps - activity.weekMedianSteps) / activity.weekMedianSteps;
  // map ratio -0.5..+0.5 → 100..0,clip
  let score = 50 - ratio * 100;
  score = clipScore(score);
  return score;
}

// ─── 工具 ───────────────────────────────────────────────────────────────

function clipScore(s: number): number {
  if (Number.isNaN(s)) return 0;
  return Math.max(0, Math.min(100, Math.round(s * 10) / 10));
}
