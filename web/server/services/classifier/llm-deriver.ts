/**
 * LLM 派生器 — 把食物名 → {tcm_label, tcm_property, citations[]} 派生输出
 *
 * v1 用 DevLlmDeriver(本地 fixture map),不依赖外部 API。
 * 生产切 DoubaoLlmDeriver / QwenVLLlmDeriver(豆包多模态文本端 / 阿里通义千问 VL),
 * 在 ce-work 阶段做 200-500 张中餐评估集 + 准确度 A/B 测试后选定主用 + 备选。
 *
 * **重要:LLM 派生只是流水线一环;输出还要经人工 spot check(典籍引用核对),
 * 然后才进 food_classifications 表。U5 v1 实施只到"派生器接口 + 入库流程"层。**
 */

import type { Citation, TcmLabel, TcmProperty } from './types';
import type { LlmTextClient } from '../llm/deepseek';
import { LlmCallError } from '../llm/deepseek';

export interface LlmDerivation {
  tcmLabel: TcmLabel;
  tcmProperty: TcmProperty;
  citations: Citation[];
  /** 模型自报的置信度,< 0.6 视为低置信,需要人工 review 才入库 */
  confidence: number;
  modelVersion: string;
}

export interface LlmDeriver {
  derive(foodName: string): Promise<LlmDerivation | null>;
}

/**
 * Dev / 测试用派生器:基于 fixture map 直接返回。
 * 维护一个小的高频食物到分类的映射,方便测试和早期开发。
 */
export class DevLlmDeriver implements LlmDeriver {
  constructor(private fixtures: Record<string, LlmDerivation> = {}) {}

  add(name: string, derivation: LlmDerivation): void {
    this.fixtures[name] = derivation;
  }

  async derive(foodName: string): Promise<LlmDerivation | null> {
    return this.fixtures[foodName] ?? null;
  }
}

/**
 * Phase 2 U8 真实派生器 — 用 DeepSeek(或任意 LlmTextClient)派生食物分类
 *
 * Prompt 设计要求:
 *   - 输出 strict JSON,只含约束字段:tcmLabel / tcmProperty / citations / confidence
 *   - 至少 1 条 citation(典籍引用 — source/reference)
 *   - 不确定时低 confidence,U5 流程会进人工 review 不直接入库(R33)
 */
const DERIVE_SYSTEM_PROMPT = `你是中医食物分类专家。给定一个食物的中文名,你必须输出严格 JSON。

输出 JSON schema(每个字段值必须严格在指定 enum 内):
{
  "tcmLabel": "发" | "温和" | "平",   // 必须是这三个汉字之一
  "tcmProperty": "寒" | "凉" | "平" | "温" | "热",  // 必须是这五个汉字之一,**单个汉字**,不带任何修饰词
  "citations": [{"source": "canon", "reference": "典籍名"}],  // source 只能是 canon/paper/modern_nutrition;reference 是简短名称
  "confidence": 0.0-1.0   // 数字
}

字段定义:
- tcmLabel = 发物分类。"发"=刺激性 / 海鲜 / 辣 / 油炸;"温和"=辛温补益;"平"=主食 / 平和清淡。**必须从这三个值中选一个**,不能写"凉"或"寒"等寒热属性词。
- tcmProperty = 寒热属性。**必须只写一个汉字**(寒/凉/平/温/热),不要写"性凉"也不要写"味甘性凉"或"归肺经"等长描述。

正例(原样照写):
食物:海带
{"tcmLabel":"平","tcmProperty":"凉","citations":[{"source":"canon","reference":"《本草纲目》海菜部"}],"confidence":0.85}

食物:饺子
{"tcmLabel":"平","tcmProperty":"温","citations":[{"source":"canon","reference":"《饮膳正要》"}],"confidence":0.75}

食物:虾
{"tcmLabel":"发","tcmProperty":"温","citations":[{"source":"canon","reference":"《本草纲目》"}],"confidence":0.9}

要求:
1. citations 至少 1 条
2. 不确定时 confidence < 0.6
3. 只输出 JSON,无任何文字 / markdown / 解释 / 代码块`;

const TCM_LABELS_SET = new Set(['发', '温和', '平']);
const TCM_PROPS_SET = new Set(['寒', '凉', '平', '温', '热']);

interface DeriveJsonShape {
  tcmLabel?: string;
  tcmProperty?: string;
  citations?: Array<{ source?: string; reference?: string; excerpt?: string }>;
  confidence?: number;
}

function tryParseJson(content: string): DeriveJsonShape | null {
  // 先剥 markdown code fence(LLM 偶尔不听话)
  const stripped = content
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/```\s*$/i, '')
    .trim();
  try {
    return JSON.parse(stripped) as DeriveJsonShape;
  } catch {
    // 尝试找第一个 { ... } 块
    const m = stripped.match(/\{[\s\S]*\}/);
    if (m) {
      try {
        return JSON.parse(m[0]) as DeriveJsonShape;
      } catch {
        return null;
      }
    }
    return null;
  }
}

/**
 * 真实派生器:接受 LlmTextClient 注入,任何 Anthropic 兼容 client 都能用
 */
export class RealLlmDeriver implements LlmDeriver {
  constructor(private client: LlmTextClient) {}

  async derive(foodName: string): Promise<LlmDerivation | null> {
    const trimmed = foodName.trim();
    if (!trimmed) return null;
    try {
      const res = await this.client.complete({
        system: DERIVE_SYSTEM_PROMPT,
        messages: [{ role: 'user', content: `请为下列食物输出 JSON:${trimmed}` }],
        temperature: 0.1,
        maxTokens: 512
      });
      const json = tryParseJson(res.content);
      if (!json) return null;

      // 严格匹配,不行再做包含子串的宽容匹配(LLM 偶尔加修饰词)
      const tcmLabel = (TCM_LABELS_SET.has(json.tcmLabel as string)
        ? (json.tcmLabel as TcmLabel)
        : extractEnumSubstring(json.tcmLabel, ['发', '温和', '平'])) as TcmLabel | null;
      const tcmProperty = (TCM_PROPS_SET.has(json.tcmProperty as string)
        ? (json.tcmProperty as TcmProperty)
        : extractEnumSubstring(json.tcmProperty, ['寒', '凉', '平', '温', '热'])) as TcmProperty | null;
      if (!tcmLabel || !tcmProperty) return null;

      const citations: Citation[] = (json.citations ?? [])
        .filter((c) => c && typeof c.reference === 'string' && c.reference.length > 0)
        .map((c) => ({
          source: (c.source ?? 'canon') as Citation['source'],
          reference: c.reference!,
          ...(c.excerpt ? { excerpt: c.excerpt } : {})
        }));
      if (citations.length === 0) {
        // 缺典籍引用 → 强制进人工 review(置信度封顶 0.5)
        return {
          tcmLabel,
          tcmProperty,
          citations: [],
          confidence: Math.min(0.5, json.confidence ?? 0.4),
          modelVersion: this.client.modelVersion
        };
      }

      const confidence = clamp01(json.confidence ?? 0.7);
      return { tcmLabel, tcmProperty, citations, confidence, modelVersion: this.client.modelVersion };
    } catch (err) {
      // LlmCallError 或其他 — 统一返回 null,上层走 backfill 队列
      if (err instanceof LlmCallError) {
        // eslint-disable-next-line no-console
        console.warn(`[llm-deriver] ${err.kind}: ${err.message}`);
      }
      return null;
    }
  }
}

function clamp01(n: number): number {
  if (Number.isNaN(n)) return 0;
  return Math.max(0, Math.min(1, n));
}

/** LLM 偶尔写"性凉"/"味甘性凉"等,从字符串里抓到 enum 之一 */
function extractEnumSubstring(value: unknown, candidates: string[]): string | null {
  if (typeof value !== 'string') return null;
  // 优先匹配 多字符 enum(避免"温和"被先匹到"温")
  const sorted = [...candidates].sort((a, b) => b.length - a.length);
  for (const c of sorted) {
    if (value.includes(c)) return c;
  }
  return null;
}

/** 占位 — Qwen-VL 文本端 fallback,key 未配齐前抛出 */
export class QwenVLLlmDeriver implements LlmDeriver {
  async derive(_foodName: string): Promise<LlmDerivation | null> {
    throw new Error('QwenVLLlmDeriver 待 QWEN_VL_API_KEY 配齐后接入');
  }
}

/** 历史名 — 保留向后兼容,内部不实现(豆包文本端不开放) */
export class DoubaoLlmDeriver implements LlmDeriver {
  async derive(_foodName: string): Promise<LlmDerivation | null> {
    throw new Error('DoubaoLlmDeriver 已废弃 — 食物分类派生统一走 RealLlmDeriver(DeepSeek)');
  }
}

/** v1 LLM 置信度低于此值需进人工 review 队列,不直接入库 */
export const HUMAN_REVIEW_CONFIDENCE_THRESHOLD = 0.6;
