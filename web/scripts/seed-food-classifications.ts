/**
 * 一次性 seed 脚本 — 食物分类引擎库初始化(Phase 2 数据)
 *
 * 设计:用 Supabase JS client (HTTPS REST,service-role) 入库,绕开本地 pg pooler 网络问题。
 * 流程:
 *   1. fixture seed(30 个 hand-curated)— 直接 upsert
 *   2. LLM-derived seed(~100 个常见中餐名)— 真实 DeepSeek 派生 → 高置信入库,低置信打印 review 队列
 *
 * 用法:
 *   cd server
 *   vercel env pull .env.local --scope=jiamizhongshifus-projects
 *   npx ts-node scripts/seed-food-classifications.ts
 *   rm .env.local
 *
 * 重跑 idempotent(upsert by food_canonical_name UNIQUE)
 */

import { readFileSync } from 'fs';
import { join } from 'path';
import { createClient } from '@supabase/supabase-js';
import { RealLlmDeriver, HUMAN_REVIEW_CONFIDENCE_THRESHOLD } from '../server/services/classifier/llm-deriver';
import { DeepSeekTextClient } from '../server/services/llm/deepseek';
import type { Citation, FoodSeed } from '../server/services/classifier/types';

const ADDITIONAL_FOODS: string[] = [
  // 主食
  '小米粥', '燕麦粥', '面条', '馒头', '包子', '饺子', '馄饨', '米粉', '凉面', '八宝粥',
  '玉米饼', '红薯', '紫薯', '荞麦面', '黑米饭',
  // 蔬菜
  '白菜', '菠菜', '油菜', '韭菜', '青椒', '茄子', '西红柿', '黄瓜', '莴笋', '萝卜',
  '胡萝卜', '山药', '莲藕', '香菇', '木耳',
  // 海带 / 海鲜
  '海带', '紫菜', '苦瓜', '冬瓜', '南瓜', '芹菜', '空心菜', '生菜',
  // 肉类
  '红烧肉', '排骨', '牛肉', '羊肉', '鸡肉', '鸡翅', '鸭肉', '鸡蛋', '鸭蛋', '火腿',
  '香肠', '培根', '猪肝', '鹅肉', '兔肉',
  // 水产
  '红烧鲫鱼', '三文鱼', '带鱼', '黄鱼', '虾', '螃蟹', '蛤蜊', '鱿鱼', '海参', '鳗鱼',
  '生蚝', '基围虾',
  // 豆制品
  '豆腐', '豆浆', '豆腐脑', '豆腐皮', '腐乳', '毛豆', '豆芽',
  // 水果
  '苹果', '梨', '香蕉', '橙子', '橘子', '葡萄', '西瓜', '哈密瓜', '草莓', '蓝莓',
  '樱桃', '桃子', '芒果',
  // 热性 / 油炸 / 麻辣
  '麻辣火锅', '麻婆豆腐', '宫保鸡丁', '油炸食品', '烧烤', '油条', '炸鸡', '薯条',
  '辣椒', '花椒', '大蒜', '生姜', '荔枝', '龙眼', '榴莲'
];

const FIXTURE_PATH = join(__dirname, '..', 'data', 'seed-foods', 'v1.json');
const CONCURRENCY = 5;

interface FoodInsert {
  food_canonical_name: string;
  tcm_label: string;
  tcm_property: string;
  dii_score: number | null;
  ages_score: number | null;
  gi: number | null;
  added_sugar_g: number | null;
  carbs_g: number | null;
  citations: Citation[];
  source_versions: Record<string, string>;
}

async function main(): Promise<void> {
  // 加载 .env.local
  const envFile = join(__dirname, '..', '.env.local');
  const raw = readFileSync(envFile, 'utf8');
  const env: Record<string, string> = {};
  raw.split('\n').forEach((line) => {
    const m = line.match(/^([A-Z_]+)="?(.*?)"?$/);
    if (m) env[m[1]] = m[2];
  });

  const supabaseUrl = env.SUPABASE_URL;
  const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;
  const deepseekKey = env.DEEPSEEK_API_KEY;
  const deepseekBase = env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com/anthropic';
  const deepseekModel = env.DEEPSEEK_MODEL || 'deepseek-v4-pro';
  if (!supabaseUrl || !serviceKey) throw new Error('缺 SUPABASE_URL / SERVICE_ROLE_KEY');
  if (!deepseekKey) throw new Error('缺 DEEPSEEK_API_KEY');

  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false }
  });

  // 验证连接
  const ping = await supabase.from('food_classifications').select('id', { count: 'exact', head: true });
  if (ping.error) {
    throw new Error('连接失败: ' + ping.error.message);
  }
  console.log('[seed] Supabase connected. existing count:', ping.count ?? 0);

  // ─── Phase 1: hand-curated fixture ───
  console.log('\n=== Phase 1: hand-curated fixture (30) ===');
  const fixture = JSON.parse(readFileSync(FIXTURE_PATH, 'utf8')) as FoodSeed[];
  console.log('fixture count:', fixture.length);

  let fixtureInserted = 0;
  for (const f of fixture) {
    const row: FoodInsert = {
      food_canonical_name: f.foodCanonicalName,
      tcm_label: f.tcmLabel,
      tcm_property: f.tcmProperty,
      dii_score: f.diiScore ?? null,
      ages_score: f.agesScore ?? null,
      gi: f.gi ?? null,
      added_sugar_g: f.addedSugarG ?? null,
      carbs_g: f.carbsG ?? null,
      citations: f.citations,
      source_versions: { canon: 'v1-curated', humanReviewedAt: new Date().toISOString() }
    };
    const { error } = await supabase
      .from('food_classifications')
      .upsert(row, { onConflict: 'food_canonical_name' });
    if (error) {
      console.error('  ERR', f.foodCanonicalName, ':', error.message);
    } else {
      fixtureInserted++;
    }
  }
  console.log('fixture inserted:', fixtureInserted);

  // ─── Phase 2: LLM-derived ───
  console.log('\n=== Phase 2: LLM-derived (~100 foods) ===');
  const llmClient = new DeepSeekTextClient(deepseekKey, deepseekBase, deepseekModel);
  const deriver = new RealLlmDeriver(llmClient);
  console.log('total:', ADDITIONAL_FOODS.length, ', concurrency:', CONCURRENCY);

  let llmInserted = 0;
  let llmSkipped = 0;
  const needsReview: string[] = [];
  const errors: Array<{ food: string; error: string }> = [];

  // 简单并发 batch
  for (let i = 0; i < ADDITIONAL_FOODS.length; i += CONCURRENCY) {
    const batch = ADDITIONAL_FOODS.slice(i, i + CONCURRENCY);
    process.stdout.write(`  ${i + 1}-${i + batch.length}/${ADDITIONAL_FOODS.length}... `);
    const results = await Promise.all(
      batch.map(async (name) => {
        try {
          // 检查是否已存在
          const { data } = await supabase
            .from('food_classifications')
            .select('id')
            .eq('food_canonical_name', name)
            .limit(1);
          if (data && data.length > 0) return { name, kind: 'skipped' as const };

          const derived = await deriver.derive(name);
          if (!derived) return { name, kind: 'error' as const, error: 'llm_no_result' };
          if (derived.confidence < HUMAN_REVIEW_CONFIDENCE_THRESHOLD) {
            return { name, kind: 'review' as const };
          }
          const row: FoodInsert = {
            food_canonical_name: name,
            tcm_label: derived.tcmLabel,
            tcm_property: derived.tcmProperty,
            dii_score: null,
            ages_score: null,
            gi: null,
            added_sugar_g: null,
            carbs_g: null,
            citations: derived.citations,
            source_versions: { llmModel: derived.modelVersion }
          };
          const { error } = await supabase
            .from('food_classifications')
            .upsert(row, { onConflict: 'food_canonical_name' });
          if (error) return { name, kind: 'error' as const, error: error.message };
          return { name, kind: 'inserted' as const, label: derived.tcmLabel };
        } catch (e) {
          return { name, kind: 'error' as const, error: e instanceof Error ? e.message : String(e) };
        }
      })
    );

    let bIns = 0, bSk = 0, bRev = 0, bErr = 0;
    for (const r of results) {
      if (r.kind === 'inserted') {
        llmInserted++;
        bIns++;
      } else if (r.kind === 'skipped') {
        llmSkipped++;
        bSk++;
      } else if (r.kind === 'review') {
        needsReview.push(r.name);
        bRev++;
      } else {
        errors.push({ food: r.name, error: r.error });
        bErr++;
      }
    }
    process.stdout.write(`+${bIns} =${bSk} ?${bRev} !${bErr}\n`);
  }

  console.log('\n=== Summary ===');
  console.log('  fixture inserted:', fixtureInserted, '/ 30');
  console.log('  LLM inserted    :', llmInserted, '/', ADDITIONAL_FOODS.length);
  console.log('  LLM skipped(已存在):', llmSkipped);
  console.log('  LLM needsReview :', needsReview.length);
  if (needsReview.length) console.log('    ' + needsReview.join(', '));
  console.log('  LLM errors      :', errors.length);
  if (errors.length) {
    for (const e of errors.slice(0, 5)) console.log('    -', e.food, ':', e.error);
  }
  const final = await supabase.from('food_classifications').select('id', { count: 'exact', head: true });
  console.log('\n  final total in DB:', final.count ?? 'unknown');
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('\nseed failed:', err);
    process.exit(1);
  });
