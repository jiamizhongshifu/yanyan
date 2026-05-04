/**
 * 服务配置
 *
 * 启动时校验环境变量,缺失或非法立即报错(对应 plan U2 测试场景:数据库连接失败 → 启动健康检查报错 + 进程退出码 1)。
 *
 * 设计决策:不在配置层做"默认 fallback",任何缺失都视为部署错误,避免线上偷偷跑在 dev 配置下。
 */

import { z } from 'zod';

const ConfigSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().nonnegative().default(3000), // 0 = 测试时 ephemeral 端口
  HOST: z.string().default('0.0.0.0'),

  DATABASE_URL: z.string().url().or(z.string().startsWith('postgres://')),
  REDIS_URL: z.string().url().or(z.string().startsWith('redis://')).optional(),

  // KMS:本地开发用 LocalKmsStub,生产切换为阿里云 KMS
  KMS_MODE: z.enum(['local', 'aliyun']).default('local'),
  KMS_LOCAL_MASTER_KEY: z.string().regex(/^[0-9a-f]{64}$/i, '必须是 64 位十六进制(代表 32 字节 AES-256 主密钥)').optional(),
  KMS_KEY_ID: z.string().optional(),

  OSS_REGION: z.string().optional(),
  OSS_BUCKET: z.string().optional(),
  OSS_ACCESS_KEY_ID: z.string().optional(),
  OSS_ACCESS_KEY_SECRET: z.string().optional()
});

export type Config = z.infer<typeof ConfigSchema>;

let cached: Config | null = null;

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const parsed = ConfigSchema.safeParse(env);
  if (!parsed.success) {
    throw new Error('Config validation failed:\n' + JSON.stringify(parsed.error.format(), null, 2));
  }
  // KMS 模式与必填项的交叉校验
  const c = parsed.data;
  if (c.KMS_MODE === 'local' && !c.KMS_LOCAL_MASTER_KEY) {
    throw new Error('KMS_MODE=local 时必须设置 KMS_LOCAL_MASTER_KEY');
  }
  if (c.KMS_MODE === 'aliyun' && !c.KMS_KEY_ID) {
    throw new Error('KMS_MODE=aliyun 时必须设置 KMS_KEY_ID');
  }
  return c;
}

export function getConfig(): Config {
  if (!cached) {
    cached = loadConfig();
  }
  return cached;
}

/** 测试用:重置缓存 */
export function resetConfigForTesting(): void {
  cached = null;
}
