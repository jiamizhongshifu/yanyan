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
  { local: 'body-activity.png', remote: 'body-activity.png', contentType: 'image/png' },
  // 第二批:页面 hero / 空状态插画
  { local: 'login-hero.png', remote: 'login-hero.png', contentType: 'image/png' },
  { local: 'onboarding-path.png', remote: 'onboarding-path.png', contentType: 'image/png' },
  { local: 'onboarding-mirror.png', remote: 'onboarding-mirror.png', contentType: 'image/png' },
  { local: 'onboarding-seedling.png', remote: 'onboarding-seedling.png', contentType: 'image/png' },
  { local: 'camera-tabletop.png', remote: 'camera-tabletop.png', contentType: 'image/png' },
  { local: 'findings-hourglass.png', remote: 'findings-hourglass.png', contentType: 'image/png' },
  // 第三批:Body / MealResult / Quiz 配图
  { local: 'body-hero.png', remote: 'body-hero.png', contentType: 'image/png' },
  { local: 'meal-analysis.png', remote: 'meal-analysis.png', contentType: 'image/png' },
  { local: 'quiz-lifestyle.png', remote: 'quiz-lifestyle.png', contentType: 'image/png' },
  // 第四批:mascot 表情扩展
  { local: 'mascot-happy.png', remote: 'mascot-happy.png', contentType: 'image/png' },
  { local: 'mascot-cheer.png', remote: 'mascot-cheer.png', contentType: 'image/png' },
  { local: 'mascot-content.png', remote: 'mascot-content.png', contentType: 'image/png' },
  { local: 'mascot-pensive.png', remote: 'mascot-pensive.png', contentType: 'image/png' },
  { local: 'mascot-caring.png', remote: 'mascot-caring.png', contentType: 'image/png' },
  { local: 'mascot-worried.png', remote: 'mascot-worried.png', contentType: 'image/png' },
  { local: 'mascot-thinking.png', remote: 'mascot-thinking.png', contentType: 'image/png' },
  // 第五批:糖分等价勋章 sticker(替代 emoji)
  { local: 'badge-lollipop.png', remote: 'badge-lollipop.png', contentType: 'image/png' },
  { local: 'badge-cola.png', remote: 'badge-cola.png', contentType: 'image/png' },
  { local: 'badge-milktea.png', remote: 'badge-milktea.png', contentType: 'image/png' },
  { local: 'badge-chocolate.png', remote: 'badge-chocolate.png', contentType: 'image/png' },
  // 第六批:Landing 三步流程
  { local: 'landing-step-photo.png', remote: 'landing-step-photo.png', contentType: 'image/png' },
  { local: 'landing-step-checkin.png', remote: 'landing-step-checkin.png', contentType: 'image/png' },
  { local: 'landing-step-archive.png', remote: 'landing-step-archive.png', contentType: 'image/png' },
  // 第七批
  { local: 'quiz-result-hero.png', remote: 'quiz-result-hero.png', contentType: 'image/png' },
  { local: 'install-banner.png', remote: 'install-banner.png', contentType: 'image/png' },
  // 第八批:streak 条迷你等级图标(28×28 显示,144 输出)
  { local: 'streak-ping.png', remote: 'streak-ping.png', contentType: 'image/png' },
  { local: 'streak-weihuo.png', remote: 'streak-weihuo.png', contentType: 'image/png' },
  { local: 'streak-zhonghuo.png', remote: 'streak-zhonghuo.png', contentType: 'image/png' },
  { local: 'streak-dahuo.png', remote: 'streak-dahuo.png', contentType: 'image/png' },
  // 第九批:Soak 品牌 + 成就勋章
  { local: 'soak-wordmark.png', remote: 'soak-wordmark.png', contentType: 'image/png' },
  { local: 'soak-emblem.png', remote: 'soak-emblem.png', contentType: 'image/png' },
  { local: 'achievement-week-streak.png', remote: 'achievement-week-streak.png', contentType: 'image/png' },
  { local: 'achievement-trend-unlock.png', remote: 'achievement-trend-unlock.png', contentType: 'image/png' },
  { local: 'achievement-month-archive.png', remote: 'achievement-month-archive.png', contentType: 'image/png' },
  { local: 'achievement-sugar-master.png', remote: 'achievement-sugar-master.png', contentType: 'image/png' },
  // 第十批:日历视图统一橘子图标
  { local: 'orange-filled.png', remote: 'orange-filled.png', contentType: 'image/png' },
  { local: 'orange-outline.png', remote: 'orange-outline.png', contentType: 'image/png' },
  // 第八批:次晨打卡 3 步配图
  { local: 'checkin-blind.png', remote: 'checkin-blind.png', contentType: 'image/png' },
  { local: 'checkin-compare.png', remote: 'checkin-compare.png', contentType: 'image/png' },
  { local: 'checkin-reveal.png', remote: 'checkin-reveal.png', contentType: 'image/png' }
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
