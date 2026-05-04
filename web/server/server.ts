/**
 * 进程入口
 *
 * 启动顺序:
 *   1. 加载并校验配置(失败 → 进程退出)— plan U2 测试场景:数据库连接失败启动健康检查报错 + 退出码 1
 *   2. 运行 idempotent migrations(失败 → 进程退出)
 *   3. 构建 Fastify 应用并 listen
 *
 * 优雅关闭:SIGINT / SIGTERM 触发 close,排空请求 + 关闭 DB pool。
 */

import { buildApp } from './app';
import { getConfig } from './config';
import { closePool, pingDb } from './db/client';
import { runMigrations } from './db/migrate';

async function main(): Promise<void> {
  const config = getConfig();

  // 启动期 DB 健康检查 — 失败立即退出
  const ping = await pingDb();
  if (!ping.ok) {
    // eslint-disable-next-line no-console
    console.error('[Yanyan] DB health check failed at startup:', ping.error);
    process.exit(1);
  }

  // Idempotent migrations
  await runMigrations();

  const app = await buildApp({ logger: config.NODE_ENV !== 'test' });

  await app.listen({ host: config.HOST, port: config.PORT });

  const shutdown = async (signal: string): Promise<void> => {
    // eslint-disable-next-line no-console
    console.log(`[Yanyan] received ${signal}, shutting down...`);
    await app.close();
    await closePool();
    process.exit(0);
  };
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

if (require.main === module) {
  main().catch((err) => {
    // eslint-disable-next-line no-console
    console.error('[Yanyan] fatal startup error:', err);
    process.exit(1);
  });
}
