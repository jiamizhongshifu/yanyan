/**
 * 服务配置
 *
 * 启动时校验环境变量,缺失或非法立即报错(对应 plan U2 测试场景:
 * 数据库连接失败 → 启动健康检查报错 + 进程退出码 1)。
 *
 * Pivot 后(2026-05-04):增加 Supabase 配置组(Auth / Storage / 直连 PG)。
 */

import { z } from 'zod';

const ConfigSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().nonnegative().default(3000),
  HOST: z.string().default('0.0.0.0'),

  // 数据库:Supabase Postgres URL,必须含 ?sslmode=require
  DATABASE_URL: z.string().or(z.string().startsWith('postgres')),

  // Supabase
  SUPABASE_URL: z.string().url().optional(),
  SUPABASE_ANON_KEY: z.string().optional(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().optional(),
  // JWT 密钥用于校验客户端 Authorization: Bearer <jwt>
  SUPABASE_JWT_SECRET: z.string().optional(),

  // Storage buckets
  SUPABASE_STORAGE_FOOD_BUCKET: z.string().default('food-photos'),
  SUPABASE_STORAGE_PDF_BUCKET: z.string().default('profile-pdf'),

  // ─── LLM 接入(post-pivot 项目核心 agent 用 DeepSeek) ───
  // DeepSeek 用于:文本类 LLM 任务(食物分类派生 / 推荐生成 / PDF 摘要 / 发物清单解释等)
  // 视觉类(食物拍照识别)仍走豆包多模态 / Qwen-VL — DeepSeek-VL 待 ce-work 阶段评估
  DEEPSEEK_API_KEY: z.string().optional(),
  DEEPSEEK_BASE_URL: z.string().url().default('https://api.deepseek.com/anthropic'),
  DEEPSEEK_MODEL: z.string().default('deepseek-v4-pro'),

  // Phase 2 U8:LLM cost monitor 预算 + 飞书告警
  LLM_DAILY_BUDGET_USD: z.coerce.number().nonnegative().default(50),
  LLM_MONTHLY_BUDGET_USD: z.coerce.number().nonnegative().default(1000),
  FEISHU_WEBHOOK_URL: z.string().url().optional(),

  // 视觉端(阿里云百炼 DashScope = Qwen-VL;Phase 2 U8 真实接入)
  DASHSCOPE_API_KEY: z.string().optional(),
  DASHSCOPE_VISION_MODEL: z.string().default('qwen-vl-max-latest'),
  // 豆包(火山引擎)key 未配齐时走 stub
  DOUBAO_VISION_API_KEY: z.string().optional(),
  DOUBAO_VISION_ENDPOINT: z.string().url().default('https://ark.cn-beijing.volces.com/api/v3/chat/completions'),
  DOUBAO_VISION_MODEL: z.string().default('doubao-vision-pro-32k'),

  // KMS:本地 dev/test 用 LocalKmsStub;生产 PMF 后迁阿里云 KMS
  KMS_MODE: z.enum(['local', 'vault', 'aliyun']).default('local'),
  KMS_LOCAL_MASTER_KEY: z.string().regex(/^[0-9a-f]{64}$/i, '必须是 64 位十六进制(代表 32 字节 AES-256 主密钥)').optional(),
  KMS_KEY_ID: z.string().optional()
});

export type Config = z.infer<typeof ConfigSchema>;

let cached: Config | null = null;

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const parsed = ConfigSchema.safeParse(env);
  if (!parsed.success) {
    throw new Error('Config validation failed:\n' + JSON.stringify(parsed.error.format(), null, 2));
  }
  const c = parsed.data;
  if (c.KMS_MODE === 'local' && !c.KMS_LOCAL_MASTER_KEY) {
    throw new Error('KMS_MODE=local 时必须设置 KMS_LOCAL_MASTER_KEY');
  }
  if (c.KMS_MODE === 'vault') {
    if (!c.SUPABASE_URL || !c.SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error('KMS_MODE=vault 时必须设置 SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY');
    }
    // KMS_LOCAL_MASTER_KEY 仍可保留(用于兼容 0x00 旧 envelope 的 reader);production 应清掉新 envelope 写入
  }
  if (c.KMS_MODE === 'aliyun' && !c.KMS_KEY_ID) {
    throw new Error('KMS_MODE=aliyun 时必须设置 KMS_KEY_ID');
  }
  // 生产环境必须配置 Supabase JWT secret(校验客户端鉴权)
  if (c.NODE_ENV === 'production' && !c.SUPABASE_JWT_SECRET) {
    throw new Error('NODE_ENV=production 时必须设置 SUPABASE_JWT_SECRET');
  }
  return c;
}

export function getConfig(): Config {
  if (!cached) {
    cached = loadConfig();
  }
  return cached;
}

export function resetConfigForTesting(): void {
  cached = null;
}
