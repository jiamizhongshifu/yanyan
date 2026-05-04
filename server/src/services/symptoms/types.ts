/**
 * 次晨打卡 7 维度类型
 *
 * 维度 = users/types.SYMPTOM_DIMENSIONS(共享 enum)
 * 每维度独立的"严重度档位",用整数表示位置(从 1 开始)。0 表示用户未滑动 → 视为"无反应"反向置位(plan Round 2 修订)。
 *
 * definition_version:plan Round 2 修订 — 滑块档位定义升版后,趋势分析仅在同版本数据内绘制,避免历史数据语义漂变。
 */

export {
  SYMPTOM_DIMENSIONS,
  type SymptomDimension
} from '../users/types';

import type { SymptomDimension } from '../users/types';

/** 当前(v1)滑块定义版本 */
export const CURRENT_DEFINITION_VERSION = 1;

/** 各维度档位数(决定客户端 UI 渲染);ce-work 阶段中医顾问 review 后可调整。 */
export const SYMPTOM_DIMENSION_LEVELS: Record<SymptomDimension, number> = {
  nasal_congestion: 4, // 轻度 / 一鼻塞 / 双鼻塞 / 完全堵
  acne: 4,             // 零星 / 几颗 / 多颗 / 大面积
  dry_mouth: 4,        // 微干 / 想喝水 / 嘴唇干裂 / 舌苔厚
  bowel: 5,            // 正常 / 偏稀 / 偏硬 / 黏腻 / 腹泻
  fatigue: 4,          // 良好 / 一般 / 困倦 / 极度疲惫
  edema: 4,            // 无 / 眼袋 / 面部 / 全身
  throat_itch: 4       // 无 / 偶尔 / 持续 / 痛
};

/**
 * 单个维度的打卡条目
 *
 * Round 2 修订规则:
 *   - engaged=false:用户没勾选,视为"无反应"
 *   - engaged=true + severity=null:用户勾选了但没滑动 → 视为"无反应"反向置位(default-effect 防御)
 *   - engaged=true + severity=N (N≥1):有效程度
 */
export interface SymptomDimensionEntry {
  engaged: boolean;
  severity: number | null;
}

/** Step 1 盲打卡的完整提交 */
export type SymptomCheckinPayload = Partial<Record<SymptomDimension, SymptomDimensionEntry>>;

export type CheckinSource = 'next_morning' | 'onboarding';

/**
 * 计算"有效响应"的维度数 — 用于 Yan-Score SymptomPart(U8 消费)
 *
 * 有效响应 = engaged=true 且 severity ≥ 1。
 * engaged=true 但 severity=null 的视为无效(防 default-effect)。
 */
export function effectiveSeverityMap(payload: SymptomCheckinPayload): Partial<Record<SymptomDimension, number>> {
  const out: Partial<Record<SymptomDimension, number>> = {};
  for (const [dim, entry] of Object.entries(payload)) {
    if (!entry) continue;
    if (entry.engaged && entry.severity != null && entry.severity >= 1) {
      out[dim as SymptomDimension] = entry.severity;
    }
  }
  return out;
}
