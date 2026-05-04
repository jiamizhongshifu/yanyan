/**
 * Onboarding Step 3 — 体质 baseline 即视感 + 5 scope 同意嵌入
 *
 * 这一屏完成 4 件事:
 *   1. 进入即本地启发式 → 显示"看起来你近期偏 X"(网络等待时不空白)
 *   2. 5 个 scope checkbox 强制全选
 *   3. onSubmit 串行调:
 *        ensureUser → postConsent → postBaseline
 *      任一失败显示对应 errorMessage,前面成功步骤不丢
 *   4. 服务端确认的 initialFireLevel 替换本地估算
 */

import { useEffect, useMemo, useState } from 'react';
import { useLocation } from 'wouter';
import { CONSENT_SCOPES, fetchRequiredVersion, postConsent, type ConsentScope } from '../../services/consents';
import { ScopeCheckbox, SCOPE_COPY } from '../../components/ScopeCheckbox';
import { ensureUser, localEstimateFireLevel, postBaseline, type FireLevel } from '../../services/onboarding';
import { useOnboarding } from '../../store/onboarding';

interface ScopeRow {
  key: ConsentScope;
  checked: boolean;
}

const FIRE_LEVEL_TO_HINT: Record<FireLevel, string> = {
  平: '目前看起来很平和。这是基于你刚选的症状频次得出的初步判断。',
  微火: '看起来近期略偏微火。',
  中火: '看起来近期偏中火。',
  大火: '看起来近期偏大火。'
};

export function Step3BaselineConsent() {
  const [, navigate] = useLocation();
  const { reverseFilterChoice, symptomsFrequency, setInitialFireLevel } = useOnboarding();
  const [scopes, setScopes] = useState<ScopeRow[]>(
    CONSENT_SCOPES.map((key) => ({ key, checked: false }))
  );
  const [consentVersion, setConsentVersion] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const localLevel = useMemo(() => localEstimateFireLevel(symptomsFrequency), [symptomsFrequency]);

  useEffect(() => {
    let mounted = true;
    void fetchRequiredVersion().then((v) => {
      if (mounted && v != null) setConsentVersion(v);
    });
    return () => {
      mounted = false;
    };
  }, []);

  const onScopeChange = (key: ConsentScope) => {
    setScopes((prev) => prev.map((s) => (s.key === key ? { ...s, checked: !s.checked } : s)));
    setErrorMessage('');
  };

  const onSubmit = async () => {
    if (submitting) return;
    if (!scopes.every((s) => s.checked)) {
      setErrorMessage('5 项均需勾选才能继续 — 任意一项缺失将无法使用核心功能。');
      return;
    }
    if (!reverseFilterChoice) {
      setErrorMessage('缺少第一步选项,请退回 Step 1 重选。');
      return;
    }
    setSubmitting(true);
    setErrorMessage('');

    // 1. ensure user(post-Supabase Auth 创建)
    const ensured = await ensureUser();
    if (!ensured.ok) {
      setSubmitting(false);
      setErrorMessage('账号初始化失败,请检查登录状态后重试。');
      return;
    }

    // 2. POST consents
    const consentOk = await postConsent(
      scopes.map((s) => s.key),
      consentVersion
    );
    if (!consentOk) {
      setSubmitting(false);
      setErrorMessage('同意提交失败,请稍后重试。');
      return;
    }

    // 3. POST baseline
    const baseline = await postBaseline(reverseFilterChoice, symptomsFrequency);
    if (!baseline) {
      setSubmitting(false);
      setErrorMessage('体质数据保存失败,请稍后重试。');
      return;
    }
    setInitialFireLevel(baseline.initialFireLevel);
    navigate('/onboarding/step4');
  };

  const fireClass: Record<FireLevel, string> = {
    平: 'text-fire-ping',
    微火: 'text-fire-mild',
    中火: 'text-fire-mid',
    大火: 'text-fire-high'
  };

  return (
    <main className="min-h-screen bg-paper px-7 pt-12 pb-10">
      <header className="mb-3 text-xs text-ink/50">3 / 4</header>

      <section className="mb-10">
        <p className="text-sm text-ink/60">看起来你近期偏</p>
        <div className={`mt-2 text-7xl font-semibold leading-none ${fireClass[localLevel]}`} data-testid="local-fire-level">
          {localLevel}
        </div>
        <p className="mt-4 text-sm text-ink/70 leading-relaxed">{FIRE_LEVEL_TO_HINT[localLevel]}</p>
      </section>

      <section className="rounded-2xl bg-white px-5 py-3">
        <h2 className="text-base font-medium text-ink mb-2">敏感个人信息处理同意(《个保法》第二十八条)</h2>
        <div>
          {scopes.map((s) => (
            <ScopeCheckbox
              key={s.key}
              scope={s.key}
              label={SCOPE_COPY[s.key].label}
              description={SCOPE_COPY[s.key].description}
              checked={s.checked}
              onChange={onScopeChange}
            />
          ))}
        </div>
        <p className="mt-3 text-xs text-ink/50 leading-relaxed">
          勾选 5 项即视为对此 5 类敏感个人信息的处理单独同意。任意一项不勾选将无法使用核心功能。完整文本见{' '}
          <a href="/privacy-policy" className="text-fire-ping underline">
            《隐私政策》
          </a>
          。
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
        {submitting ? '提交中...' : '我已阅读并同意 5 项 → 下一步'}
      </button>
    </main>
  );
}
