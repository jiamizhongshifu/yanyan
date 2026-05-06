/**
 * Supabase REST 版 UserStore — 绕过 pg.Pool(避免 DATABASE_URL 鉴权问题)
 *
 * 用 service_role_key 通过 PostgREST 调用 users 表。
 * 适用于 Vercel functions 上 pg pooler 鉴权失败的场景。
 *
 * 限制:
 *   - findByOpenid 仍由 pg 实现(不在 ensureUser 路径)
 *   - updateBaseline 走 REST PATCH
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { getConfig } from '../../config';
import type { UserRow, UserStore } from './store';
import type { OnboardingBaseline } from './types';

interface DbUserRow {
  id: string;
  wx_openid: string;
  consent_version_granted: number;
  baseline_summary: Record<string, unknown>;
  deleted_at: string | null;
}

let cachedClient: SupabaseClient | null = null;
function getClient(): SupabaseClient {
  if (cachedClient) return cachedClient;
  const cfg = getConfig();
  if (!cfg.SUPABASE_URL || !cfg.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('SupabaseRestUserStore 需要 SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY');
  }
  cachedClient = createClient(cfg.SUPABASE_URL, cfg.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false }
  });
  return cachedClient;
}

function rowToUser(r: DbUserRow): UserRow {
  return {
    id: r.id,
    wxOpenid: r.wx_openid,
    consentVersionGranted: r.consent_version_granted,
    baselineSummary: r.baseline_summary,
    deletedAt: r.deleted_at ? new Date(r.deleted_at) : null
  };
}

export class SupabaseRestUserStore implements UserStore {
  async findByOpenid(openid: string): Promise<UserRow | null> {
    const c = getClient();
    const { data, error } = await c
      .from('users')
      .select('id, wx_openid, consent_version_granted, baseline_summary, deleted_at')
      .eq('wx_openid', openid)
      .is('deleted_at', null)
      .maybeSingle();
    if (error) throw new Error(`SupabaseRestUserStore.findByOpenid: ${error.message}`);
    return data ? rowToUser(data as DbUserRow) : null;
  }

  async findById(id: string): Promise<UserRow | null> {
    const c = getClient();
    const { data, error } = await c
      .from('users')
      .select('id, wx_openid, consent_version_granted, baseline_summary, deleted_at')
      .eq('id', id)
      .is('deleted_at', null)
      .maybeSingle();
    if (error) throw new Error(`SupabaseRestUserStore.findById: ${error.message}`);
    return data ? rowToUser(data as DbUserRow) : null;
  }

  async createUser(_params: { wxOpenid: string; dekCiphertextB64: string }): Promise<string> {
    throw new Error('createUser(wechat path) deprecated — 用 createUserById 走 Supabase Auth path');
  }

  async createUserById(params: { id: string; dekCiphertextB64: string }): Promise<void> {
    const c = getClient();
    const { error } = await c.from('users').upsert(
      {
        id: params.id,
        wx_openid: `supabase:${params.id}`,
        dek_ciphertext_b64: params.dekCiphertextB64
      },
      { onConflict: 'id', ignoreDuplicates: true }
    );
    if (error) throw new Error(`SupabaseRestUserStore.createUserById: ${error.message}`);
  }

  async updateBaseline(userId: string, baseline: OnboardingBaseline): Promise<void> {
    const c = getClient();
    const { error } = await c
      .from('users')
      .update({ baseline_summary: baseline, updated_at: new Date().toISOString() })
      .eq('id', userId);
    if (error) throw new Error(`SupabaseRestUserStore.updateBaseline: ${error.message}`);
  }

  async getCachedRecommendation(userId: string, date: string): Promise<unknown | null> {
    const c = getClient();
    const { data, error } = await c
      .from('users')
      .select('latest_recommendation, latest_recommendation_date')
      .eq('id', userId)
      .is('deleted_at', null)
      .maybeSingle();
    if (error) throw new Error(`SupabaseRestUserStore.getCachedRecommendation: ${error.message}`);
    if (!data) return null;
    const row = data as { latest_recommendation: unknown; latest_recommendation_date: string | null };
    if (row.latest_recommendation_date !== date) return null;
    return row.latest_recommendation ?? null;
  }

  async setCachedRecommendation(userId: string, date: string, payload: unknown): Promise<void> {
    const c = getClient();
    const { error } = await c
      .from('users')
      .update({
        latest_recommendation: payload,
        latest_recommendation_date: date,
        updated_at: new Date().toISOString()
      })
      .eq('id', userId);
    if (error) throw new Error(`SupabaseRestUserStore.setCachedRecommendation: ${error.message}`);
  }
}
