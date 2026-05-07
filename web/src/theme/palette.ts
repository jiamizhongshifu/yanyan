/**
 * 单一色值真相源 — 给 SVG 组件、动态样式等"无法走 tailwind"的地方用。
 *
 * ⚠️ 与 tailwind.config.cjs 的 colors.* 必须同步。改色时两处都改。
 *    tailwind 拿 hex 字面量是出于 PostCSS 编译期需求,无法 runtime require TS。
 */

// 主色
export const PAPER = '#F7F4EE';
export const INK = '#2A2A2A';

// 火分 4 档(对应 tailwind fire-ping/mild/mid/high)
export const FIRE_PING = '#4A8B6F'; // 平 — 深绿
export const FIRE_PING_LIGHT = '#7BA56A'; // 平 → 微火 过渡用浅绿
export const FIRE_MILD = '#C9A227'; // 微火 — 黄
export const FIRE_MID = '#D9762C'; // 中火 — 橘
export const FIRE_HIGH = '#B43A30'; // 大火 — 红

// 中性补充(图表辅助线 / tick label / 描边)
export const INK_RING = '#E8E3D8'; // 仪表盘背景弧 / 大型空圈
export const INK_GRID = '#0001'; // 图表虚线网格(11% 黑)
export const INK_AXIS = '#0006'; // 坐标轴标签(40% 黑)
export const INK_TICK = '#0007'; // 时间刻度文字(47% 黑)
export const INK_SOLID = '#222222'; // 图表数据点描边

// 装饰
export const STAR_GOLD = '#F4C242';
export const FLAME_HIGHLIGHT = '#FFEFB0';

/** 给 SVG fill / stroke 直接用的别名(可读性更好) */
export const palette = {
  paper: PAPER,
  ink: INK,
  firePing: FIRE_PING,
  firePingLight: FIRE_PING_LIGHT,
  fireMild: FIRE_MILD,
  fireMid: FIRE_MID,
  fireHigh: FIRE_HIGH,
  inkRing: INK_RING,
  inkGrid: INK_GRID,
  inkAxis: INK_AXIS,
  inkTick: INK_TICK,
  inkSolid: INK_SOLID,
  starGold: STAR_GOLD,
  flameHighlight: FLAME_HIGHLIGHT
} as const;
