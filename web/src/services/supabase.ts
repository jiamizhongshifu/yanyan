/**
 * Supabase 客户端单例
 *
 * 通过 import.meta.env 注入 URL + anon key(Vercel 环境变量配置)。
 * 默认值仅做开发占位 — 真实部署必须设置 VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY。
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

let cached: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient {
  if (!cached) {
    const url = import.meta.env.VITE_SUPABASE_URL ?? 'https://TODO_REPLACE.supabase.co';
    const anon = import.meta.env.VITE_SUPABASE_ANON_KEY ?? 'TODO_REPLACE';
    cached = createClient(url, anon, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
    });
  }
  return cached;
}

/** 测试用 */
export function resetSupabaseForTesting(): void {
  cached = null;
}
