/**
 * Onboarding Step 3 — 体质 baseline 自动建立
 *
 * 用户登录前已在 Login 页勾选《隐私政策》同意,所以此屏不再显示同意 UI。
 * 进页面后自动触发:ensureUser → postConsent(5 项) → postBaseline → step4
 * 用户看到本地估算的炎症等级 + "正在保存..." 进度,完成后自动跳转。
 *
 * 失败 → 显示 mascot-worried + 重试按钮(让用户控制)
 *
 * 防绕过:进页面时校验 localStorage('yanyan.privacy.agreed.v1') = 'true',
 *   未同意 → 跳回 /login(理论上不会发生)
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation } from 'wouter';
import { CONSENT_SCOPES, fetchRequiredVersion, postConsent } from '../../services/consents';
import { ensureUser, localEstimateFireLevel, postBaseline, type FireLevel } from '../../services/onboarding';
import { useOnboarding } from '../../store/onboarding';
import { asset } from '../../services/assets';
import { LEVEL_TO_LABEL } from '../../services/score-display';

const PRIVACY_AGREED_KEY = 'yanyan.privacy.agreed.v1';

const FIRE_LEVEL_TO_HINT: Record<FireLevel, string> = {
  平: '目前看起来很平和,这是基于你刚选的症状频次得出的初步判断。',
  微火: '看起来近期略偏轻盈,后续打卡会让结果更准。',
  中火: '看起来近期略偏微暖,后续打卡会让结果更准。',
  大火: '看起来近期需要留心一下,后续打卡会让结果更准。'
};

const fireClass: Record<FireLevel, string> = {
  平: 'text-fire-ping',
  微火: 'text-fire-ping',
  中火: 'text-fire-mild',
  大火: 'text-fire-mid'
};

type Stage = 'preparing' | 'saving' | 'error';

export function Step3BaselineConsent() {
  const [, navigate] = useLocation();
  const { reverseFilterChoice, symptomsFrequency, setInitialFireLevel } = useOnboarding();
  const [stage, setStage] = useState<Stage>('preparing');
  const [errorMessage, setErrorMessage] = useState('');
  const triggerRef = useRef(false);

  const localLevel = useMemo(() => localEstimateFireLevel(symptomsFrequency), [symptomsFrequency]);

  const runBaseline = async () => {
    if (triggerRef.current) return;
    triggerRef.current = true;
    if (!reverseFilterChoice) {
      setErrorMessage('缺少第一步选项,请退回 Step 1 重选。');
      setStage('error');
      triggerRef.current = false;
      return;
    }
    setStage('saving');
    setErrorMessage('');

    const ensured = await ensureUser();
    if (!ensured.ok) {
      setErrorMessage('账号初始化失败,请刷新或重新登录后重试。');
      setStage('error');
      triggerRef.current = false;
      return;
    }

    const version = (await fetchRequiredVersion()) ?? 1;
    const consentOk = await postConsent([...CONSENT_SCOPES], version);
    if (!consentOk) {
      setErrorMessage('同意提交失败,请稍后重试。');
      setStage('error');
      triggerRef.current = false;
      return;
    }

    const baseline = await postBaseline(reverseFilterChoice, symptomsFrequency);
    if (!baseline) {
      setErrorMessage('体质数据保存失败,请稍后重试。');
      setStage('error');
      triggerRef.current = false;
      return;
    }
    setInitialFireLevel(baseline.initialFireLevel);
    navigate('/onboarding/step4');
  };

  useEffect(() => {
    // 防绕过:未在 Login 页同意者不应进到这里
    if (typeof localStorage !== 'undefined' && localStorage.getItem(PRIVACY_AGREED_KEY) !== 'true') {
      navigate('/login', { replace: true });
      return;
    }
    // 进页面 1.2s 后自动触发(让用户先看清本地估算)
    const timer = setTimeout(() => {
      void runBaseline();
    }, 1200);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <main className="min-h-screen bg-paper px-7 pt-12 pb-10 max-w-md mx-auto">
      <header className="mb-3 text-xs text-ink/50">3 / 4</header>

      <section className="mb-8">
        <p className="text-sm text-ink/50">看起来你近期偏</p>
        <div
          className={`mt-2 text-7xl font-semibold leading-none ${fireClass[localLevel]}`}
          data-testid="local-fire-level"
        >
          {LEVEL_TO_LABEL[localLevel]}
        </div>
        <p className="mt-4 text-sm text-ink/70 leading-relaxed">{FIRE_LEVEL_TO_HINT[localLevel]}</p>
      </section>

      {stage === 'error' ? (
        <section className="rounded-2xl bg-fire-high/10 px-5 py-4 flex items-center gap-3" role="alert">
          <img
            src={asset('mascot-worried.png')}
            alt=""
            className="w-12 h-12 object-contain flex-shrink-0"
          />
          <span className="text-sm text-fire-high flex-1">{errorMessage}</span>
        </section>
      ) : (
        <section className="rounded-2xl bg-white px-6 py-5 flex items-center gap-4">
          <img
            src={asset(stage === 'saving' ? 'mascot-thinking.png' : 'onboarding-seedling.png')}
            alt=""
            className="w-16 h-16 object-contain flex-shrink-0 transition-opacity"
          />
          <div className="flex-1">
            <h2 className="text-base font-medium text-ink">
              {stage === 'saving' ? '正在为你建立 baseline…' : '即将完成初始化'}
            </h2>
            <p className="mt-2 text-xs text-ink/50 leading-relaxed">
              {stage === 'saving'
                ? '保存今天作为体质起点,后续每餐 / 每晨数据都以此为参照。'
                : '马上保存今天作为体质起点,后续每餐拍照、次晨打卡都以此为参照。'}
            </p>
          </div>
        </section>
      )}

      {stage === 'error' ? (
        <>
          <button
            type="button"
            onClick={() => void runBaseline()}
            className="mt-6 w-full rounded-full bg-ink text-white py-3 text-base font-medium"
          >
            重试
          </button>
          <button
            type="button"
            onClick={() => navigate('/me')}
            className="mt-3 w-full rounded-full border border-ink/15 bg-white text-ink/70 py-3 text-sm"
          >
            去「我的」重新登录
          </button>
        </>
      ) : (
        <p className="mt-8 text-xs text-ink/30 text-center leading-relaxed">
          {stage === 'saving' ? '保存完成后会自动进入下一步' : '正在准备…'}
        </p>
      )}
    </main>
  );
}
