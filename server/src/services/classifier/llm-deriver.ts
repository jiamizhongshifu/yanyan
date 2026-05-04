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
 * 占位 — 生产 ce-work 阶段实现:
 * - 调豆包多模态 SDK / Qwen-VL,prompt 包含典籍 RAG 上下文(canon-excerpts)
 * - 输出强约束 schema(JSON mode)
 * - 重试 + rate limit + 日志归档
 */
export class DoubaoLlmDeriver implements LlmDeriver {
  async derive(_foodName: string): Promise<LlmDerivation | null> {
    throw new Error('DoubaoLlmDeriver 待 ce-work 阶段接入豆包多模态文本端 SDK');
  }
}

export class QwenVLLlmDeriver implements LlmDeriver {
  async derive(_foodName: string): Promise<LlmDerivation | null> {
    throw new Error('QwenVLLlmDeriver 待 ce-work 阶段接入阿里通义千问 VL SDK');
  }
}

/** v1 LLM 置信度低于此值需进人工 review 队列,不直接入库 */
export const HUMAN_REVIEW_CONFIDENCE_THRESHOLD = 0.6;
