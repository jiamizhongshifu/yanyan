/**
 * 站内配图统一拼 Supabase Storage 公开 URL
 *
 * 这些图存在 Supabase `app-assets` bucket(public read),不打进前端 bundle,
 * 用 URL 加载,可不重建前端就直接换图。
 *
 * URL 解析顺序:
 *   1. 构建时 VITE_SUPABASE_URL(Vercel env)
 *   2. 运行时 fallback 到硬编码的项目 URL — 防止旧 SW 缓存了无 env 的构建
 *      把图片回退成 /filename(public/ 下早已删除,会 404)
 *
 * Supabase 项目 URL 不是 secret(anon key 也是公开的),硬编码安全。
 */

const FALLBACK_SUPABASE_URL = 'https://nohbruohklqfmwjrsrlg.supabase.co';
const ASSETS_BUCKET = 'app-assets';

const SUPABASE_URL = (
  import.meta.env.VITE_SUPABASE_URL ||
  FALLBACK_SUPABASE_URL
).replace(/\/$/, '');

/**
 * 拿一张应用配图 URL。
 * @example
 *   asset('landing-hero.png') → https://<ref>.supabase.co/storage/v1/object/public/app-assets/landing-hero.png
 */
export function asset(filename: string): string {
  return `${SUPABASE_URL}/storage/v1/object/public/${ASSETS_BUCKET}/${filename}`;
}
