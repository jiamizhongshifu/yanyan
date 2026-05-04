/**
 * 一次性种子脚本 — 把 data/seed-foods/v1.json 30 个食物入库
 *
 * 使用:
 *   1. cp .env.example .env  且 PG 可连
 *   2. npm run migrate          # 确保 schema 存在
 *   3. npx ts-node scripts/seed-foods.ts
 *
 * 上线后 ce-work 阶段把 v1.json 扩展到 800-1500 食物 + 接 LlmDeriver 派生流水线。
 */

import { closePool } from '../src/db/client';
import { PgFoodClassifierStore, loadFixture, seedFromFixture } from '../src/services/classifier';

async function main(): Promise<void> {
  const fixture = loadFixture();
  // eslint-disable-next-line no-console
  console.log(`[seed-foods] loaded ${fixture.length} foods from fixture`);
  const store = new PgFoodClassifierStore();
  const result = await seedFromFixture({ store }, fixture);
  // eslint-disable-next-line no-console
  console.log('[seed-foods]', JSON.stringify(result, null, 2));
  await closePool();
}

if (require.main === module) {
  main().catch((err) => {
    // eslint-disable-next-line no-console
    console.error('[seed-foods] fatal:', err);
    process.exit(1);
  });
}
