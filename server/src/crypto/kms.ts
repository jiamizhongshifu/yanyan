/**
 * KMS 抽象层(Phase 2 U10 升级)
 *
 * envelope encryption 模式:
 *   - master key 由 KMS 管理(LocalEnv / SupabaseVault / 阿里云 KMS),永不离开 KMS
 *   - 每个用户有自己的 DEK(Data Encryption Key,32 bytes for AES-256)
 *   - DEK 创建:KMS.generateDataKey() 返回 {plaintext, ciphertext}
 *   - 数据读写:从内存缓存或 KMS.decryptDataKey 拿 plaintext DEK,做 AES-256-GCM
 *
 * Phase 2 U10 加版本字节(forward-compat):
 *   - DEK 密文(users.dek_ciphertext_b64)第一字节 = `kms_version`
 *     0x00 = LocalEnvMaster(KMS_LOCAL_MASTER_KEY env)
 *     0x01 = SupabaseVaultMaster(vault.secrets)
 *     0x02 = AliyunKms(Phase 3 预留)
 *   - reader 按版本路由,writer 写当前默认版本
 *   - rewrap 脚本扫所有旧版本 → 解 → 用新版本重加密
 */

import { createCipheriv, createDecipheriv, randomBytes, createHmac } from 'crypto';
import { getConfig } from '../config';

export const KMS_VERSION_LOCAL_ENV = 0x00;
export const KMS_VERSION_VAULT = 0x01;
export const KMS_VERSION_ALIYUN = 0x02;

export interface DataKey {
  /** 32 字节明文 DEK,仅在内存中存在 */
  plaintext: Buffer;
  /** 第一字节 = kms_version + 后续 = wrapped DEK;持久化到 users.dek_ciphertext_b64 */
  ciphertext: Buffer;
}

export interface KmsClient {
  generateDataKey(userId: string): Promise<DataKey>;
  decryptDataKey(userId: string, ciphertext: Buffer): Promise<Buffer>;
  scheduleKeyDeletion(userId: string): Promise<void>;
}

/** 主密钥来源抽象 — 不同来源(env / Vault / 阿里云)实现 */
export interface MasterKeySource {
  readonly version: number;
  /** 取出明文主密钥(32 字节)— 实现内部应缓存,避免每次都拉 */
  getMasterKey(): Promise<Buffer>;
}

/**
 * 0x00 — 主密钥从 env 读取(KMS_LOCAL_MASTER_KEY)
 * Phase 2 起 deprecated for production;test / dev 仍可用
 */
export class LocalEnvMasterSource implements MasterKeySource {
  readonly version = KMS_VERSION_LOCAL_ENV;
  private cached: Buffer | null = null;

  async getMasterKey(): Promise<Buffer> {
    if (this.cached) return this.cached;
    const cfg = getConfig();
    if (!cfg.KMS_LOCAL_MASTER_KEY) {
      throw new Error('LocalEnvMasterSource 需要 KMS_LOCAL_MASTER_KEY env');
    }
    this.cached = Buffer.from(cfg.KMS_LOCAL_MASTER_KEY, 'hex');
    if (this.cached.length !== 32) {
      throw new Error('KMS_LOCAL_MASTER_KEY 必须是 32 字节(64 hex)');
    }
    return this.cached;
  }
}

function wrapDek(masterKey: Buffer, userId: string, dek: Buffer): Buffer {
  const iv = randomBytes(12);
  const aad = Buffer.from(`yanyan:dek:${userId}`, 'utf8');
  const cipher = createCipheriv('aes-256-gcm', masterKey, iv);
  cipher.setAAD(aad);
  const enc = Buffer.concat([cipher.update(dek), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, enc]);
}

function unwrapDek(masterKey: Buffer, userId: string, wrapped: Buffer): Buffer {
  const iv = wrapped.subarray(0, 12);
  const tag = wrapped.subarray(12, 28);
  const enc = wrapped.subarray(28);
  const aad = Buffer.from(`yanyan:dek:${userId}`, 'utf8');
  const decipher = createDecipheriv('aes-256-gcm', masterKey, iv);
  decipher.setAuthTag(tag);
  decipher.setAAD(aad);
  return Buffer.concat([decipher.update(enc), decipher.final()]);
}

/**
 * 通用 KMS client:用 MasterKeySource 做实际加解密
 * - writeSource:新 DEK 用哪个版本写
 * - readSources:支持读取的所有版本(routing by first byte)
 */
export class EnvelopeKmsClient implements KmsClient {
  private revokedUsers = new Set<string>();

  constructor(
    private writeSource: MasterKeySource,
    private readSources: Map<number, MasterKeySource>
  ) {
    if (!readSources.has(writeSource.version)) {
      readSources.set(writeSource.version, writeSource);
    }
  }

  async generateDataKey(userId: string): Promise<DataKey> {
    const dekPlain = randomBytes(32);
    const master = await this.writeSource.getMasterKey();
    const wrapped = wrapDek(master, userId, dekPlain);
    const ciphertext = Buffer.concat([Buffer.from([this.writeSource.version]), wrapped]);
    return { plaintext: dekPlain, ciphertext };
  }

  async decryptDataKey(userId: string, ciphertext: Buffer): Promise<Buffer> {
    if (this.revokedUsers.has(userId)) {
      throw new Error(`KMS access for user ${userId} has been revoked`);
    }
    if (ciphertext.length === 0) throw new Error('empty ciphertext');
    const version = ciphertext[0];
    const source = this.readSources.get(version);
    if (!source) {
      throw new Error(`unknown_kms_version: 0x${version.toString(16).padStart(2, '0')}`);
    }
    const master = await source.getMasterKey();
    return unwrapDek(master, userId, ciphertext.subarray(1));
  }

  async scheduleKeyDeletion(userId: string): Promise<void> {
    this.revokedUsers.add(userId);
  }

  resetForTesting(): void {
    this.revokedUsers.clear();
  }
}

/** 工厂:基于 KMS_MODE 构造 client(Vault 主密钥取出在 getMasterKey 内 lazy) */
let cached: KmsClient | null = null;

// 静态 import — 让 buildKmsClientForMode 保持同步;Vault RPC 在 getMasterKey 内 lazy
import { VaultMasterSource } from '../services/kms/vault';

export function buildKmsClientForMode(mode: string): KmsClient {
  const local = new LocalEnvMasterSource();
  switch (mode) {
    case 'vault': {
      const vault = new VaultMasterSource();
      const sources = new Map<number, MasterKeySource>();
      sources.set(KMS_VERSION_LOCAL_ENV, local);
      sources.set(KMS_VERSION_VAULT, vault);
      return new EnvelopeKmsClient(vault, sources);
    }
    case 'aliyun':
      throw new Error('KMS_MODE=aliyun 推到 Phase 3,跟 ICP 备案 + 阿里云迁移一起做');
    case 'local':
    default: {
      const sources = new Map<number, MasterKeySource>();
      sources.set(KMS_VERSION_LOCAL_ENV, local);
      return new EnvelopeKmsClient(local, sources);
    }
  }
}

export function getKms(): KmsClient {
  if (!cached) {
    cached = buildKmsClientForMode(getConfig().KMS_MODE);
  }
  return cached;
}

export function resetKmsForTesting(): void {
  cached = null;
}

/** 用 SHA-256 + master key 派生一个 IP 哈希盐 */
export function hashClientIp(ip: string): string {
  const cfg = getConfig();
  const salt = cfg.KMS_LOCAL_MASTER_KEY ?? cfg.KMS_KEY_ID ?? 'yanyan';
  return createHmac('sha256', salt).update(ip).digest('hex');
}

// ─── Backward compat exports ───
// 老代码里 import { LocalKmsStub, AliyunKmsClient } 仍工作
export const LocalKmsStub = LocalEnvMasterSourceCompat;
function LocalEnvMasterSourceCompat(): KmsClient {
  const src = new LocalEnvMasterSource();
  return new EnvelopeKmsClient(src, new Map([[KMS_VERSION_LOCAL_ENV, src]]));
}
export class AliyunKmsClient implements KmsClient {
  async generateDataKey(_userId: string): Promise<DataKey> {
    throw new Error('AliyunKmsClient 推到 Phase 3');
  }
  async decryptDataKey(_userId: string, _ciphertext: Buffer): Promise<Buffer> {
    throw new Error('AliyunKmsClient 推到 Phase 3');
  }
  async scheduleKeyDeletion(_userId: string): Promise<void> {
    throw new Error('AliyunKmsClient 推到 Phase 3');
  }
}
