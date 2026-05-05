/**
 * Yan-Score v0 service — 整合 4 Part + 聚合,供 api/v1/yan-score 路由调用
 *
 * v1 数据来源:
 *   - FoodPart: 今日 meals.tcm_labels_summary 累加
 *   - SymptomPart: 今日 next_morning symptoms 解密 → effectiveSeverityMap
 *   - EnvPart: env_snapshots 表(U9 接;v1 占位接受 null)
 *   - ActivityPart: 微信运动通道(plan U9+ ;v1 接受 null)
 */

import { withClient } from '../../db/client';
import { decryptField } from '../../crypto/envelope';
import type { SymptomCheckinPayload, SymptomStore } from '../symptoms';
import { aggregate } from './aggregator';
import { computeActivityPart, computeEnvPart, computeFoodPart, computeSymptomPart, type ActivitySnapshot, type DailyMealAggregate, type EnvSnapshot } from './parts';
import type { YanScoreResult } from './types';

export interface ScoreDeps {
  symptomStore: SymptomStore;
  /** userId → DEK 密文(symptoms 解密用) */
  getUserDek: (userId: string) => Promise<string | null>;
  /** 今日 meal 聚合 — 默认 PgPool 实现见下;测试可注入 */
  loadDailyMealAggregate?: (userId: string, date: string) => Promise<DailyMealAggregate>;
  /** U9 接入前默认返回 null */
  loadEnvSnapshot?: (userId: string, date: string) => Promise<EnvSnapshot | null>;
  /** U9 接入前默认返回 null */
  loadActivitySnapshot?: (userId: string, date: string) => Promise<ActivitySnapshot | null>;
}

/**
 * 默认从 meals 表聚合今日所有 meals 的 tcm_labels_summary
 */
export async function defaultLoadDailyMealAggregate(userId: string, date: string): Promise<DailyMealAggregate> {
  return await withClient(async (c) => {
    const r = await c.query<{ tcm_labels_summary: { 发?: number; 温和?: number; 平?: number; unknown?: number } }>(
      `SELECT tcm_labels_summary FROM meals
        WHERE user_id = $1 AND ate_at::date = $2`,
      [userId, date]
    );
    const counts = { 发: 0, 温和: 0, 平: 0, unknown: 0 };
    for (const row of r.rows) {
      const s = row.tcm_labels_summary;
      counts.发 += s.发 ?? 0;
      counts.温和 += s.温和 ?? 0;
      counts.平 += s.平 ?? 0;
      counts.unknown += s.unknown ?? 0;
    }
    return { counts };
  });
}

/** 计算指定用户指定日期的 Yan-Score(可用 < 2 Parts → null) */
export async function computeYanScoreForDay(
  deps: ScoreDeps,
  userId: string,
  date: string
): Promise<{ hasAny: boolean; result: YanScoreResult | null; partScores: { food: number | null; symptom: number | null; env: number | null; activity: number | null } }> {
  // FoodPart
  const loadMeal = deps.loadDailyMealAggregate ?? defaultLoadDailyMealAggregate;
  const mealAgg = await loadMeal(userId, date);
  const foodPart = computeFoodPart(mealAgg);

  // SymptomPart
  let symptomPart: number | null = null;
  const symptoms = await deps.symptomStore.findByDate(userId, date, 'next_morning');
  if (symptoms) {
    const dek = await deps.getUserDek(userId);
    if (dek) {
      const blind = await decryptField<SymptomCheckinPayload>(userId, dek, symptoms.blindInputCiphertext);
      symptomPart = computeSymptomPart(blind);
    }
  }

  // EnvPart
  const env = deps.loadEnvSnapshot ? await deps.loadEnvSnapshot(userId, date) : null;
  const envPart = computeEnvPart(env);

  // ActivityPart
  const activity = deps.loadActivitySnapshot ? await deps.loadActivitySnapshot(userId, date) : null;
  const activityPart = computeActivityPart(activity);

  const partScores = { food: foodPart, symptom: symptomPart, env: envPart, activity: activityPart };
  const hasAny = Object.values(partScores).some((v) => v !== null);
  const result = aggregate(partScores);

  return { hasAny, result, partScores };
}

export * from './types';
export * from './parts';
export { aggregate } from './aggregator';
export { fetchYanScoreHistory, type YanScoreHistoryEntry } from './history';
