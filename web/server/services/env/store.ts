/**
 * EnvSnapshotStore — env_snapshots 表读写
 *
 * v1 schema(已建于 U2 schema.sql):
 *   PK (city_code, snapshot_at)
 *   字段:pm25 / pollen_level / season / raw_payload
 */

import { withClient } from '../../db/client';
import type { EnvSnapshot, PollenLevel, Season } from './types';

export interface EnvSnapshotStore {
  /** 取该城市最新一条 snapshot(无论新旧) */
  findLatest(cityCode: string): Promise<EnvSnapshot | null>;
  insert(snapshot: EnvSnapshot): Promise<void>;
}

interface RowFromDb {
  city_code: string;
  snapshot_at: Date;
  pm25: string | null; // numeric → string
  pollen_level: string | null;
  season: string | null;
  raw_payload: Record<string, unknown>;
}

function rowToSnapshot(r: RowFromDb): EnvSnapshot {
  return {
    cityCode: r.city_code,
    snapshotAt: r.snapshot_at,
    pm25: r.pm25 === null ? null : Number(r.pm25),
    pollenLevel: (r.pollen_level as PollenLevel | null) ?? null,
    season: (r.season as Season | null) ?? 'spring',
    rawPayload: r.raw_payload
  };
}

export class PgEnvSnapshotStore implements EnvSnapshotStore {
  async findLatest(cityCode: string): Promise<EnvSnapshot | null> {
    return await withClient(async (c) => {
      const r = await c.query<RowFromDb>(
        `SELECT city_code, snapshot_at, pm25, pollen_level, season, raw_payload
           FROM env_snapshots
          WHERE city_code = $1
          ORDER BY snapshot_at DESC
          LIMIT 1`,
        [cityCode]
      );
      if (r.rowCount === 0) return null;
      return rowToSnapshot(r.rows[0]);
    });
  }

  async insert(snapshot: EnvSnapshot): Promise<void> {
    await withClient(async (c) => {
      await c.query(
        `INSERT INTO env_snapshots (city_code, snapshot_at, pm25, pollen_level, season, raw_payload)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (city_code, snapshot_at) DO NOTHING`,
        [
          snapshot.cityCode,
          snapshot.snapshotAt,
          snapshot.pm25,
          snapshot.pollenLevel,
          snapshot.season,
          JSON.stringify(snapshot.rawPayload ?? {})
        ]
      );
    });
  }
}
