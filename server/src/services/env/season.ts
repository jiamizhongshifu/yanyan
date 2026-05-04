/**
 * 季节判定(纯函数)
 *
 * 简化:北半球 GB/T 2260 通用约定
 *   3-5 月 春 / 6-8 月 夏 / 9-11 月 秋 / 12-2 月 冬
 *
 * 春秋为发物高发期(plan U8 EnvPart 中 +20)。
 *
 * 不考虑南半球 / 跨时区 — v1 用户限定中国大陆 + 海外华人(plan Scope Boundary 写明)。
 */

import type { Season } from './types';

export function seasonForDate(date: Date = new Date()): Season {
  const m = date.getUTCMonth() + 1; // 1-12
  if (m >= 3 && m <= 5) return 'spring';
  if (m >= 6 && m <= 8) return 'summer';
  if (m >= 9 && m <= 11) return 'autumn';
  return 'winter';
}
