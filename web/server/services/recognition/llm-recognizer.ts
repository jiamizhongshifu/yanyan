/**
 * LLM 食物识别器抽象
 *
 * 输入:Supabase Storage key(server 通过 service role 拉图,转 base64,送 LLM)
 * 输出:RecognitionResult(食物条目 + 置信度 + 模型版本)
 *
 * v1 用 DevLlmFoodRecognizer(fixture map),不依赖外部 LLM API。
 * 生产 ce-work 阶段实施 DoubaoFoodRecognizer / QwenVLFoodRecognizer。
 */

import type { RecognitionResult } from './types';

export interface LlmFoodRecognizer {
  /**
   * @param storageKey  Supabase Storage 的对象 key,应以 users/<userId>/ 开头
   * @returns 识别结果或 null(LLM 失败)
   */
  recognize(storageKey: string): Promise<RecognitionResult | null>;
  readonly modelVersion: string;
}

/**
 * Dev / 测试用:基于 fixture map 直接返回结果,不实际下载图片
 */
export class DevLlmFoodRecognizer implements LlmFoodRecognizer {
  readonly modelVersion = 'dev-fixture-v1';
  private fixtures = new Map<string, RecognitionResult>();

  add(storageKey: string, result: Omit<RecognitionResult, 'modelVersion'>): void {
    this.fixtures.set(storageKey, { ...result, modelVersion: this.modelVersion });
  }

  /** 也支持按食物名字串匹配(用于 hedged router 测试场景) */
  addByContains(substring: string, result: Omit<RecognitionResult, 'modelVersion'>): void {
    this.fixtures.set(`contains:${substring}`, { ...result, modelVersion: this.modelVersion });
  }

  async recognize(storageKey: string): Promise<RecognitionResult | null> {
    const exact = this.fixtures.get(storageKey);
    if (exact) return exact;
    for (const [k, v] of this.fixtures.entries()) {
      if (k.startsWith('contains:') && storageKey.includes(k.slice('contains:'.length))) {
        return v;
      }
    }
    return null;
  }
}

/** 占位 — ce-work 阶段实施(豆包多模态 SDK) */
export class DoubaoFoodRecognizer implements LlmFoodRecognizer {
  readonly modelVersion = 'doubao-multimodal-v1';
  async recognize(_storageKey: string): Promise<RecognitionResult | null> {
    throw new Error('DoubaoFoodRecognizer 待 ce-work 阶段接入豆包多模态 SDK + Supabase Storage download');
  }
}

/** 占位 — Qwen-VL */
export class QwenVLFoodRecognizer implements LlmFoodRecognizer {
  readonly modelVersion = 'qwen-vl-v1';
  async recognize(_storageKey: string): Promise<RecognitionResult | null> {
    throw new Error('QwenVLFoodRecognizer 待 ce-work 阶段接入');
  }
}
