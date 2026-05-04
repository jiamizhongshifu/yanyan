/**
 * DeepSeek 客户端 — 项目核心 LLM 文本接入(Phase 2 U8 真实实现)
 *
 * 用途:
 *   - 食物分类派生(LlmDeriver 真实实现走 RealDeepSeekDeriver)
 *   - 推荐生成 / PDF 摘要 / 发物清单解释 / 用户意图理解
 *
 * 不用于:食物拍照识别(视觉模型,走豆包 / Qwen-VL)
 *
 * 接入:DeepSeek 暴露 Anthropic 兼容 API(POST {base}/v1/messages)
 * 安全:API key 仅 process.env,**绝不进 git**
 *
 * Phase 2 U8 升级:
 *   - DeepSeekTextClient.complete() 真实 fetch + 重试 + 超时
 *   - 每次调用回调 cost-monitor 累计 token
 *   - 失败抛 LlmCallError(分类:rate_limit / timeout / unauthorized / server / unknown)
 */

import { getConfig } from '../../config';
import { recordTokenUsage, type TokenUsage } from './cost-monitor';

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface ChatCompletionRequest {
  messages: ChatMessage[];
  /** Anthropic 风格的 system prompt(优先于 messages 里的 system role) */
  system?: string;
  temperature?: number;
  maxTokens?: number;
  /** 强制 JSON 输出(由 prompt + parsing 保证;DeepSeek 暂无 JSON mode) */
  jsonMode?: boolean;
}

export interface ChatCompletionResponse {
  content: string;
  modelVersion: string;
  /** 调用耗时 ms,供 hedged router / 观测使用 */
  latencyMs: number;
}

export interface LlmTextClient {
  complete(req: ChatCompletionRequest): Promise<ChatCompletionResponse>;
  readonly modelVersion: string;
}

export type LlmErrorKind =
  | 'rate_limit'
  | 'timeout'
  | 'unauthorized'
  | 'server'
  | 'budget_exceeded'
  | 'unknown';

export class LlmCallError extends Error {
  constructor(public kind: LlmErrorKind, message: string, public httpStatus?: number) {
    super(message);
    this.name = 'LlmCallError';
  }
}

interface AnthropicMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface AnthropicResponse {
  content: Array<{ type: string; text?: string; thinking?: string }>;
  model: string;
  usage: { input_tokens: number; output_tokens: number };
}

const DEFAULT_TIMEOUT_MS = 30_000;
const RETRY_BACKOFF_MS = [500, 1500];

/**
 * 真实 DeepSeek 文本 client — Anthropic 兼容 API
 */
export class DeepSeekTextClient implements LlmTextClient {
  readonly modelVersion: string;

  constructor(
    private apiKey: string,
    private baseUrl: string,
    model: string,
    private fetchImpl: typeof fetch = fetch
  ) {
    if (!apiKey) throw new Error('DeepSeek apiKey 缺失');
    this.modelVersion = model;
  }

  async complete(req: ChatCompletionRequest): Promise<ChatCompletionResponse> {
    const start = Date.now();
    const url = `${this.baseUrl.replace(/\/$/, '')}/v1/messages`;

    // 转 Anthropic schema:role=system 提取到顶层 system 字段;只保留 user/assistant
    const messages: AnthropicMessage[] = req.messages
      .filter((m) => m.role !== 'system')
      .map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content }));
    const system = req.system ?? req.messages.find((m) => m.role === 'system')?.content;

    const body = {
      model: this.modelVersion,
      max_tokens: req.maxTokens ?? 2048,
      temperature: req.temperature ?? 0.2,
      ...(system ? { system } : {}),
      messages
    };

    let lastErr: LlmCallError | null = null;
    // 1 次主调 + 2 次重试(rate_limit / 5xx 才重试)
    for (let attempt = 0; attempt < 3; attempt++) {
      if (attempt > 0) {
        await new Promise((r) => setTimeout(r, RETRY_BACKOFF_MS[attempt - 1]));
      }
      try {
        const res = await this.callOnce(url, body);
        const latencyMs = Date.now() - start;
        const usage: TokenUsage = {
          model: this.modelVersion,
          inputTokens: res.usage.input_tokens,
          outputTokens: res.usage.output_tokens
        };
        recordTokenUsage(usage);
        // content array 可能含 thinking + text 块;只拼 type=text 的内容
        const text = res.content
          .filter((c) => c.type === 'text' && typeof c.text === 'string')
          .map((c) => c.text)
          .join('\n');
        return {
          content: text,
          modelVersion: res.model || this.modelVersion,
          latencyMs
        };
      } catch (err) {
        lastErr = err instanceof LlmCallError ? err : new LlmCallError('unknown', String(err));
        // 不重试的错误
        if (lastErr.kind === 'unauthorized' || lastErr.kind === 'budget_exceeded') break;
        if (lastErr.kind !== 'rate_limit' && lastErr.kind !== 'server' && lastErr.kind !== 'timeout') break;
      }
    }
    throw lastErr ?? new LlmCallError('unknown', 'DeepSeek 调用失败');
  }

  private async callOnce(url: string, body: unknown): Promise<AnthropicResponse> {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), DEFAULT_TIMEOUT_MS);
    try {
      const res = await this.fetchImpl(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': this.apiKey,
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify(body),
        signal: ctrl.signal
      });
      if (res.status === 401 || res.status === 403) {
        throw new LlmCallError('unauthorized', 'DeepSeek 鉴权失败,检查 API key', res.status);
      }
      if (res.status === 429) {
        throw new LlmCallError('rate_limit', 'DeepSeek rate limit', res.status);
      }
      if (res.status >= 500) {
        throw new LlmCallError('server', `DeepSeek 5xx ${res.status}`, res.status);
      }
      if (!res.ok) {
        throw new LlmCallError('unknown', `DeepSeek HTTP ${res.status}`, res.status);
      }
      return (await res.json()) as AnthropicResponse;
    } catch (err) {
      if (err instanceof LlmCallError) throw err;
      if ((err as Error).name === 'AbortError') {
        throw new LlmCallError('timeout', `DeepSeek timeout > ${DEFAULT_TIMEOUT_MS}ms`);
      }
      throw new LlmCallError('unknown', String(err));
    } finally {
      clearTimeout(timer);
    }
  }
}

/** Dev / 测试用 stub — fixture map 输入 prompt → 输出 */
export class DevTextClient implements LlmTextClient {
  readonly modelVersion = 'dev-text-v1';
  private fixtures: Array<{ contains: string; output: string }> = [];

  add(contains: string, output: string): void {
    this.fixtures.push({ contains, output });
  }

  async complete(req: ChatCompletionRequest): Promise<ChatCompletionResponse> {
    const userText = req.messages.find((m) => m.role === 'user')?.content ?? '';
    const hit = this.fixtures.find((f) => userText.includes(f.contains));
    return {
      content: hit?.output ?? '{}',
      modelVersion: this.modelVersion,
      latencyMs: 0
    };
  }
}

let cached: LlmTextClient | null = null;

/**
 * 拿默认文本 LLM client。
 *   - 生产:DEEPSEEK_API_KEY 配置时 → DeepSeekTextClient
 *   - 否则:DevTextClient(测试 / 本地占位)
 */
export function getTextClient(): LlmTextClient {
  if (cached) return cached;
  const cfg = getConfig();
  if (cfg.DEEPSEEK_API_KEY) {
    cached = new DeepSeekTextClient(cfg.DEEPSEEK_API_KEY, cfg.DEEPSEEK_BASE_URL, cfg.DEEPSEEK_MODEL);
  } else {
    cached = new DevTextClient();
  }
  return cached;
}

export function resetTextClientForTesting(): void {
  cached = null;
}
