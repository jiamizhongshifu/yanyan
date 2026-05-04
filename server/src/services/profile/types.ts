/**
 * Day 30 体质档案 v0.5 类型 (plan U13b)
 *
 * 命名占位 R26:UI / 文件名都用「30 天体质档案 v0.5」,Phase 2 替换为
 * Bayesian 个体回归版后再正式命名。
 *
 * 不含个体化 — 仅 30 天 Yan-Score 趋势 + 30 天饮食发条目聚合 +
 * 群体先验"常见发物"+ 体检 OCR 占位 + 免责声明。
 */

import type { Citation } from '../classifier';

export const PROFILE_WINDOW_DAYS = 30;

export interface DailyFirePoint {
  /** YYYY-MM-DD */
  date: string;
  /** 当日餐食 fireScore 平均值;无餐食 = null */
  avgFireScore: number | null;
  /** 当日餐食条数 */
  mealCount: number;
}

export interface FaCounts {
  /** 30 天累计的"发"条目总数 */
  faTotal: number;
  /** 温和 */
  mildTotal: number;
  /** 平 */
  calmTotal: number;
  /** 未识别 */
  unknownTotal: number;
}

export interface CommonFaFood {
  name: string;
  citations: Citation[];
}

export interface ProfileV05Data {
  /** 用户累计打卡天数(必须 >= 30 才允许生成) */
  cumulativeCheckinDays: number;
  /** 文档命名占位 — 后续替换 */
  title: string;
  /** ISO,生成时点 */
  generatedAt: string;
  /** 30 天 Yan-Score 每日趋势点 */
  dailyTrend: DailyFirePoint[];
  /** 30 天饮食"发/温和/平/未识别"汇总(用于趋势图右侧统计盒) */
  faCounts: FaCounts;
  /** 群体先验 — 与你近期情况类似的人群常见的发物(实际上 v0.5 直接取库内"发"top-N) */
  commonFaFoods: CommonFaFood[];
  /** 体检报告 OCR 摘要(v1 未实现 → 永远 null,UI 显示"未上传"占位) */
  checkupSummary: null;
  /** 免责声明分项(R20 未扣除混杂列表 + 通用医疗免责) */
  disclaimers: string[];
}
