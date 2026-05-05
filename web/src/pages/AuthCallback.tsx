/**
 * OAuth 回调路由 — Google 登录(以及未来其他 provider)的统一落地页
 *
 * Supabase 把 #access_token 写到 URL hash 后,客户端的 supabase.js 自动解析,
 * onAuthStateChange 触发 SIGNED_IN。useAuth 暴露的 session 此时为新值。
 *
 * 路由判断:
 *   有 session + 有 quiz prefill → 静默 bootstrap(ensure→consent→baseline) → /app
 *   有 session + 无 quiz prefill → /onboarding/step1(走标准引导)
 *   无 session(异常)            → /login + error
 */

import { useEffect, useRef, useState } from 'react';
import { useLocation } from 'wouter';
import { useAuth } from '../services/auth';
import { useQuiz } from '../store/quiz';
import { useOnboarding } from '../store/onboarding';
import { bootstrapFromQuiz } from '../services/bootstrap';
import { asset } from '../services/assets';

export function AuthCallback() {
  const [, navigate] = useLocation();
  const { session, loading } = useAuth();
  const quiz = useQuiz();
  const setInitialFireLevel = useOnboarding((s) => s.setInitialFireLevel);
  const handledRef = useRef(false);
  const [stage, setStage] = useState<'waiting' | 'bootstrapping' | 'error'>('waiting');

  useEffect(() => {
    if (loading) return;
    if (handledRef.current) return;
    if (!session) {
      // session 没解析出来 — 可能 hash token 有问题,回 login
      handledRef.current = true;
      navigate('/login?error=auth_failed', { replace: true });
      return;
    }
    handledRef.current = true;

    if (quiz.completedAt && quiz.reverseFilterChoice) {
      setStage('bootstrapping');
      void bootstrapFromQuiz({
        reverseFilterChoice: quiz.reverseFilterChoice,
        symptomsFrequency: quiz.symptomsFrequency
      }).then((r) => {
        if (r.ok) {
          setInitialFireLevel(r.initialFireLevel);
          navigate('/app', { replace: true });
        } else {
          // bootstrap 出错 → 退到标准引导
          navigate('/onboarding/step1', { replace: true });
        }
      });
      return;
    }
    // 没 quiz prefill,直接走标准 onboarding
    navigate('/onboarding/step1', { replace: true });
  }, [loading, session, quiz, navigate, setInitialFireLevel]);

  return (
    <main className="min-h-screen bg-paper flex flex-col items-center justify-center px-7">
      <img
        src={asset('mascot-thinking.png')}
        alt=""
        className="w-32 h-32 object-contain"
        loading="eager"
      />
      <p className="mt-4 text-sm text-ink/60">
        {stage === 'bootstrapping' ? '正在为你建立体质 baseline…' : '登录成功,正在准备主页…'}
      </p>
    </main>
  );
}
