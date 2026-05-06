/**
 * MealStore — 餐食表读写
 *
 * recognized_items_ciphertext 走 envelope encryption(用户隐私 — 吃了什么);
 * tcm_labels_summary / western_nutrition_summary 是去敏聚合(Yan-Score 算法读取),不加密
 */

import { withClient } from '../../db/client';
import type { TcmLabel } from '../classifier';

export interface MealRow {
  id: string;
  userId: string;
  ateAt: Date;
  photoOssKey: string | null;
  recognizedItemsCiphertext: string;
  tcmLabelsSummary: { 发: number; 温和: number; 平: number; unknown: number };
  westernNutritionSummary: Record<string, unknown>;
  fireScore: number | null;
  /** 餐级添加糖累计(g)。null 表示未估算(老数据);0 表示估算后无添加糖 */
  sugarGrams: number | null;
  feedback: Array<{ itemName: string; kind: 'misrecognized' | 'no_reaction'; at: string }>;
  createdAt: Date;
}

export interface CreateMealParams {
  userId: string;
  ateAt: Date;
  photoOssKey: string;
  recognizedItemsCiphertext: string;
  tcmLabelsSummary: MealRow['tcmLabelsSummary'];
  westernNutritionSummary: Record<string, unknown>;
  fireScore: number;
  sugarGrams: number | null;
}

export interface MealStore {
  create(params: CreateMealParams): Promise<string>;
  findById(id: string, userId: string): Promise<MealRow | null>;
  /** 列出指定日期(YYYY-MM-DD)的所有餐食,按 ate_at 升序 */
  listByDate(userId: string, date: string): Promise<MealRow[]>;
  /** U13b 30 天档案:列出 [sinceDate, untilDate] 之间的全部餐食(按 ate_at 升序) */
  listInRange(userId: string, sinceDate: string, untilDate: string): Promise<MealRow[]>;
  appendFeedback(mealId: string, userId: string, entry: MealRow['feedback'][number]): Promise<void>;
  /** 用户编辑后整体覆写 items + 重算后的字段 */
  updateAfterRecompute(
    mealId: string,
    userId: string,
    params: {
      recognizedItemsCiphertext: string;
      tcmLabelsSummary: MealRow['tcmLabelsSummary'];
      westernNutritionSummary: Record<string, unknown>;
      fireScore: number;
      sugarGrams: number | null;
    }
  ): Promise<void>;
}

export class PgMealStore implements MealStore {
  async create(params: CreateMealParams): Promise<string> {
    return await withClient(async (client) => {
      const r = await client.query<{ id: string }>(
        `INSERT INTO meals
           (user_id, ate_at, photo_oss_key, recognized_items_ciphertext,
            tcm_labels_summary, western_nutrition_summary, fire_score, sugar_grams)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id`,
        [
          params.userId,
          params.ateAt,
          params.photoOssKey,
          params.recognizedItemsCiphertext,
          JSON.stringify(params.tcmLabelsSummary),
          JSON.stringify(params.westernNutritionSummary),
          params.fireScore,
          params.sugarGrams
        ]
      );
      return r.rows[0].id;
    });
  }

  async findById(id: string, userId: string): Promise<MealRow | null> {
    return await withClient(async (client) => {
      const r = await client.query<{
        id: string;
        user_id: string;
        ate_at: Date;
        photo_oss_key: string | null;
        recognized_items_ciphertext: string;
        tcm_labels_summary: MealRow['tcmLabelsSummary'];
        western_nutrition_summary: Record<string, unknown>;
        fire_score: string | null;
        sugar_grams: string | null;
        feedback: MealRow['feedback'];
        created_at: Date;
      }>(
        `SELECT id, user_id, ate_at, photo_oss_key, recognized_items_ciphertext,
                tcm_labels_summary, western_nutrition_summary, fire_score, sugar_grams, feedback, created_at
           FROM meals
          WHERE id = $1 AND user_id = $2`,
        [id, userId]
      );
      if (r.rowCount === 0) return null;
      const row = r.rows[0];
      return {
        id: row.id,
        userId: row.user_id,
        ateAt: row.ate_at,
        photoOssKey: row.photo_oss_key,
        recognizedItemsCiphertext: row.recognized_items_ciphertext,
        tcmLabelsSummary: row.tcm_labels_summary,
        westernNutritionSummary: row.western_nutrition_summary,
        fireScore: row.fire_score === null ? null : Number(row.fire_score),
        sugarGrams: row.sugar_grams === null ? null : Number(row.sugar_grams),
        feedback: row.feedback,
        createdAt: row.created_at
      };
    });
  }

  async listByDate(userId: string, date: string): Promise<MealRow[]> {
    return await withClient(async (client) => {
      const r = await client.query<{
        id: string;
        user_id: string;
        ate_at: Date;
        photo_oss_key: string | null;
        recognized_items_ciphertext: string;
        tcm_labels_summary: MealRow['tcmLabelsSummary'];
        western_nutrition_summary: Record<string, unknown>;
        fire_score: string | null;
        sugar_grams: string | null;
        feedback: MealRow['feedback'];
        created_at: Date;
      }>(
        `SELECT id, user_id, ate_at, photo_oss_key, recognized_items_ciphertext,
                tcm_labels_summary, western_nutrition_summary, fire_score, sugar_grams, feedback, created_at
           FROM meals
          WHERE user_id = $1 AND ate_at::date = $2
          ORDER BY ate_at ASC`,
        [userId, date]
      );
      return r.rows.map((row) => ({
        id: row.id,
        userId: row.user_id,
        ateAt: row.ate_at,
        photoOssKey: row.photo_oss_key,
        recognizedItemsCiphertext: row.recognized_items_ciphertext,
        tcmLabelsSummary: row.tcm_labels_summary,
        westernNutritionSummary: row.western_nutrition_summary,
        fireScore: row.fire_score === null ? null : Number(row.fire_score),
        sugarGrams: row.sugar_grams === null ? null : Number(row.sugar_grams),
        feedback: row.feedback,
        createdAt: row.created_at
      }));
    });
  }

  async listInRange(userId: string, sinceDate: string, untilDate: string): Promise<MealRow[]> {
    return await withClient(async (client) => {
      const r = await client.query<{
        id: string;
        user_id: string;
        ate_at: Date;
        photo_oss_key: string | null;
        recognized_items_ciphertext: string;
        tcm_labels_summary: MealRow['tcmLabelsSummary'];
        western_nutrition_summary: Record<string, unknown>;
        fire_score: string | null;
        sugar_grams: string | null;
        feedback: MealRow['feedback'];
        created_at: Date;
      }>(
        `SELECT id, user_id, ate_at, photo_oss_key, recognized_items_ciphertext,
                tcm_labels_summary, western_nutrition_summary, fire_score, sugar_grams, feedback, created_at
           FROM meals
          WHERE user_id = $1 AND ate_at::date >= $2 AND ate_at::date <= $3
          ORDER BY ate_at ASC`,
        [userId, sinceDate, untilDate]
      );
      return r.rows.map((row) => ({
        id: row.id,
        userId: row.user_id,
        ateAt: row.ate_at,
        photoOssKey: row.photo_oss_key,
        recognizedItemsCiphertext: row.recognized_items_ciphertext,
        tcmLabelsSummary: row.tcm_labels_summary,
        westernNutritionSummary: row.western_nutrition_summary,
        fireScore: row.fire_score === null ? null : Number(row.fire_score),
        sugarGrams: row.sugar_grams === null ? null : Number(row.sugar_grams),
        feedback: row.feedback,
        createdAt: row.created_at
      }));
    });
  }

  async appendFeedback(mealId: string, userId: string, entry: MealRow['feedback'][number]): Promise<void> {
    await withClient((c) =>
      c.query(
        `UPDATE meals
            SET feedback = feedback || $3::jsonb
          WHERE id = $1 AND user_id = $2`,
        [mealId, userId, JSON.stringify([entry])]
      )
    );
  }

  async updateAfterRecompute(
    mealId: string,
    userId: string,
    params: {
      recognizedItemsCiphertext: string;
      tcmLabelsSummary: MealRow['tcmLabelsSummary'];
      westernNutritionSummary: Record<string, unknown>;
      fireScore: number;
      sugarGrams: number | null;
    }
  ): Promise<void> {
    await withClient((c) =>
      c.query(
        `UPDATE meals
            SET recognized_items_ciphertext = $3,
                tcm_labels_summary = $4::jsonb,
                western_nutrition_summary = $5::jsonb,
                fire_score = $6,
                sugar_grams = $7
          WHERE id = $1 AND user_id = $2`,
        [
          mealId,
          userId,
          params.recognizedItemsCiphertext,
          JSON.stringify(params.tcmLabelsSummary),
          JSON.stringify(params.westernNutritionSummary),
          params.fireScore,
          params.sugarGrams
        ]
      )
    );
  }
}

/** 把 TcmLabel 计数转成 jsonb summary,for U8 Yan-Score 消费 */
export function summaryFromCounts(counts: { 发: number; 温和: number; 平: number; unknown: number }): MealRow['tcmLabelsSummary'] {
  return { 发: counts.发, 温和: counts.温和, 平: counts.平, unknown: counts.unknown };
}

/** 同样,把 classification 列表压成 western 聚合(平均 DII / AGEs / GI) */
export function westernSummary(classifications: Array<{ diiScore: number | null; agesScore: number | null; gi: number | null } | null>): Record<string, number | null> {
  let n = 0;
  let dii = 0;
  let ages = 0;
  let gi = 0;
  let giN = 0;
  for (const c of classifications) {
    if (!c) continue;
    n++;
    if (c.diiScore !== null) dii += c.diiScore;
    if (c.agesScore !== null) ages += c.agesScore;
    if (c.gi !== null) {
      gi += c.gi;
      giN++;
    }
  }
  return {
    avgDII: n === 0 ? null : Number((dii / n).toFixed(3)),
    avgAGEs: n === 0 ? null : Number((ages / n).toFixed(2)),
    avgGI: giN === 0 ? null : Number((gi / giN).toFixed(2)),
    n
  };
}

export type Tcm = TcmLabel;
