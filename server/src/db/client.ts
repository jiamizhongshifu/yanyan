/**
 * PostgreSQL pool 包装
 *
 * 单例 pool;启动时不强制连接(允许 /health 在 DB 暂不可用时仍返回 200)。
 * 但 /health/db 子端点强制查 DB,生产探活用。
 */

import { Pool, PoolClient } from 'pg';
import { getConfig } from '../config';

let pool: Pool | null = null;

export function getPool(): Pool {
  if (!pool) {
    pool = new Pool({
      connectionString: getConfig().DATABASE_URL,
      max: 10,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 5_000
    });
    pool.on('error', (err) => {
      // eslint-disable-next-line no-console
      console.error('[Yanyan] pg pool error:', err);
    });
  }
  return pool;
}

export async function withClient<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await getPool().connect();
  try {
    return await fn(client);
  } finally {
    client.release();
  }
}

export async function pingDb(): Promise<{ ok: boolean; latencyMs?: number; error?: string }> {
  const started = Date.now();
  try {
    await withClient((c) => c.query('SELECT 1'));
    return { ok: true, latencyMs: Date.now() - started };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export async function closePool(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
  }
}
