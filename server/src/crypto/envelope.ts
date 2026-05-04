/**
 * Envelope encryption — 字段级加解密
 *
 * 流程:
 *   1. 调用方传入 userId + 该用户的 DEK 密文(从 users.dek_ciphertext_b64 读取)
 *   2. 优先从 LRU 内存缓存命中明文 DEK;miss 才调 KMS.decryptDataKey
 *   3. 用 DEK 做 AES-256-GCM 加解密
 *
 * 缓存策略:
 *   - LRU,容量 1000 用户、TTL 1 小时
 *   - 撤回同意时主动 evict:plan U3 撤回流程在 KMS 吊销后调 evictDekFromCache(userId)
 *
 * 性能预算:
 *   - 缓存命中:< 0.5ms (纯 AES-GCM)
 *   - 缓存 miss:30-80ms (调 KMS) — 应该极少发生
 */

import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';
import { getKms } from './kms';

interface CacheEntry {
  dek: Buffer;
  expiresAt: number;
}

const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour
const CACHE_CAPACITY = 1000;
const dekCache = new Map<string, CacheEntry>();

async function getDek(userId: string, ciphertextB64: string): Promise<Buffer> {
  const now = Date.now();
  const hit = dekCache.get(userId);
  if (hit && hit.expiresAt > now) {
    return hit.dek;
  }
  const ciphertext = Buffer.from(ciphertextB64, 'base64');
  const dek = await getKms().decryptDataKey(userId, ciphertext);
  // 简单 LRU:满了清最早的
  if (dekCache.size >= CACHE_CAPACITY) {
    const firstKey = dekCache.keys().next().value;
    if (firstKey !== undefined) dekCache.delete(firstKey);
  }
  dekCache.set(userId, { dek, expiresAt: now + CACHE_TTL_MS });
  return dek;
}

export function evictDekFromCache(userId: string): void {
  dekCache.delete(userId);
}

export function clearDekCacheForTesting(): void {
  dekCache.clear();
}

/**
 * 加密任意 JSON-serializable 对象
 * 输出格式:base64( iv(12) || tag(16) || ciphertext )
 */
export async function encryptField(userId: string, dekCiphertextB64: string, plainObj: unknown): Promise<string> {
  const dek = await getDek(userId, dekCiphertextB64);
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', dek, iv);
  const plain = Buffer.from(JSON.stringify(plainObj), 'utf8');
  const enc = Buffer.concat([cipher.update(plain), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, enc]).toString('base64');
}

export async function decryptField<T = unknown>(userId: string, dekCiphertextB64: string, ciphertextB64: string): Promise<T> {
  const dek = await getDek(userId, dekCiphertextB64);
  const buf = Buffer.from(ciphertextB64, 'base64');
  const iv = buf.subarray(0, 12);
  const tag = buf.subarray(12, 28);
  const enc = buf.subarray(28);
  const decipher = createDecipheriv('aes-256-gcm', dek, iv);
  decipher.setAuthTag(tag);
  const plain = Buffer.concat([decipher.update(enc), decipher.final()]);
  return JSON.parse(plain.toString('utf8')) as T;
}
