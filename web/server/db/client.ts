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
    const cfg = getConfig();
    const url = cfg.DATABASE_URL;
    // Supabase Postgres 强制要求 SSL;DATABASE_URL 通常含 ?sslmode=require
    // node-postgres 在 Vercel serverless 环境下需要显式 ssl: { rejectUnauthorized: false }(Supabase 自签 CA)
    const useSSL = url.includes('supabase.co') || url.includes('sslmode=require');
    pool = new Pool({
      connectionString: url,
      // Vercel 单 Function 容器寿命短;池子小,空闲快回收
      max: 5,
      idleTimeoutMillis: 10_000,
      connectionTimeoutMillis: 5_000,
      ssl: useSSL ? { rejectUnauthorized: false } : undefined
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
