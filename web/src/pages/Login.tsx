/**
 * 登录页 — Supabase Auth(Google OAuth + 邮箱 magic link)+ 隐私政策同意前置
 *
 * 用户必须先勾选「我已阅读并同意《隐私政策》」才能点登录按钮 — 把《个保法》
 * 单独同意做在登录前,登录后无需再次确认。同意状态存 localStorage,
 * 登录回调后 step3 silently postConsent(5 项)+ ensureUser + baseline。
 */

import { useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'wouter';
import { getSupabase } from '../services/supabase';
import { useAuth } from '../services/auth';
import { useQuiz } from '../store/quiz';
import { useOnboarding } from '../store/onboarding';
import { bootstrapFromQuiz } from '../services/bootstrap';

const PRIVACY_AGREED_KEY = 'yanyan.privacy.agreed.v1';

export function Login() {
  const [, navigate] = useLocation();
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
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

  useEffect(() => {
    if (!session) return;
    if (bootstrappingRef.current) return;

    // 来自 /quiz 漏斗:已答完 + reverseFilterChoice 齐全 → 静默 ensure→consent→baseline → /app
    if (quiz.completedAt && quiz.reverseFilterChoice) {
      bootstrappingRef.current = true;
      void bootstrapFromQuiz({
        reverseFilterChoice: quiz.reverseFilterChoice,
        symptomsFrequency: quiz.symptomsFrequency
      }).then((r) => {
        if (r.ok) {
          setInitialFireLevel(r.initialFireLevel);
          navigate('/app');
        } else {
          // bootstrap 失败 → 退化到标准引导,让用户走 step1
          navigate('/onboarding/step1');
        }
      });
      return;
    }
    navigate('/onboarding/step1');
  }, [session, quiz.completedAt, quiz.reverseFilterChoice, quiz.symptomsFrequency, navigate, setInitialFireLevel]);

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
      setStatusMessage({ kind: 'error', text: '请先勾选「我已阅读并同意《隐私政策》」。' });
      return;
    }
    setGoogleSubmitting(true);
    setStatusMessage(null);
    const { error } = await getSupabase().auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin + '/onboarding/step1',
        queryParams: { access_type: 'offline', prompt: 'select_account' }
      }
    });
    if (error) {
      setGoogleSubmitting(false);
      setStatusMessage({
        kind: 'error',
        text: error.message?.includes('not enabled')
          ? 'Google 登录暂未启用,请用邮箱登录或稍后再试。'
          : 'Google 登录失败,请稍后再试或改用邮箱。'
      });
    }
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    if (!agreedPrivacy) {
      setStatusMessage({ kind: 'error', text: '请先勾选「我已阅读并同意《隐私政策》」。' });
      return;
    }
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

  const buttonsDisabled = !agreedPrivacy;

  return (
    <main className="min-h-screen bg-paper px-7 pt-16 pb-10">
      <h1 className="text-3xl font-semibold text-ink">炎炎消防队</h1>
      <p className="mt-3 text-sm text-ink/60">控糖 × 炎症 × 次晨体感</p>

      {/* 隐私政策同意 — 登录前置 */}
      <label
        className="mt-12 flex items-start gap-3 rounded-2xl bg-white px-5 py-4 cursor-pointer"
        data-testid="privacy-agree-label"
      >
        <input
          type="checkbox"
          className="mt-0.5 w-5 h-5 accent-ink shrink-0"
          checked={agreedPrivacy}
          onChange={(e) => toggleAgreed(e.target.checked)}
          data-testid="privacy-agree-checkbox"
        />
        <span className="text-sm text-ink/80 leading-relaxed">
          我已阅读并同意{' '}
          <Link href="/privacy-policy" className="text-fire-ping underline">
            《隐私政策》
          </Link>{' '}
          ,授权处理 5 项敏感个人信息(健康生理 / 医疗体检 / 食物照片 AI 识别 / 所在城市 / 推送通知 — 详见《个保法》第二十八条)
        </span>
      </label>

      <button
        type="button"
        onClick={onGoogleSignIn}
        disabled={googleSubmitting || submitting || buttonsDisabled}
        className="mt-5 w-full rounded-full border border-ink/15 bg-white py-3 text-base font-medium text-ink flex items-center justify-center gap-3 disabled:opacity-40"
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

      <div className="mt-6 flex items-center gap-3 text-xs text-ink/40">
        <span className="flex-1 h-px bg-ink/10" />
        <span>或用邮箱</span>
        <span className="flex-1 h-px bg-ink/10" />
      </div>

      <form onSubmit={onSubmit} noValidate className="mt-6 space-y-4">
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
            data-testid="login-status"
          >
            {statusMessage.text}
          </div>
        )}

        <button
          type="submit"
          disabled={submitting || googleSubmitting || buttonsDisabled}
          className="w-full rounded-full bg-ink text-white py-3 text-base font-medium disabled:opacity-40"
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

export { PRIVACY_AGREED_KEY };
