/**
 * 食物分类引擎类型
 *
 * 双层数据(plan U5):
 *   - 中医层:tcm_label / tcm_property + 典籍引用 — v1 前端唯一渲染层
 *   - 西方营养层:DII / AGEs / GI 连续值 — v1 前端不展示,Phase 2 算法 + Phase 3 出海预留
 *
 * source_versions 记录每个字段来源(典籍版次、LLM 模型版本、人工审核轮次),
 * 便于后续 v2 顾问委员会接入时做版本对比。
 */

export const TCM_LABELS = ['发', '温和', '平'] as const;
export type TcmLabel = (typeof TCM_LABELS)[number];

export const TCM_PROPERTIES = ['寒', '凉', '平', '温', '热'] as const;
export type TcmProperty = (typeof TCM_PROPERTIES)[number];

export interface Citation {
  /** 来源类型:典籍 / 论文 / 现代营养学 */
  source: 'canon' | 'paper' | 'modern_nutrition';
  /** 引用文献名(如「《本草纲目》」、「DII 2014」) */
  reference: string;
  /** 节选片段(法务清理后) */
  excerpt?: string;
}

export interface FoodClassification {
  id: string;
  foodCanonicalName: string;
  // 中医层
  tcmLabel: TcmLabel;
  tcmProperty: TcmProperty;
  // 西方营养层
  diiScore: number | null;
  agesScore: number | null; // kU/serving
  gi: number | null;
  // 引用 + 版本
  citations: Citation[];
  sourceVersions: {
    canon?: string;
    llmModel?: string;
    humanReviewedAt?: string;
  };
}

/** 种子数据格式(seed-foods/v1.json 的形态) */
export interface FoodSeed {
  foodCanonicalName: string;
  tcmLabel: TcmLabel;
  tcmProperty: TcmProperty;
  diiScore?: number;
  agesScore?: number;
  gi?: number;
  citations: Citation[];
}
