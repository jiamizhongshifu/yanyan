/**
 * OAuth 回调路由 — Google 登录(以及未来其他 provider)的统一落地页
 *
 * Supabase 把 #access_token 写到 URL hash 后,客户端的 supabase.js 自动解析,
 * onAuthStateChange 触发 SIGNED_IN。useAuth 暴露的 session 此时为新值。
 *
 * 路由判断:
 *   有 session + 有 quiz prefill → 静默 bootstrap(ensure→consent→baseline) → /app
 *   有 session + 无 quiz prefill → /onboarding/step1
 *   无 session(异常)            → /login + error
 *
 * bootstrap 失败 → 不跳转,在本页显示错误 + 重试按钮 + 重新登录按钮。
 * 避免 bounce-through(step1 → step3 → 再次失败)产生的循环错误。
 */

import { useEffect, useRef, useState } from 'react';
import { useLocation } from 'wouter';
import { useAuth } from '../services/auth';
import { useQuiz } from '../store/quiz';
import { useOnboarding } from '../store/onboarding';
import { bootstrapFromQuiz, type BootstrapStep } from '../services/bootstrap';
import { asset } from '../services/assets';
import { consumeAuthRedirect } from '../components/RequireAuth';
import { signOut } from '../services/auth';

type Stage = 'waiting' | 'bootstrapping' | 'error' | 'no-session';

export function AuthCallback() {
  const [, navigate] = useLocation();
  const { session, loading } = useAuth();
  const quiz = useQuiz();
  const setInitialFireLevel = useOnboarding((s) => s.setInitialFireLevel);
  const triggerRef = useRef(false);
  const [stage, setStage] = useState<Stage>('waiting');
  const [failedAt, setFailedAt] = useState<BootstrapStep | null>(null);

  const runBootstrap = async () => {
    if (triggerRef.current) return;
    triggerRef.current = true;
    if (!session) {
      setStage('no-session');
      triggerRef.current = false;
      return;
    }

    if (quiz.completedAt && quiz.reverseFilterChoice) {
      setStage('bootstrapping');
      const r = await bootstrapFromQuiz({
        reverseFilterChoice: quiz.reverseFilterChoice,
        symptomsFrequency: quiz.symptomsFrequency
      });
      if (r.ok) {
        setInitialFireLevel(r.initialFireLevel);
        // bootstrap 成功 → 清掉 quiz prefill 缓存,避免再次登录时把陈旧答案当 baseline
        quiz.reset();
        // 优先回跳到登录前用户原本想去的页面(deep link 不丢失)
        navigate(consumeAuthRedirect() ?? '/app', { replace: true });
        return;
      }
      // 失败 → 留在本页,显示错误 + 重试
      setFailedAt(r.failedAt);
      setStage('error');
      triggerRef.current = false;
      return;
    }
    // 没 quiz prefill → 走标准 onboarding(消费掉 redirect 但不用,onboarding 完成后自然进 /app 或 /camera)
    consumeAuthRedirect();
    navigate('/onboarding/step1', { replace: true });
  };

  useEffect(() => {
    if (loading) return;
    void runBootstrap();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, session]);

  const onRetry = () => {
    triggerRef.current = false;
    setStage('waiting');
    void runBootstrap();
  };

  const onSignOutAndBack = async () => {
    await signOut();
    navigate('/login', { replace: true });
  };

  if (stage === 'error') {
    return (
      <main className="min-h-screen bg-paper flex flex-col items-center justify-center px-7 max-w-md mx-auto">
        <img
          src={asset('mascot-worried.png')}
          alt=""
          className="w-32 h-32 object-contain"
          loading="eager"
        />
        <h1 className="mt-4 text-xl font-semibold text-ink">初始化失败</h1>
        <p className="mt-2 text-sm text-ink/50 text-center max-w-xs leading-relaxed">
          账号已登录,但
          {failedAt === 'ensure' && '账号初始化(ensureUser)'}
          {failedAt === 'consent' && '同意提交'}
          {failedAt === 'baseline' && '体质数据保存'}
          {!failedAt && '建立体质 baseline'}
          时出错。
          <br />
          可能是网络抖动或 server 冷启动,请重试;多次失败请试试重新登录。
        </p>
        <button
          type="button"
          onClick={onRetry}
          className="mt-8 w-full rounded-full bg-ink text-white py-3 text-base font-medium"
        >
          重试
        </button>
        <button
          type="button"
          onClick={() => void onSignOutAndBack()}
          className="mt-3 w-full rounded-full border border-ink/15 bg-white text-ink/70 py-3 text-sm"
        >
          登出 / 重新登录
        </button>
      </main>
    );
  }

  if (stage === 'no-session') {
    return (
      <main className="min-h-screen bg-paper flex flex-col items-center justify-center px-7 max-w-md mx-auto">
        <img
          src={asset('mascot-worried.png')}
          alt=""
          className="w-32 h-32 object-contain"
        />
        <h1 className="mt-4 text-xl font-semibold text-ink">登录回调失败</h1>
        <p className="mt-2 text-sm text-ink/50 text-center max-w-xs leading-relaxed">
          没收到有效的登录信息,可能是回调链路出问题。
        </p>
        <button
          type="button"
          onClick={() => navigate('/login', { replace: true })}
          className="mt-8 w-full rounded-full bg-ink text-white py-3 text-base font-medium"
        >
          回登录页
        </button>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-paper flex flex-col items-center justify-center px-7 max-w-md mx-auto">
      <img
        src={asset('mascot-thinking.png')}
        alt=""
        className="w-32 h-32 object-contain"
        loading="eager"
      />
      <p className="mt-4 text-sm text-ink/50">
        {stage === 'bootstrapping' ? '正在为你建立体质 baseline…' : '登录成功,正在准备主页…'}
      </p>
    </main>
  );
}
