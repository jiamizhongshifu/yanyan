/**
 * 登录页 — Supabase Google OAuth + 隐私政策同意前置
 *
 * 设计变更(v2):
 *   - 只保留 Google 登录,移除邮箱 magic link
 *   - 隐私同意改成 Google 按钮下方的小字 checkbox + 短文案
 *   - 容器加 max-w-md 居中,在大屏(平板/桌面)也优雅
 *
 * 同意状态存 localStorage;登录回调后 step3 静默 postConsent + ensureUser + baseline。
 */

import { useRef, useState } from 'react';
import { Link, useLocation } from 'wouter';
import { getSupabase } from '../services/supabase';
import { useAuth } from '../services/auth';
import { useQuiz } from '../store/quiz';
import { useOnboarding } from '../store/onboarding';
import { bootstrapFromQuiz } from '../services/bootstrap';
import { asset } from '../services/assets';

const PRIVACY_AGREED_KEY = 'yanyan.privacy.agreed.v1';

export function Login() {
  const [, navigate] = useLocation();
  const [googleSubmitting, setGoogleSubmitting] = useState(false);
  const [agreedPrivacy, setAgreedPrivacy] = useState<boolean>(() => {
    if (typeof localStorage === 'undefined') return false;
    return localStorage.getItem(PRIVACY_AGREED_KEY) === 'true';
  });
  const [statusMessage, setStatusMessage] = useState<{ kind: 'info' | 'error'; text: string } | null>(null);
  const { session } = useAuth();
  const quiz = useQuiz();
  const setInitialFireLevel = useOnboarding((s) => s.setInitialFireLevel);
  const bootstrappingRef = useRef(false);

  // 注意:不再自动导航。Google OAuth 的 redirectTo 会把成功登录的用户带到
  // /onboarding/step1,/login 永远不会接收登录回调。如果用户访问 /login 时
  // 已经有 session(从前次会话残留),显示「继续 →」按钮,把控制权还给用户。
  // 旧逻辑会让"点 checkbox 就跳走"看起来像 bug(实际是 getSession 异步解析触发 useEffect)。

  const onContinue = async () => {
    if (bootstrappingRef.current) return;
    bootstrappingRef.current = true;
    if (quiz.completedAt && quiz.reverseFilterChoice) {
      const r = await bootstrapFromQuiz({
        reverseFilterChoice: quiz.reverseFilterChoice,
        symptomsFrequency: quiz.symptomsFrequency
      });
      if (r.ok) {
        setInitialFireLevel(r.initialFireLevel);
        navigate('/app');
        return;
      }
    }
    navigate('/app');
  };

  const onSignOut = async () => {
    await getSupabase().auth.signOut();
    setStatusMessage({ kind: 'info', text: '已登出。可重新选择账号登录。' });
  };

  const toggleAgreed = (next: boolean) => {
    setAgreedPrivacy(next);
    if (typeof localStorage !== 'undefined') {
      if (next) localStorage.setItem(PRIVACY_AGREED_KEY, 'true');
      else localStorage.removeItem(PRIVACY_AGREED_KEY);
    }
    setStatusMessage(null);
  };

  const onGoogleSignIn = async () => {
    if (googleSubmitting) return;
    if (!agreedPrivacy) {
      setStatusMessage({ kind: 'error', text: '请先勾选下方同意条款' });
      return;
    }
    setGoogleSubmitting(true);
    setStatusMessage(null);
    const { error } = await getSupabase().auth.signInWithOAuth({
      provider: 'google',
      options: {
        // 统一回到 /auth/callback,由它根据 quiz prefill 决定 → /app or /onboarding/step1
        redirectTo: window.location.origin + '/auth/callback',
        queryParams: { access_type: 'offline', prompt: 'select_account' }
      }
    });
    if (error) {
      setGoogleSubmitting(false);
      setStatusMessage({
        kind: 'error',
        text: error.message?.includes('not enabled')
          ? 'Google 登录暂未启用,请稍后再试。'
          : 'Google 登录失败,请稍后再试。'
      });
    }
  };

  return (
    <main className="min-h-screen bg-paper px-7 pt-10 pb-10 flex items-center justify-center">
      <div className="w-full max-w-md flex flex-col">
        <div className="flex justify-center">
          <img
            src={asset(statusMessage?.kind === 'error' ? 'mascot-worried.png' : 'login-hero.png')}
            alt=""
            className="w-40 h-40 sm:w-48 sm:h-48 object-contain"
            loading="lazy"
          />
        </div>
        <div className="mt-2 flex justify-center">
          <img
            src={asset('soak-wordmark.png')}
            alt="Soak"
            className="h-12 sm:h-14 w-auto object-contain"
            loading="eager"
          />
        </div>
        <p className="mt-2 text-sm text-ink/60 text-center">控糖 × 炎症 × 次晨体感</p>

        {/* 已登录状态:不自动跳转,显式给用户两个选项 */}
        {session && (
          <div className="mt-6 rounded-2xl bg-fire-ping/10 px-4 py-4" data-testid="already-signed-in">
            <p className="text-sm text-ink/75 leading-relaxed">
              你已登录(<span className="font-mono">{session.user?.email ?? session.user?.id?.slice(0, 8)}</span>)。
            </p>
            <div className="mt-3 flex gap-2">
              <button
                type="button"
                onClick={() => void onContinue()}
                className="flex-1 rounded-full bg-ink text-white py-2.5 text-sm font-medium"
              >
                继续 →
              </button>
              <button
                type="button"
                onClick={() => void onSignOut()}
                className="rounded-full border border-ink/15 bg-white text-ink/65 px-4 py-2.5 text-sm"
              >
                换账号
              </button>
            </div>
          </div>
        )}

        {/* Google 登录 */}
        <button
          type="button"
          onClick={onGoogleSignIn}
          disabled={googleSubmitting || !agreedPrivacy}
          className="mt-10 w-full rounded-full bg-white border border-ink/15 py-3.5 text-base font-medium text-ink flex items-center justify-center gap-3 disabled:opacity-40 active:bg-paper transition-colors"
          data-testid="btn-google-signin"
        >
          <svg width="20" height="20" viewBox="0 0 18 18" aria-hidden="true">
            <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.615z" fill="#4285F4" />
            <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z" fill="#34A853" />
            <path d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05" />
            <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335" />
          </svg>
          <span>{googleSubmitting ? '正在跳转 Google…' : '用 Google 账号继续'}</span>
        </button>

        {/* 隐私同意 — 短版 + 在 Google 按钮下方 */}
        <label
          className="mt-4 flex items-start gap-2.5 px-1 cursor-pointer"
          data-testid="privacy-agree-label"
        >
          <input
            type="checkbox"
            className="mt-0.5 w-4 h-4 accent-ink shrink-0"
            checked={agreedPrivacy}
            onChange={(e) => toggleAgreed(e.target.checked)}
            data-testid="privacy-agree-checkbox"
          />
          <span className="text-xs text-ink/65 leading-relaxed">
            我已阅读并同意{' '}
            <Link href="/privacy-policy" className="text-fire-ping underline">
              《隐私政策》
            </Link>
            ,授权处理健康/食物照片等 5 项敏感个人信息
          </span>
        </label>

        {statusMessage && (
          <div
            role={statusMessage.kind === 'error' ? 'alert' : 'status'}
            className={`mt-4 rounded-xl px-4 py-3 text-sm ${
              statusMessage.kind === 'error' ? 'bg-fire-high/10 text-fire-high' : 'bg-fire-ping/10 text-fire-ping'
            }`}
            data-testid="login-status"
          >
            {statusMessage.text}
          </div>
        )}

        <p className="mt-12 text-xs text-ink/40 text-center leading-relaxed">
          v1 私人 beta 仅限邀请用户。<br />
          数据存放于 Supabase 境外服务器(详见《隐私政策》)。
        </p>
      </div>
    </main>
  );
}

export { PRIVACY_AGREED_KEY };
