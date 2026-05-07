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

/**
 * 登出 + 清理跨账号易污染的 localStorage / 内存 store。
 *
 * 必须清:
 *   - 客户端 API 缓存层(home/sugar/yan-score/progress 等)— 上一个用户的数据不能被新用户看到
 *   - yanyan.wellness.v1(喝水/步数,跨账号会显示前用户的水杯)
 *   - yanyan.privacy.agreed.v1(同意状态属于具体用户,不该跨账号"已同意")
 *
 * 保留(刻意):
 *   - yanyan.quiz.v1(匿名测评数据,跨账号复用是设计意图 — prefill onboarding)
 *   - 内存 store(onboarding/checkin/lastMeal)登出页面卸载时已重置
 */
export async function signOut(): Promise<void> {
  await getSupabase().auth.signOut();
  try {
    // 清掉用户私有的本地数据
    localStorage.removeItem('yanyan.wellness.v1');
    localStorage.removeItem('yanyan.privacy.agreed.v1');
    // API 缓存全清(避免 A 的家庭数据闪现给 B)
    const { invalidate } = await import('./cache');
    invalidate();
  } catch {
    // 忽略 localStorage 异常(隐私模式 / 配额已满 / SSR)— 主登出已成功
  }
}
