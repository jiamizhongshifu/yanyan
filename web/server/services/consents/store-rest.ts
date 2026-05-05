/**
 * Supabase REST 版 ConsentStore — 绕过 pg.Pool
 *
 * 用 service_role 通过 PostgREST 写 privacy_consents + 更新 users.consent_version_granted。
 * 无原生事务支持,顺序写入(REST 失败概率低且 INSERT 幂等性靠 UNIQUE 约束保护)。
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { getConfig } from '../../config';
import type { ConsentStore, UserConsentRow } from './store';
import type { RecordConsentParams } from './types';

let cached: SupabaseClient | null = null;
function getClient(): SupabaseClient {
  if (cached) return cached;
  const cfg = getConfig();
  if (!cfg.SUPABASE_URL || !cfg.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('SupabaseRestConsentStore 需要 SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY');
  }
  cached = createClient(cfg.SUPABASE_URL, cfg.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false }
  });
  return cached;
}

export class SupabaseRestConsentStore implements ConsentStore {
  async recordConsent(params: RecordConsentParams): Promise<void> {
    const c = getClient();
    const rows = params.scopes.map((scope) => ({
      user_id: params.userId,
      scope,
      consent_version: params.consentVersion,
      user_agent: params.userAgent ?? null,
      client_ip_hash: params.clientIpHash ?? null
    }));
    const { error: insErr } = await c.from('privacy_consents').insert(rows);
    if (insErr) throw new Error(`SupabaseRestConsentStore.insert: ${insErr.message}`);

    // 提升 users.consent_version_granted(只增不减,REST 没原生 GREATEST,先读后写)
    const { data: existing } = await c
      .from('users')
      .select('consent_version_granted')
      .eq('id', params.userId)
      .maybeSingle();
    const current = (existing?.consent_version_granted as number | undefined) ?? 0;
    if (params.consentVersion > current) {
      const { error: upErr } = await c
        .from('users')
        .update({ consent_version_granted: params.consentVersion, updated_at: new Date().toISOString() })
        .eq('id', params.userId);
      if (upErr) throw new Error(`SupabaseRestConsentStore.update: ${upErr.message}`);
    }
  }

  async getUserConsentStatus(userId: string): Promise<UserConsentRow | null> {
    const c = getClient();
    const { data, error } = await c
      .from('users')
      .select('id, consent_version_granted, deleted_at')
      .eq('id', userId)
      .maybeSingle();
    if (error) throw new Error(`SupabaseRestConsentStore.findStatus: ${error.message}`);
    if (!data) return null;
    return {
      userId: data.id as string,
      consentVersionGranted: data.consent_version_granted as number,
      deletedAt: data.deleted_at ? new Date(data.deleted_at as string) : null
    };
  }

  async softDeleteUser(userId: string): Promise<void> {
    const c = getClient();
    const { error } = await c
      .from('users')
      .update({ deleted_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq('id', userId);
    if (error) throw new Error(`SupabaseRestConsentStore.softDelete: ${error.message}`);
  }

  async hardDeleteUser(userId: string): Promise<void> {
    const c = getClient();
    // 顺序:子表 → users
    const tables = [
      'analytics_events',
      'inapp_reminders',
      'push_subscriptions',
      'yan_score_daily',
      'symptoms',
      'meals',
      'privacy_consents',
      'user_daily_challenges',
      'user_health_daily',
      'user_achievements'
    ];
    for (const t of tables) {
      const { error } = await c.from(t).delete().eq('user_id', userId);
      if (error && !error.message.includes('not exist')) {
        // eslint-disable-next-line no-console
        console.warn(`hardDelete ${t}: ${error.message}`);
      }
    }
    const { error: usersErr } = await c.from('users').delete().eq('id', userId);
    if (usersErr) throw new Error(`SupabaseRestConsentStore.hardDeleteUsers: ${usersErr.message}`);
  }

  async findUsersForHardDelete(deletedBefore: Date): Promise<string[]> {
    const c = getClient();
    const { data, error } = await c
      .from('users')
      .select('id')
      .not('deleted_at', 'is', null)
      .lt('deleted_at', deletedBefore.toISOString());
    if (error) throw new Error(`SupabaseRestConsentStore.findForHardDelete: ${error.message}`);
    return (data ?? []).map((r) => r.id as string);
  }
}
