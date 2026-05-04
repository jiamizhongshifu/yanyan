/**
 * SymptomStore — symptoms 表读写
 *
 * blind_input_ciphertext + severity_ciphertext 走 envelope encryption。
 * (uniq_user_date_source 防止同一天重复打卡同 source。)
 */

import { withClient } from '../../db/client';
import type { CheckinSource, SymptomCheckinPayload } from './types';

export interface SymptomRow {
  id: string;
  userId: string;
  recordedForDate: string; // YYYY-MM-DD
  blindInputCiphertext: string;
  severityCiphertext: string;
  definitionVersion: number;
  source: CheckinSource;
  createdAt: Date;
}

export interface CreateSymptomParams {
  userId: string;
  recordedForDate: string;
  blindInputCiphertext: string;
  severityCiphertext: string;
  definitionVersion: number;
  source: CheckinSource;
}

export interface SymptomStore {
  /** Upsert by (user_id, recorded_for_date, source) — 同一天打卡覆盖 */
  upsert(params: CreateSymptomParams): Promise<string>;
  /** 找指定日期的打卡(默认 source=next_morning) */
  findByDate(userId: string, date: string, source?: CheckinSource): Promise<SymptomRow | null>;
  /** 找昨日打卡 */
  findYesterday(userId: string, today: string, source?: CheckinSource): Promise<SymptomRow | null>;
}

function rowToSymptom(r: {
  id: string;
  user_id: string;
  recorded_for_date: Date | string;
  blind_input_ciphertext: string;
  severity_ciphertext: string;
  definition_version: number;
  source: CheckinSource;
  created_at: Date;
}): SymptomRow {
  return {
    id: r.id,
    userId: r.user_id,
    recordedForDate: typeof r.recorded_for_date === 'string' ? r.recorded_for_date : r.recorded_for_date.toISOString().slice(0, 10),
    blindInputCiphertext: r.blind_input_ciphertext,
    severityCiphertext: r.severity_ciphertext,
    definitionVersion: r.definition_version,
    source: r.source,
    createdAt: r.created_at
  };
}

export class PgSymptomStore implements SymptomStore {
  async upsert(params: CreateSymptomParams): Promise<string> {
    return await withClient(async (client) => {
      const r = await client.query<{ id: string }>(
        `INSERT INTO symptoms
           (user_id, recorded_for_date, blind_input_ciphertext, severity_ciphertext,
            definition_version, source)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (user_id, recorded_for_date, source) DO UPDATE SET
           blind_input_ciphertext = EXCLUDED.blind_input_ciphertext,
           severity_ciphertext = EXCLUDED.severity_ciphertext,
           definition_version = EXCLUDED.definition_version
         RETURNING id`,
        [
          params.userId,
          params.recordedForDate,
          params.blindInputCiphertext,
          params.severityCiphertext,
          params.definitionVersion,
          params.source
        ]
      );
      return r.rows[0].id;
    });
  }

  async findByDate(userId: string, date: string, source: CheckinSource = 'next_morning'): Promise<SymptomRow | null> {
    return await withClient(async (client) => {
      const r = await client.query(
        `SELECT id, user_id, recorded_for_date, blind_input_ciphertext, severity_ciphertext,
                definition_version, source, created_at
           FROM symptoms
          WHERE user_id = $1 AND recorded_for_date = $2 AND source = $3`,
        [userId, date, source]
      );
      if (r.rowCount === 0) return null;
      return rowToSymptom(r.rows[0] as Parameters<typeof rowToSymptom>[0]);
    });
  }

  async findYesterday(userId: string, today: string, source: CheckinSource = 'next_morning'): Promise<SymptomRow | null> {
    const yesterday = new Date(today);
    yesterday.setUTCDate(yesterday.getUTCDate() - 1);
    return await this.findByDate(userId, yesterday.toISOString().slice(0, 10), source);
  }
}

export function todayDateString(now: Date = new Date()): string {
  return now.toISOString().slice(0, 10);
}

export type { SymptomCheckinPayload };
