/**
 * LLM 食物识别输出类型
 */

export interface RecognizedItem {
  /** 食物 canonical name(应能匹配 food_classifications.food_canonical_name) */
  name: string;
  /** 模型自信度,0..1 */
  confidence: number;
}

export interface RecognitionResult {
  items: RecognizedItem[];
  modelVersion: string;
  /** 整张照片的整体置信度;低于阈值时提示用户补拍 */
  overallConfidence: number;
  /** 调用耗时 ms,用于观测豆包 vs Qwen-VL 性能差 */
  latencyMs: number;
}

/** 低置信阈值(plan U6 verification) */
export const LOW_CONFIDENCE_THRESHOLD = 0.6;
