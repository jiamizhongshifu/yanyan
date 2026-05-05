/**
 * FoodClassifierStore — 食物分类表读写
 */

import { withClient } from '../../db/client';
import type { Citation, FoodClassification, TcmLabel, TcmProperty } from './types';

interface RowFromDb {
  id: string;
  food_canonical_name: string;
  tcm_label: TcmLabel;
  tcm_property: TcmProperty;
  dii_score: string | null;
  ages_score: string | null;
  gi: string | null;
  added_sugar_g: string | null;
  carbs_g: string | null;
  citations: Citation[];
  source_versions: Record<string, unknown>;
}

function rowToClassification(r: RowFromDb): FoodClassification {
  return {
    id: r.id,
    foodCanonicalName: r.food_canonical_name,
    tcmLabel: r.tcm_label,
    tcmProperty: r.tcm_property,
    diiScore: r.dii_score === null ? null : Number(r.dii_score),
    agesScore: r.ages_score === null ? null : Number(r.ages_score),
    gi: r.gi === null ? null : Number(r.gi),
    addedSugarG: r.added_sugar_g === null ? null : Number(r.added_sugar_g),
    carbsG: r.carbs_g === null ? null : Number(r.carbs_g),
    citations: r.citations,
    sourceVersions: r.source_versions
  };
}

export interface UpsertParams {
  foodCanonicalName: string;
  tcmLabel: TcmLabel;
  tcmProperty: TcmProperty;
  diiScore?: number | null;
  agesScore?: number | null;
  gi?: number | null;
  addedSugarG?: number | null;
  carbsG?: number | null;
  citations: Citation[];
  sourceVersions: Record<string, unknown>;
}

export interface FoodClassifierStore {
  findByName(name: string): Promise<FoodClassification | null>;
  upsert(params: UpsertParams): Promise<FoodClassification>;
  count(): Promise<number>;
  /** 测试 / 报表用 */
  countWithCitations(): Promise<number>;
  /** U13a 推荐:按 tcm_label 列出 top-N(优先有典籍引用的) */
  listByLabel(label: TcmLabel, limit: number): Promise<FoodClassification[]>;
}

export class PgFoodClassifierStore implements FoodClassifierStore {
  async findByName(name: string): Promise<FoodClassification | null> {
    return await withClient(async (client) => {
      const r = await client.query<RowFromDb>(
        `SELECT id, food_canonical_name, tcm_label, tcm_property,
                dii_score, ages_score, gi, added_sugar_g, carbs_g, citations, source_versions
           FROM food_classifications
          WHERE food_canonical_name = $1`,
        [name]
      );
      if (r.rowCount === 0) return null;
      return rowToClassification(r.rows[0]);
    });
  }

  async upsert(params: UpsertParams): Promise<FoodClassification> {
    return await withClient(async (client) => {
      const r = await client.query<RowFromDb>(
        `INSERT INTO food_classifications
           (food_canonical_name, tcm_label, tcm_property, dii_score, ages_score, gi,
            added_sugar_g, carbs_g, citations, source_versions)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
         ON CONFLICT (food_canonical_name) DO UPDATE SET
           tcm_label = EXCLUDED.tcm_label,
           tcm_property = EXCLUDED.tcm_property,
           dii_score = EXCLUDED.dii_score,
           ages_score = EXCLUDED.ages_score,
           gi = EXCLUDED.gi,
           added_sugar_g = EXCLUDED.added_sugar_g,
           carbs_g = EXCLUDED.carbs_g,
           citations = EXCLUDED.citations,
           source_versions = EXCLUDED.source_versions,
           updated_at = now()
         RETURNING id, food_canonical_name, tcm_label, tcm_property,
                   dii_score, ages_score, gi, added_sugar_g, carbs_g,
                   citations, source_versions`,
        [
          params.foodCanonicalName,
          params.tcmLabel,
          params.tcmProperty,
          params.diiScore ?? null,
          params.agesScore ?? null,
          params.gi ?? null,
          params.addedSugarG ?? null,
          params.carbsG ?? null,
          JSON.stringify(params.citations),
          JSON.stringify(params.sourceVersions)
        ]
      );
      return rowToClassification(r.rows[0]);
    });
  }

  async count(): Promise<number> {
    return await withClient(async (client) => {
      const r = await client.query<{ count: string }>(`SELECT COUNT(*)::text AS count FROM food_classifications`);
      return Number(r.rows[0].count);
    });
  }

  async listByLabel(label: TcmLabel, limit: number): Promise<FoodClassification[]> {
    return await withClient(async (client) => {
      const r = await client.query<RowFromDb>(
        `SELECT id, food_canonical_name, tcm_label, tcm_property,
                dii_score, ages_score, gi, added_sugar_g, carbs_g,
                citations, source_versions
           FROM food_classifications
          WHERE tcm_label = $1
          ORDER BY jsonb_array_length(citations) DESC, food_canonical_name ASC
          LIMIT $2`,
        [label, limit]
      );
      return r.rows.map(rowToClassification);
    });
  }

  async countWithCitations(): Promise<number> {
    return await withClient(async (client) => {
      const r = await client.query<{ count: string }>(
        `SELECT COUNT(*)::text AS count
           FROM food_classifications
          WHERE jsonb_array_length(citations) > 0`
      );
      return Number(r.rows[0].count);
    });
  }
}
