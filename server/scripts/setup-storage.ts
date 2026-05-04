/**
 * 一次性 Storage 初始化:创建 buckets + 策略 SQL 已在 migration 里管
 *
 * 用法:
 *   cd server
 *   vercel env pull .env.local --scope=jiamizhongshifus-projects
 *   npx ts-node scripts/setup-storage.ts
 *   rm .env.local
 */

import { readFileSync } from 'fs';
import { join } from 'path';
import { createClient } from '@supabase/supabase-js';

const BUCKETS = [
  {
    id: 'food-photos',
    name: 'food-photos',
    description: '食物拍照(私有,服务端识别用 service-role 读)',
    fileSizeLimit: 10 * 1024 * 1024, // 10MB
    allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']
  },
  {
    id: 'profile-pdf',
    name: 'profile-pdf',
    description: 'Day 30 体质档案 PDF(私有,短期签名 URL 分享)',
    fileSizeLimit: 20 * 1024 * 1024,
    allowedMimeTypes: ['application/pdf']
  }
];

async function main(): Promise<void> {
  const env: Record<string, string> = {};
  readFileSync(join(__dirname, '..', '.env.local'), 'utf8')
    .split('\n')
    .forEach((l) => {
      const m = l.match(/^([A-Z_]+)="?(.*?)"?$/);
      if (m) env[m[1]] = m[2];
    });

  const url = env.SUPABASE_URL;
  const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) throw new Error('缺 SUPABASE_URL / SERVICE_ROLE_KEY');
  const sb = createClient(url, serviceKey, { auth: { persistSession: false } });

  // 列已有 buckets
  const { data: existing, error: listErr } = await sb.storage.listBuckets();
  if (listErr) throw new Error('list failed: ' + listErr.message);
  const existingIds = new Set((existing ?? []).map((b) => b.id));
  console.log('existing buckets:', [...existingIds].join(', ') || '(none)');

  for (const b of BUCKETS) {
    if (existingIds.has(b.id)) {
      // 更新 metadata(idempotent)
      const { error } = await sb.storage.updateBucket(b.id, {
        public: false,
        fileSizeLimit: b.fileSizeLimit,
        allowedMimeTypes: b.allowedMimeTypes
      });
      console.log(`  [update] ${b.id}:`, error ? 'ERR ' + error.message : 'ok');
    } else {
      const { error } = await sb.storage.createBucket(b.id, {
        public: false,
        fileSizeLimit: b.fileSizeLimit,
        allowedMimeTypes: b.allowedMimeTypes
      });
      console.log(`  [create] ${b.id}:`, error ? 'ERR ' + error.message : 'ok');
    }
  }

  // 验证最终状态
  const { data: final } = await sb.storage.listBuckets();
  console.log('\nfinal buckets:');
  for (const b of final ?? []) {
    console.log(`  - ${b.id}  public=${b.public}  size_limit=${b.file_size_limit}`);
  }
  console.log('\nNOTE: RLS 策略由 migration 应用(20260505000000_storage_policies.sql)。');
}

main().catch((e) => {
  console.error('setup failed:', e);
  process.exit(1);
});
