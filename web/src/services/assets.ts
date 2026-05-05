/**
 * 站内配图统一拼 Supabase Storage 公开 URL
 *
 * 这些图存在 Supabase `app-assets` bucket(public read),不打进前端 bundle,
 * 用 URL 加载,可不重建前端就直接换图。
 *
 * Phase 1+ 唯一权威 base = VITE_SUPABASE_URL,失败时降级到本地 /public/(向后兼容)
 */

const SUPABASE_URL = (import.meta.env.VITE_SUPABASE_URL ?? '').replace(/\/$/, '');
const ASSETS_BUCKET = 'app-assets';

/**
 * 拿一张应用配图 URL。
 * @example
 *   asset('landing-hero.png') → https://<ref>.supabase.co/storage/v1/object/public/app-assets/landing-hero.png
 */
export function asset(filename: string): string {
  if (!SUPABASE_URL) {
    // dev / 测试环境 VITE_SUPABASE_URL 未配 → 退回 /public/
    return `/${filename}`;
  }
  return `${SUPABASE_URL}/storage/v1/object/public/${ASSETS_BUCKET}/${filename}`;
}
