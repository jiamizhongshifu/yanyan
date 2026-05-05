/**
 * 一次性脚本:上传 web/public/ 内的内容图(非 PWA icon)到 Supabase Storage app-assets 桶
 *
 * 用法:
 *   cd web
 *   vercel env pull .env.local --scope=jiamizhongshifus-projects
 *   npx ts-node scripts/setup-storage.ts        # 确保 app-assets bucket 存在
 *   npx ts-node scripts/upload-app-assets.ts
 *   rm .env.local
 *
 * idempotent — upsert 模式,可重跑(每次会覆盖同名文件)
 */

import { readFileSync } from 'fs';
import { join } from 'path';
import { createClient } from '@supabase/supabase-js';

// 内容图(搬到 Supabase),非 PWA icon
const ASSETS = [
  { local: 'landing-hero.png', remote: 'landing-hero.png', contentType: 'image/png' },
  { local: 'level-scale.png', remote: 'level-scale.png', contentType: 'image/png' },
  { local: 'level-ping.png', remote: 'level-ping.png', contentType: 'image/png' },
  { local: 'level-weihuo.png', remote: 'level-weihuo.png', contentType: 'image/png' },
  { local: 'level-zhonghuo.png', remote: 'level-zhonghuo.png', contentType: 'image/png' },
  { local: 'level-dahuo.png', remote: 'level-dahuo.png', contentType: 'image/png' },
  // gpt-image-2 生成的新插画(2026-05-05 batch)
  { local: 'today-hero.png', remote: 'today-hero.png', contentType: 'image/png' },
  { local: 'achievement-jar.png', remote: 'achievement-jar.png', contentType: 'image/png' },
  { local: 'achievement-unlock.png', remote: 'achievement-unlock.png', contentType: 'image/png' },
  { local: 'body-food.png', remote: 'body-food.png', contentType: 'image/png' },
  { local: 'body-symptom.png', remote: 'body-symptom.png', contentType: 'image/png' },
  { local: 'body-env.png', remote: 'body-env.png', contentType: 'image/png' },
  { local: 'body-activity.png', remote: 'body-activity.png', contentType: 'image/png' }
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

  const publicBase = `${url}/storage/v1/object/public/app-assets`;
  console.log('Public URL base:', publicBase);
  console.log('Uploading', ASSETS.length, 'assets...\n');

  for (const a of ASSETS) {
    const path = join(__dirname, '..', 'public', a.local);
    let body: Buffer;
    try {
      body = readFileSync(path);
    } catch {
      console.log(`  [skip] ${a.local}: not found locally`);
      continue;
    }
    const { error } = await sb.storage.from('app-assets').upload(a.remote, body, {
      contentType: a.contentType,
      upsert: true,
      cacheControl: '31536000' // 1 year — 配图基本不变,immutable
    });
    if (error) {
      console.log(`  [ERR ] ${a.remote}: ${error.message}`);
    } else {
      console.log(`  [ok  ] ${a.remote}  ${(body.length / 1024).toFixed(0)}KB`);
      console.log(`         ${publicBase}/${a.remote}`);
    }
  }

  console.log('\nDONE. 前端用 services/assets.ts 的 asset() helper 拼 URL 读取');
}

main().catch((e) => {
  console.error('upload failed:', e);
  process.exit(1);
});
