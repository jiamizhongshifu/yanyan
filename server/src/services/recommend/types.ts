/**
 * 今日推荐类型 (plan U13a)
 *
 * 群体维度:基于近 3 日 tcm_labels_summary 聚合 + food_classifications 反向查
 * 不做个体化(那在 Phase 2 Bayesian 回归)
 */

import type { Citation } from '../classifier';

export type RecommendMode =
  | 'fa_heavy' // 近 3 日"发"类多 → 给避开列表
  | 'mild_balanced' // 温和 / 平居多 → 鼓励 + 推荐继续
  | 'all_calm' // 全部"平" → 继续保持
  | 'insufficient_data'; // 数据不足(< 1 天)

export interface AvoidItem {
  name: string;
  citations: Citation[];
}

export interface MealOption {
  /** 早 / 午 / 晚 */
  slot: 'breakfast' | 'lunch' | 'dinner';
  /** 食材列表(3-4 项) */
  items: string[];
  /** 至少一条典籍引用(用于 UI 展示) */
  citations: Citation[];
}

export interface TodayRecommendation {
  mode: RecommendMode;
  /** 给用户的一句话标题(UI title 区) */
  headline: string;
  /** 鼓励 / 解释文案(insufficient_data 用通用模板) */
  tagline: string;
  /** 今日避开(2-4 项),fa_heavy 模式才有内容 */
  avoid: AvoidItem[];
  /** 推荐 3 餐(早 / 午 / 晚) */
  meals: MealOption[];
  /** 内部审计字段 — 当时聚合的 3 日发/温和/平 计数 */
  basis: { fa: number; mild: number; calm: number; days: number };
}
