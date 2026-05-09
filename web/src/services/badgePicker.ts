/**
 * 多形状勋章 — 等级 + 日期 → 具体 shape
 *
 * 等级靠形状递进(不再靠颜色),同一等级有 3 种 shape 池子,
 * 按日期 hash 选,同一天稳定显示同一形状,跨天有变化。
 *
 * Tier 映射:
 *   - nice (★2)    糖果池:candy / lollipop / cookie
 *   - great (★3-4) 汽水池:soda / chocolate / icecream
 *   - perfect (★5) 太阳池:sun / star / crown
 *
 * 'none' 不在本模块处理,由调用方 gate(渲染 orange fallback)。
 */

export type Tier = 'nice' | 'great' | 'perfect';

export type BadgeShape =
  // nice 池(小奖励 — 小零食)
  | 'candy'
  | 'lollipop'
  | 'cookie'
  // great 池(中奖励 — 饮品 / 甜点)
  | 'soda'
  | 'chocolate'
  | 'icecream'
  // perfect 池(大奖励 — 庆祝餐 / 大份食物)
  | 'cake'
  | 'sushi'
  | 'pizza';

export const POOL: Record<Tier, readonly BadgeShape[]> = {
  nice: ['candy', 'lollipop', 'cookie'] as const,
  great: ['soda', 'chocolate', 'icecream'] as const,
  perfect: ['cake', 'sushi', 'pizza'] as const
};

/**
 * 把 ISO 日期串(YYYY-MM-DD)+ tier 算成 shape。
 * 字符 charCode 累加 → mod 池大小。同一天稳定,跨天变化。
 */
export function pickShape(dateISO: string, tier: Tier): BadgeShape {
  const sum = dateISO.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
  const pool = POOL[tier];
  return pool[sum % pool.length];
}

/** Shape → 它属于哪个 tier(用于 sprite 大小决策) */
export function tierOfShape(shape: BadgeShape): Tier {
  if (POOL.nice.includes(shape)) return 'nice';
  if (POOL.great.includes(shape)) return 'great';
  return 'perfect';
}
