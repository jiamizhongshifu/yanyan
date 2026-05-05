/**
 * LLM 食物识别输出类型
 */

export interface RecognizedItem {
  /** 食物 canonical name(应能匹配 food_classifications.food_canonical_name) */
  name: string;
  /** 模型自信度,0..1 */
  confidence: number;
  /**
   * 模型估算的本条目添加糖克数(自由糖,不含天然糖)。null = 模型不确定。
   * 用作 fallback:当 food_classifications.findByName 命中时优先用 DB 典型值;
   * 没命中时回落到这里,确保未入库食物也能拿到糖分估值。
   */
  addedSugarGEstimate?: number | null;
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
