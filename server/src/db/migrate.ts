/**
 * 数据库 schema 迁移
 *
 * v1 简单做法:每次启动时 idempotent 地执行 schema.sql(全 IF NOT EXISTS)。
 * Phase 2+ 接入正式迁移工具(node-pg-migrate / Prisma Migrate)做 versioned migration。
 */

import { readFileSync } from 'fs';
import { join } from 'path';
import { withClient } from './client';

export async function runMigrations(): Promise<void> {
  const schemaPath = join(__dirname, 'schema.sql');
  const schemaSql = readFileSync(schemaPath, 'utf8');
  await withClient(async (client) => {
    await client.query(schemaSql);
  });
}

if (require.main === module) {
  runMigrations()
    .then(() => {
      // eslint-disable-next-line no-console
      console.log('Migrations applied.');
      process.exit(0);
    })
    .catch((err) => {
      // eslint-disable-next-line no-console
      console.error('Migration failed:', err);
      process.exit(1);
    });
}
