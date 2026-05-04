/**
 * 登录页 — Supabase Auth 邮箱 magic link
 *
 * v1 简化:用 email magic link(Supabase 默认支持,无需配置 SMS provider)
 * Phase 2 加微信 OAuth Web + 短信 OTP(plan U4 deferred)
 *
 * 流程:
 *   1. 用户输入邮箱 → 调 supabase.auth.signInWithOtp
 *   2. Supabase 发 magic link 到邮箱
 *   3. 用户点链接 → Supabase 跳回 / 带 access_token → onAuthStateChange 触发 → 自动跳 onboarding
 */

import { useEffect, useState } from 'react';
import { useLocation } from 'wouter';
import { getSupabase } from '../services/supabase';
import { useAuth } from '../services/auth';

export function Login() {
  const [, navigate] = useLocation();
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ kind: 'info' | 'error'; text: string } | null>(null);
  const { session } = useAuth();

  useEffect(() => {
    if (session) {
      navigate('/onboarding/step1');
    }
  }, [session, navigate]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setStatusMessage({ kind: 'error', text: '请输入有效的邮箱' });
      return;
    }
    setSubmitting(true);
    setStatusMessage(null);
    const { error } = await getSupabase().auth.signInWithOtp({
      email,
      options: { emailRedirectTo: window.location.origin + '/onboarding/step1' }
    });
    setSubmitting(false);
    if (error) {
      setStatusMessage({ kind: 'error', text: '发送失败,请稍后再试。' });
      return;
    }
    setStatusMessage({
      kind: 'info',
      text: '已发送登录链接到你的邮箱。点链接后会自动跳回这里。'
    });
  };

  return (
    <main className="min-h-screen bg-paper px-7 pt-16 pb-10">
      <h1 className="text-3xl font-semibold text-ink">炎炎消防队</h1>
      <p className="mt-3 text-sm text-ink/60">中医发物 × 次晨体感</p>

      <form onSubmit={onSubmit} noValidate className="mt-12 space-y-4">
        <label className="block">
          <span className="text-sm text-ink">邮箱</span>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            className="mt-2 w-full rounded-xl border border-ink/15 bg-white px-4 py-3 text-base focus:border-ink focus:outline-none"
            autoComplete="email"
            inputMode="email"
          />
        </label>

        {statusMessage && (
          <div
            role={statusMessage.kind === 'error' ? 'alert' : 'status'}
            className={`rounded-xl px-4 py-3 text-sm ${
              statusMessage.kind === 'error' ? 'bg-fire-high/10 text-fire-high' : 'bg-fire-ping/10 text-fire-ping'
            }`}
          >
            {statusMessage.text}
          </div>
        )}

        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-full bg-ink text-white py-3 text-base font-medium disabled:opacity-50"
        >
          {submitting ? '发送中...' : '发送登录链接'}
        </button>
      </form>

      <p className="mt-12 text-xs text-ink/40 text-center leading-relaxed">
        v1 私人 beta 仅限邀请用户。<br />
        数据存放于 Supabase 境外服务器(详见《隐私政策》)。
      </p>
    </main>
  );
}
