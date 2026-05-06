/**
 * 首页 hero 插图选择 — 按本地时段自动切换 4 张
 *
 * 5-9 → 早晨;10-14 → 中午;15-19 → 黄昏;20-4 → 夜晚
 *
 * 资产文件名:`today-hero-{morning|noon|evening|night}.png`,
 * 都已 upsert 到 Supabase app-assets bucket。客户端用 asset() 拼公开 URL。
 */

export type HeroSlot = 'morning' | 'noon' | 'evening' | 'night';

export function heroSlotFor(date = new Date()): HeroSlot {
  const h = date.getHours();
  if (h >= 5 && h < 10) return 'morning';
  if (h >= 10 && h < 15) return 'noon';
  if (h >= 15 && h < 20) return 'evening';
  return 'night';
}

export function todayHeroAsset(date = new Date()): string {
  return `today-hero-${heroSlotFor(date)}.png`;
}
