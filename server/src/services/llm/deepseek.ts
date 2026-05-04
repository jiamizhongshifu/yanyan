/**
 * DeepSeek 客户端 — 项目核心 LLM 文本接入
 *
 * 用途:
 *   - 食物分类派生(U5 LlmDeriver 的真实实现)
 *   - 推荐生成(U13a 今日避开 X、Y、Z + 推荐 3 餐)
 *   - PDF 摘要 / 发物清单的自然语言解释(U13b)
 *   - 用户意图理解 / 文案优化(后续)
 *
 * 不用于:
 *   - 食物拍照识别(视觉模型,走豆包/Qwen-VL)
 *
 * 接入点:DeepSeek 暴露 Anthropic 兼容 API(BASE_URL=https://api.deepseek.com/anthropic)
 * 真实调用在 ce-work 阶段补 SDK 集成;此文件仅提供单例 client 工厂 + interface 占位。
 *
 * 安全:API key 仅从 process.env 读取,**永远不写入代码或 git**
 */

import { getConfig } from '../../config';

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

/**
 * 真实 DeepSeek 客户端 — ce-work 阶段实施
 *
 * 实现要点:
 *   - fetch BASE_URL/v1/messages 走 Anthropic 兼容 schema
 *   - header: x-api-key + anthropic-version
 *   - timeout 30s + 一次重试
 *   - 解析 content[0].text → string
 */
export class DeepSeekTextClient implements LlmTextClient {
  readonly modelVersion: string;

  constructor(private apiKey: string, private baseUrl: string, model: string) {
    if (!apiKey) throw new Error('DeepSeek apiKey 缺失');
    this.modelVersion = model;
  }

  async complete(_req: ChatCompletionRequest): Promise<ChatCompletionResponse> {
    throw new Error(
      'DeepSeekTextClient.complete 待 ce-work 阶段接入 — Anthropic compatible SDK 调用 ' +
        this.baseUrl
    );
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
