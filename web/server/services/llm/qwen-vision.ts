/**
 * Qwen-VL 视觉 client (Phase 2 U8 vision 端真实实施)
 *
 * 通过阿里云百炼 DashScope OpenAI 兼容端点调 qwen-vl-max-latest 做食物拍照识别。
 *
 * 流程:
 *   1. 从 Supabase Storage(service-role)下载图片为 Buffer
 *   2. base64 编码 → 走 OpenAI image_url data URL 格式
 *   3. POST chat/completions(强约束 JSON 输出,prompt 限制只识别食物条目)
 *   4. 解析 JSON → RecognizedItem[]
 *
 * 配置:
 *   - DASHSCOPE_API_KEY(阿里云百炼 API key)
 *   - DASHSCOPE_VISION_MODEL(默认 qwen-vl-max-latest)
 *
 * 失败行为:LlmCallError(rate_limit / unauthorized / server / timeout / unknown)
 *   上层 HedgedFoodRecognizer 多模型并行,任一返回非 null 即用。
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { LlmCallError } from './deepseek';
import { recordTokenUsage } from './cost-monitor';
import type { LlmFoodRecognizer } from '../recognition/llm-recognizer';
import type { RecognitionResult, RecognizedItem } from '../recognition/types';
import { getConfig } from '../../config';

const VISION_ENDPOINT = 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions';
const TIMEOUT_MS = 45_000;
const RETRY_BACKOFF_MS: number[] = []; // 不重试,跨境单次给足时间,失败让用户重拍

const SYSTEM_PROMPT = `你是中餐食物识别 + 添加糖估算专家。给定一张餐桌照片,识别其中所有可见食物条目,
并对每一条估算"典型一份"的添加糖克数(自由糖,不含天然存在于水果 / 牛奶中的糖),
同时列出该条目主料食材(2-6 个 canonical 中文食材名)。

输出严格 JSON,无 markdown 包装:
{
  "items": [
    {
      "name": "<食物中文名,canonical>",
      "confidence": 0.0-1.0,
      "addedSugarG": <number|null>,
      "ingredients": ["<主料1>", "<主料2>", ...]
    }
  ],
  "overallConfidence": 0.0-1.0
}
要求:
1. name 用最常见的菜名(如"清蒸鲈鱼"、"白米饭"、"麻婆豆腐"、"野生菌火锅"),不写品牌或厨师姓名
2. 每个独立菜品 1 条 item;主食和菜分开识别
3. 不可识别 / 模糊 → confidence < 0.6
4. addedSugarG 估算参考(典型一份):
   - 可乐 330ml ≈ 35,奶茶全糖大杯 ≈ 50,加糖酸奶 ≈ 12
   - 蛋糕一份 ≈ 28,巧克力 25g ≈ 12,雪糕一支 ≈ 22,果汁 250ml ≈ 24
   - 大部分中餐主菜(肉/菜/汤)≈ 0–3g(调味少量糖)
   - 红烧 / 糖醋 / 拔丝类 ≈ 5–15g
   - 主食(米饭 / 面条 / 馒头)≈ 0(碳水高但无添加糖)
   - 真不确定 → 用 null,不要瞎猜
5. addedSugarG 单位克(0..200 范围),不写百分比或描述
6. ingredients 列 2-6 个最具代表性的主料(用最常见的食材名,如"猪肉"、"白菜"、"鸡蛋"、"金针菇"、"豆腐"),
   不写调味料(盐/油/酱油/葱姜蒜),不写做法
   - 单一食材直接重复:白米饭 → ingredients = ["白米饭"];煮鸡蛋 → ["鸡蛋"]
7. 整张图整体可信度 → overallConfidence
8. 只 JSON 输出,无其他文字`;

interface ChatChoice {
  message?: { content?: string };
}
interface ChatResponse {
  choices?: ChatChoice[];
  model?: string;
  usage?: { prompt_tokens?: number; completion_tokens?: number };
}

interface ItemsJson {
  items?: Array<{ name?: unknown; confidence?: unknown; addedSugarG?: unknown }>;
  overallConfidence?: unknown;
}

function tryParseJson(content: string): ItemsJson | null {
  const stripped = content
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/```\s*$/i, '')
    .trim();
  try {
    return JSON.parse(stripped) as ItemsJson;
  } catch {
    const m = stripped.match(/\{[\s\S]*\}/);
    if (m) {
      try {
        return JSON.parse(m[0]) as ItemsJson;
      } catch {
        return null;
      }
    }
    return null;
  }
}

function buildSupabaseClient(): SupabaseClient {
  const cfg = getConfig();
  if (!cfg.SUPABASE_URL || !cfg.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('QwenVisionClient 需要 SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY');
  }
  return createClient(cfg.SUPABASE_URL, cfg.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false }
  });
}

export interface QwenVisionConfig {
  apiKey: string;
  model: string;
  endpoint?: string;
  bucket: string;
  /** 注入 fetch 用于测试 */
  fetchImpl?: typeof fetch;
  /** 注入 supabase storage download(测试用) */
  downloadImage?: (storageKey: string) => Promise<Buffer | null>;
}

export class QwenVisionClient implements LlmFoodRecognizer {
  readonly modelVersion: string;
  private fetchImpl: typeof fetch;
  private endpoint: string;
  private downloadImage: (storageKey: string) => Promise<Buffer | null>;

  constructor(private cfg: QwenVisionConfig) {
    if (!cfg.apiKey) throw new Error('DASHSCOPE_API_KEY 缺失');
    this.modelVersion = cfg.model;
    this.fetchImpl = cfg.fetchImpl ?? fetch;
    this.endpoint = cfg.endpoint ?? VISION_ENDPOINT;
    this.downloadImage = cfg.downloadImage ?? this.defaultDownload.bind(this);
  }

  private async defaultDownload(storageKey: string): Promise<Buffer | null> {
    const sb = buildSupabaseClient();
    const { data, error } = await sb.storage.from(this.cfg.bucket).download(storageKey);
    if (error || !data) return null;
    const arrayBuf = await data.arrayBuffer();
    return Buffer.from(arrayBuf);
  }

  async recognize(storageKey: string): Promise<RecognitionResult | null> {
    const start = Date.now();
    const buf = await this.downloadImage(storageKey);
    if (!buf) return null;
    const mime = sniffMime(buf);
    const dataUrl = `data:${mime};base64,${buf.toString('base64')}`;

    const body = {
      model: this.modelVersion,
      max_tokens: 1024,
      temperature: 0.1,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        {
          role: 'user',
          content: [
            { type: 'image_url', image_url: { url: dataUrl } },
            { type: 'text', text: '请识别图中所有食物。' }
          ]
        }
      ]
    };

    let lastErr: LlmCallError | null = null;
    for (let attempt = 0; attempt < 1; attempt++) {
      if (attempt > 0) await new Promise((r) => setTimeout(r, RETRY_BACKOFF_MS[attempt - 1]));
      try {
        const res = await this.callOnce(body);
        const latencyMs = Date.now() - start;
        const content = res.choices?.[0]?.message?.content ?? '';
        const json = tryParseJson(content);
        if (!json || !Array.isArray(json.items)) return null;

        const items: RecognizedItem[] = json.items
          .filter((it) => it && typeof it.name === 'string' && (it.name as string).trim().length > 0)
          .map((it) => ({
            name: (it.name as string).trim(),
            confidence: clamp01(typeof it.confidence === 'number' ? it.confidence : 0.6),
            addedSugarGEstimate: parseSugarG(it.addedSugarG),
            ingredients: Array.isArray(it.ingredients)
              ? (it.ingredients as unknown[])
                  .filter((x): x is string => typeof x === 'string' && x.trim().length > 0)
                  .map((x) => x.trim())
                  .slice(0, 6)
              : undefined
          }));

        const overallConfidence = clamp01(
          typeof json.overallConfidence === 'number' ? json.overallConfidence : 0.6
        );

        if (res.usage) {
          recordTokenUsage({
            model: this.modelVersion,
            inputTokens: res.usage.prompt_tokens ?? 0,
            outputTokens: res.usage.completion_tokens ?? 0
          });
        }

        return {
          items,
          modelVersion: res.model || this.modelVersion,
          overallConfidence,
          latencyMs
        };
      } catch (err) {
        lastErr = err instanceof LlmCallError ? err : new LlmCallError('unknown', String(err));
        if (lastErr.kind === 'unauthorized') break;
        if (lastErr.kind !== 'rate_limit' && lastErr.kind !== 'server' && lastErr.kind !== 'timeout') break;
      }
    }
    if (lastErr) throw lastErr;
    return null;
  }

  private async callOnce(body: unknown): Promise<ChatResponse> {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
    try {
      const res = await this.fetchImpl(this.endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.cfg.apiKey}`
        },
        body: JSON.stringify(body),
        signal: ctrl.signal
      });
      if (res.status === 401 || res.status === 403) {
        throw new LlmCallError('unauthorized', 'DashScope 鉴权失败,检查 DASHSCOPE_API_KEY', res.status);
      }
      if (res.status === 429) throw new LlmCallError('rate_limit', 'DashScope rate limit', res.status);
      if (res.status >= 500) throw new LlmCallError('server', `DashScope 5xx ${res.status}`, res.status);
      if (!res.ok) throw new LlmCallError('unknown', `DashScope HTTP ${res.status}`, res.status);
      return (await res.json()) as ChatResponse;
    } catch (err) {
      if (err instanceof LlmCallError) throw err;
      if ((err as Error).name === 'AbortError') {
        throw new LlmCallError('timeout', `DashScope timeout > ${TIMEOUT_MS}ms`);
      }
      throw new LlmCallError('unknown', String(err));
    } finally {
      clearTimeout(timer);
    }
  }
}

function sniffMime(buf: Buffer): string {
  // PNG: 89 50 4E 47
  if (buf[0] === 0x89 && buf[1] === 0x50) return 'image/png';
  // JPEG: FF D8 FF
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'image/jpeg';
  // WEBP: RIFF...WEBP
  if (buf[0] === 0x52 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x46) return 'image/webp';
  // GIF: GIF8
  if (buf[0] === 0x47 && buf[1] === 0x49 && buf[2] === 0x46) return 'image/gif';
  return 'image/jpeg';
}

function clamp01(n: number): number {
  if (Number.isNaN(n)) return 0;
  return Math.max(0, Math.min(1, n));
}

/** 解析 LLM 返回的 addedSugarG:数字截到 [0,200];null/缺失/非法 → null */
function parseSugarG(raw: unknown): number | null {
  if (raw === null || raw === undefined) return null;
  const n = typeof raw === 'number' ? raw : Number(raw);
  if (!Number.isFinite(n)) return null;
  if (n < 0) return 0;
  if (n > 200) return 200;
  return Math.round(n * 10) / 10;
}

/** 工厂 — 缺 key 返回 null,上层走 DevLlmFoodRecognizer fallback */
export function buildQwenVisionFromEnv(): QwenVisionClient | null {
  const cfg = getConfig();
  if (!cfg.DASHSCOPE_API_KEY) return null;
  return new QwenVisionClient({
    apiKey: cfg.DASHSCOPE_API_KEY,
    model: cfg.DASHSCOPE_VISION_MODEL,
    bucket: cfg.SUPABASE_STORAGE_FOOD_BUCKET
  });
}
