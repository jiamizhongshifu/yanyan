/**
 * Supabase Storage 抽象
 *
 * 替代之前 plan 提到的"阿里云 OSS"占位。
 * 三个 bucket(由 supabase migration 建立):
 *   food-photos  食物照片(私有)
 *   profile-pdf  Day 30 体质档案 PDF(私有,短期签名 URL 分享)
 *
 * 目前只实施基础 upload/getSignedUrl;后续 unit 按需扩展(U6 拍照接 food-photos,U13b PDF 接 profile-pdf)
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { getConfig } from '../config';

let cached: SupabaseClient | null = null;

function getServiceClient(): SupabaseClient {
  if (cached) return cached;
  const cfg = getConfig();
  if (!cfg.SUPABASE_URL || !cfg.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('Supabase Storage 需要 SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY');
  }
  cached = createClient(cfg.SUPABASE_URL, cfg.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false }
  });
  return cached;
}

export function resetStorageForTesting(): void {
  cached = null;
}

export interface StoragePath {
  bucket: string;
  /** OSS 内部 key,绑定 userId 前缀防越权,例如 users/<userId>/<mealId>/<timestamp>.jpg */
  key: string;
}

/**
 * 把对象上传到指定 bucket
 * 调用方负责按 userId 前缀生成 key
 */
export async function uploadObject(
  path: StoragePath,
  data: ArrayBuffer | Uint8Array | Buffer,
  contentType: string
): Promise<void> {
  const client = getServiceClient();
  const { error } = await client.storage.from(path.bucket).upload(path.key, data, {
    contentType,
    upsert: false
  });
  if (error) throw new Error(`storage_upload_failed: ${error.message}`);
}

/**
 * 给客户端生成短期签名 URL(默认 5 分钟,与 plan U6 一致)
 */
export async function getSignedUrl(path: StoragePath, ttlSeconds = 300): Promise<string> {
  const client = getServiceClient();
  const { data, error } = await client.storage.from(path.bucket).createSignedUrl(path.key, ttlSeconds);
  if (error || !data) throw new Error(`storage_sign_failed: ${error?.message ?? 'unknown'}`);
  return data.signedUrl;
}

/**
 * 删除对象 — 用户撤回同意 / 注销账号时清理用户的全部 photos
 * 调用方传 prefix(例如 users/<userId>/),不能传通配,删整个用户范围
 */
export async function deleteUserPrefix(bucket: string, userPrefix: string): Promise<void> {
  if (!userPrefix.startsWith('users/')) {
    throw new Error('安全检查:userPrefix 必须以 users/ 开头');
  }
  const client = getServiceClient();
  const { data: listed, error: listErr } = await client.storage.from(bucket).list(userPrefix, { limit: 1000 });
  if (listErr) throw new Error(`storage_list_failed: ${listErr.message}`);
  if (!listed || listed.length === 0) return;
  const keys = listed.map((f) => `${userPrefix}${f.name}`);
  const { error: delErr } = await client.storage.from(bucket).remove(keys);
  if (delErr) throw new Error(`storage_delete_failed: ${delErr.message}`);
}
