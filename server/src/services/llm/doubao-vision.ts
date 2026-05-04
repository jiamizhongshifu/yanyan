/**
 * 豆包多模态视觉 client (Phase 2 U8)
 *
 * 用于食物拍照识别 — 输入 Supabase Storage key,输出 RecognitionResult。
 *
 * 当前状态:DOUBAO_VISION_API_KEY 未配齐,实例化即抛 — 上层走 DevLlmFoodRecognizer fallback。
 * 实际接入要 ce-work 阶段做:
 *   1. 拿火山引擎控制台开通 + 真实 endpoint 与 model id
 *   2. Supabase service-role download 图片 → base64
 *   3. 调火山方舟 Vision API(content type: image_url / base64)
 *   4. parse JSON 输出 → RecognizedItem[]
 *   5. fallback 到 Qwen-VL(同样未配齐)
 *
 * 当前实现先做接口契约 + 真实失败路径(让 phase 2 ce-work 上线时不再翻代码)。
 */

import type { LlmFoodRecognizer } from '../recognition/llm-recognizer';
import type { RecognitionResult } from '../recognition/types';
import { LlmCallError } from './deepseek';

export interface DoubaoVisionConfig {
  apiKey: string;
  endpoint: string;
  model: string;
}

export class DoubaoVisionClient implements LlmFoodRecognizer {
  readonly modelVersion: string;

  constructor(private cfg: DoubaoVisionConfig) {
    if (!cfg.apiKey) throw new Error('DOUBAO_VISION_API_KEY 缺失');
    this.modelVersion = cfg.model;
  }

  async recognize(_storageKey: string): Promise<RecognitionResult | null> {
    // Phase 2 ce-work 阶段实施 — 见文件头注释。
    throw new LlmCallError(
      'unknown',
      'DoubaoVisionClient.recognize 待 DOUBAO_VISION_API_KEY 配齐 + 火山引擎 endpoint 锁定后实施'
    );
  }
}

/** Qwen-VL fallback 同样占位 */
export class QwenVisionClient implements LlmFoodRecognizer {
  readonly modelVersion = 'qwen-vl-max-2026';
  async recognize(_storageKey: string): Promise<RecognitionResult | null> {
    throw new LlmCallError(
      'unknown',
      'QwenVisionClient 待 QWEN_VL_API_KEY 配齐 + DashScope endpoint 锁定后实施'
    );
  }
}
