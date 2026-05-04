/**
 * Supabase Auth 客户端 wrapper
 *
 * 暴露:
 *   - useAuth() React hook:订阅 session,返回 { session, userId, loading }
 *   - getCurrentAccessToken():拿当前 JWT,用于给 API 请求加 Authorization Bearer
 *
 * 真实登录流程(短信 OTP / 微信 OAuth Web)由 U4 onboarding redo 接入。
 * U3 阶段可在浏览器 console 用 supabase.auth.signInWithOtp 测试。
 */

import { useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { getSupabase } from './supabase';

export interface AuthState {
  session: Session | null;
  userId: string | null;
  loading: boolean;
}

export function useAuth(): AuthState {
  const [state, setState] = useState<AuthState>({ session: null, userId: null, loading: true });

  useEffect(() => {
    const supabase = getSupabase();
    let active = true;

    void supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setState({
        session: data.session,
        userId: data.session?.user?.id ?? null,
        loading: false
      });
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!active) return;
      setState({ session, userId: session?.user?.id ?? null, loading: false });
    });

    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  return state;
}

export async function getCurrentAccessToken(): Promise<string | null> {
  const { data } = await getSupabase().auth.getSession();
  return data.session?.access_token ?? null;
}

export async function signOut(): Promise<void> {
  await getSupabase().auth.signOut();
}
