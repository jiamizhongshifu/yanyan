/**
 * Onboarding Step 3 — 体质 baseline 即视感 + 静默写入同意 / baseline
 *
 * 用户登录前已在 Login 页勾选《隐私政策》同意,所以此屏不再显示同意 UI。
 * 单按钮"继续"触发:ensureUser → postConsent(5 项,基于登录前同意)→ postBaseline → step4
 *
 * 防绕过:进页面时校验 localStorage('yanyan.privacy.agreed.v1') = 'true',
 *   未同意 → 跳回 /login(理论上不会发生)
 */

import { useEffect, useMemo, useState } from 'react';
import { useLocation } from 'wouter';
import { CONSENT_SCOPES, fetchRequiredVersion, postConsent } from '../../services/consents';
import { ensureUser, localEstimateFireLevel, postBaseline, type FireLevel } from '../../services/onboarding';
import { useOnboarding } from '../../store/onboarding';

const PRIVACY_AGREED_KEY = 'yanyan.privacy.agreed.v1';

const FIRE_LEVEL_TO_HINT: Record<FireLevel, string> = {
  平: '目前看起来很平和。这是基于你刚选的症状频次得出的初步判断。',
  微火: '看起来近期略偏微火。',
  中火: '看起来近期偏中火。',
  大火: '看起来近期偏大火。'
};

const fireClass: Record<FireLevel, string> = {
  平: 'text-fire-ping',
  微火: 'text-fire-mild',
  中火: 'text-fire-mid',
  大火: 'text-fire-high'
};

export function Step3BaselineConsent() {
  const [, navigate] = useLocation();
  const { reverseFilterChoice, symptomsFrequency, setInitialFireLevel } = useOnboarding();
  const [consentVersion, setConsentVersion] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const localLevel = useMemo(() => localEstimateFireLevel(symptomsFrequency), [symptomsFrequency]);

  useEffect(() => {
    // 防绕过:未在 Login 页同意者不应进到这里
    if (typeof localStorage !== 'undefined' && localStorage.getItem(PRIVACY_AGREED_KEY) !== 'true') {
      navigate('/login', { replace: true });
      return;
    }
    let mounted = true;
    void fetchRequiredVersion().then((v) => {
      if (mounted && v != null) setConsentVersion(v);
    });
    return () => {
      mounted = false;
    };
  }, [navigate]);

  const onSubmit = async () => {
    if (submitting) return;
    if (!reverseFilterChoice) {
      setErrorMessage('缺少第一步选项,请退回 Step 1 重选。');
      return;
    }
    setSubmitting(true);
    setErrorMessage('');

    // 1. ensure user(post-Supabase Auth 创建 public.users + 生成 DEK)
    const ensured = await ensureUser();
    if (!ensured.ok) {
      setSubmitting(false);
      setErrorMessage('账号初始化失败,请刷新或重新登录后重试。');
      return;
    }

    // 2. 静默 postConsent — 用户在 Login 页已同意 5 项
    const consentOk = await postConsent([...CONSENT_SCOPES], consentVersion);
    if (!consentOk) {
      setSubmitting(false);
      setErrorMessage('同意提交失败,请稍后重试。');
      return;
    }

    // 3. baseline
    const baseline = await postBaseline(reverseFilterChoice, symptomsFrequency);
    if (!baseline) {
      setSubmitting(false);
      setErrorMessage('体质数据保存失败,请稍后重试。');
      return;
    }
    setInitialFireLevel(baseline.initialFireLevel);
    navigate('/onboarding/step4');
  };

  return (
    <main className="min-h-screen bg-paper px-7 pt-12 pb-10">
      <header className="mb-3 text-xs text-ink/50">3 / 4</header>

      <section className="mb-10">
        <p className="text-sm text-ink/60">看起来你近期偏</p>
        <div
          className={`mt-2 text-7xl font-semibold leading-none ${fireClass[localLevel]}`}
          data-testid="local-fire-level"
        >
          {localLevel}
        </div>
        <p className="mt-4 text-sm text-ink/70 leading-relaxed">{FIRE_LEVEL_TO_HINT[localLevel]}</p>
      </section>

      <section className="rounded-2xl bg-white px-6 py-5">
        <h2 className="text-base font-medium text-ink">即将完成初始化</h2>
        <p className="mt-3 text-sm text-ink/70 leading-relaxed">
          点击下方按钮,系统会用你刚才的回答建立体质 baseline。后续每餐拍照、次晨打卡都会以此为起点。
        </p>
      </section>

      {errorMessage && (
        <div role="alert" className="mt-6 rounded-xl bg-fire-high/10 px-4 py-3 text-sm text-fire-high">
          {errorMessage}
        </div>
      )}

      <button
        type="button"
        onClick={onSubmit}
        disabled={submitting}
        className="mt-10 w-full rounded-full bg-ink text-white py-3 text-base font-medium disabled:opacity-50"
      >
        {submitting ? '提交中...' : '建立 baseline → 下一步'}
      </button>
    </main>
  );
}
