/**
 * KMS 抽象层
 *
 * envelope encryption 模式:
 *   - master key 由 KMS 管理(本地 stub / 阿里云 KMS),永不离开 KMS
 *   - 每个用户有自己的 DEK(Data Encryption Key,32 bytes for AES-256)
 *   - DEK 创建时:KMS.generateDataKey() 返回 {plaintext, ciphertext}
 *     plaintext 用一次后立即丢弃 / 内存中缓存(LRU,TTL 1h)
 *     ciphertext 持久化在 users.dek_ciphertext_b64
 *   - 数据读写:从内存缓存或 KMS.decryptDataKey(ciphertext) 拿 plaintext DEK,做 AES-256-GCM
 *
 * 撤回同意时,KMS.scheduleKeyDeletion 立即吊销该用户 DEK 解密权限(plan U3 撤回流程)
 */

import { createCipheriv, createDecipheriv, randomBytes, createHmac } from 'crypto';
import { getConfig } from '../config';

export interface DataKey {
  /** 32 字节明文 DEK,仅在内存中存在,使用后应立即丢弃或缓存 */
  plaintext: Buffer;
  /** 主密钥加密后的 DEK 密文,持久化到 users.dek_ciphertext_b64 */
  ciphertext: Buffer;
}

export interface KmsClient {
  /** 为新用户生成一个 DEK */
  generateDataKey(userId: string): Promise<DataKey>;
  /** 用主密钥解密用户 DEK 密文 */
  decryptDataKey(userId: string, ciphertext: Buffer): Promise<Buffer>;
  /** 撤回用户 DEK 解密权限(plan R5b/R3 撤回流程的 KMS 即时吊销) */
  scheduleKeyDeletion(userId: string): Promise<void>;
}

/**
 * 本地 stub:用 ENV 中的 master key 做 AES-256-GCM 包装 DEK
 * 仅用于 dev / test;生产必须切换为 AliyunKmsClient(待实现)
 *
 * 注意:本地 stub 仍提供 scheduleKeyDeletion 的语义(把 userId 加入吊销集合,后续 decryptDataKey 拒绝),
 * 这样 dev 环境也能验证撤回链路。
 */
export class LocalKmsStub implements KmsClient {
  private masterKey: Buffer;
  private revokedUsers = new Set<string>();

  constructor() {
    const cfg = getConfig();
    if (!cfg.KMS_LOCAL_MASTER_KEY) {
      throw new Error('LocalKmsStub 需要 KMS_LOCAL_MASTER_KEY');
    }
    this.masterKey = Buffer.from(cfg.KMS_LOCAL_MASTER_KEY, 'hex');
  }

  async generateDataKey(_userId: string): Promise<DataKey> {
    const dekPlaintext = randomBytes(32);
    const ciphertext = this.wrapWithMaster(_userId, dekPlaintext);
    return { plaintext: dekPlaintext, ciphertext };
  }

  async decryptDataKey(userId: string, ciphertext: Buffer): Promise<Buffer> {
    if (this.revokedUsers.has(userId)) {
      throw new Error(`KMS access for user ${userId} has been revoked`);
    }
    return this.unwrapWithMaster(userId, ciphertext);
  }

  async scheduleKeyDeletion(userId: string): Promise<void> {
    this.revokedUsers.add(userId);
  }

  /** 测试用:重置吊销集合 */
  resetForTesting(): void {
    this.revokedUsers.clear();
  }

  private wrapWithMaster(userId: string, dek: Buffer): Buffer {
    const iv = randomBytes(12);
    const aad = Buffer.from(`yanyan:dek:${userId}`, 'utf8'); // 把 userId 绑进 AAD,跨用户解密会失败
    const cipher = createCipheriv('aes-256-gcm', this.masterKey, iv);
    cipher.setAAD(aad);
    const enc = Buffer.concat([cipher.update(dek), cipher.final()]);
    const tag = cipher.getAuthTag();
    return Buffer.concat([iv, tag, enc]);
  }

  private unwrapWithMaster(userId: string, ciphertext: Buffer): Buffer {
    const iv = ciphertext.subarray(0, 12);
    const tag = ciphertext.subarray(12, 28);
    const enc = ciphertext.subarray(28);
    const aad = Buffer.from(`yanyan:dek:${userId}`, 'utf8');
    const decipher = createDecipheriv('aes-256-gcm', this.masterKey, iv);
    decipher.setAuthTag(tag);
    decipher.setAAD(aad);
    return Buffer.concat([decipher.update(enc), decipher.final()]);
  }
}

/**
 * 阿里云 KMS 客户端(占位)
 * U2 阶段不实施;部署生产时替换为真实阿里云 SDK 调用
 */
export class AliyunKmsClient implements KmsClient {
  async generateDataKey(_userId: string): Promise<DataKey> {
    throw new Error('AliyunKmsClient.generateDataKey 待 ce-work 接入阿里云 KMS SDK 时实施');
  }
  async decryptDataKey(_userId: string, _ciphertext: Buffer): Promise<Buffer> {
    throw new Error('AliyunKmsClient.decryptDataKey 待 ce-work 接入阿里云 KMS SDK 时实施');
  }
  async scheduleKeyDeletion(_userId: string): Promise<void> {
    throw new Error('AliyunKmsClient.scheduleKeyDeletion 待 ce-work 接入阿里云 KMS SDK 时实施');
  }
}

let cached: KmsClient | null = null;

export function getKms(): KmsClient {
  if (!cached) {
    const mode = getConfig().KMS_MODE;
    cached = mode === 'aliyun' ? new AliyunKmsClient() : new LocalKmsStub();
  }
  return cached;
}

export function resetKmsForTesting(): void {
  cached = null;
}

/** 用 SHA-256 + master key 派生一个 IP 哈希盐(用于 privacy_consents.client_ip_hash) */
export function hashClientIp(ip: string): string {
  const cfg = getConfig();
  const salt = cfg.KMS_LOCAL_MASTER_KEY ?? cfg.KMS_KEY_ID ?? 'yanyan';
  return createHmac('sha256', salt).update(ip).digest('hex');
}
