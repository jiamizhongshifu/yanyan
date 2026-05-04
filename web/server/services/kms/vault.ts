/**
 * Supabase Vault 主密钥来源(Phase 2 U10)
 *
 * Vault 提供:
 *   - vault.secrets 表 — pgsodium 自动加密静态存储
 *   - vault.decrypted_secrets 视图 — service-role 可见明文(仅 RPC 临时取出)
 *
 * 我们的用法:
 *   - 在 Vault 写一条 name='yanyan_envelope_master',value=64 hex 主密钥
 *   - 服务端用 service-role client `select decrypted_secret from vault.decrypted_secrets where name=...`
 *     首次取出 → 缓存 1h(LRU pattern,与 envelope.ts 一致)
 *
 * 安全:
 *   - 主密钥不在 env;仅 service-role 可读
 *   - service-role key 在 Vercel encrypted env(降级一层但仍是 Beta 安全水位)
 *   - Phase 3 切阿里云 KMS 时,改 KMS_MODE=aliyun + 增加 0x02 路径,无需重写 envelope
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { MasterKeySource } from '../../crypto/kms';
import { KMS_VERSION_VAULT } from '../../crypto/kms';
import { getConfig } from '../../config';

const VAULT_SECRET_NAME = 'yanyan_envelope_master';
const CACHE_TTL_MS = 60 * 60 * 1000; // 1h

export class VaultMasterSource implements MasterKeySource {
  readonly version = KMS_VERSION_VAULT;
  private cached: { key: Buffer; expiresAt: number } | null = null;
  private clientFactory: () => SupabaseClient;

  constructor(clientFactory?: () => SupabaseClient) {
    this.clientFactory = clientFactory ?? (() => buildServiceClient());
  }

  async getMasterKey(): Promise<Buffer> {
    const now = Date.now();
    if (this.cached && this.cached.expiresAt > now) return this.cached.key;

    const client = this.clientFactory();
    // 通过 RPC `get_secret(secret_name)` 拿明文(SQL 函数下方迁移定义)
    const { data, error } = await client.rpc('get_envelope_master');
    if (error) {
      throw new Error(`Vault RPC failed: ${error.message}`);
    }
    if (!data || typeof data !== 'string') {
      throw new Error(`Vault secret '${VAULT_SECRET_NAME}' missing or empty`);
    }
    const buf = Buffer.from(data, 'hex');
    if (buf.length !== 32) {
      throw new Error('Vault master must be 32 bytes (64 hex chars)');
    }
    this.cached = { key: buf, expiresAt: now + CACHE_TTL_MS };
    return buf;
  }

  /** 测试用:清缓存 */
  resetForTesting(): void {
    this.cached = null;
  }
}

function buildServiceClient(): SupabaseClient {
  const cfg = getConfig();
  if (!cfg.SUPABASE_URL || !cfg.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('VaultMasterSource 需要 SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY');
  }
  return createClient(cfg.SUPABASE_URL, cfg.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false }
  });
}
