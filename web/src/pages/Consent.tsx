/**
 * 单独同意页(R5b)
 *
 * 触发时机:
 *   - 新用户:onboarding R4 baseline 屏完成后(嵌入 baseline,后续 step3 接入)
 *   - 存量用户:Supabase Auth session 存在但 needsReconsent=true 时强制跳转
 *
 * UX 约束:
 *   - 5 个 scope 全部强制勾选才能 proceed(《个保法》第 28 条单独同意)
 *   - 不勾选不能进入下一步
 */

import { useEffect, useState } from 'react';
import { useLocation } from 'wouter';
import {
  CONSENT_SCOPES,
  fetchRequiredVersion,
  postConsent,
  type ConsentScope
} from '../services/consents';
import { ScopeCheckbox, SCOPE_COPY } from '../components/ScopeCheckbox';

interface ScopeRow {
  key: ConsentScope;
  checked: boolean;
}

export function Consent() {
  const [, navigate] = useLocation();
  const [scopes, setScopes] = useState<ScopeRow[]>(
    CONSENT_SCOPES.map((key) => ({ key, checked: false }))
  );
  const [consentVersion, setConsentVersion] = useState<number>(1);
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

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
    setSubmitting(true);
    setErrorMessage('');
    const ok = await postConsent(
      scopes.map((s) => s.key),
      consentVersion
    );
    setSubmitting(false);
    if (!ok) {
      setErrorMessage('提交失败,请检查登录状态与网络后重试。');
      return;
    }
    navigate('/app');
  };

  return (
    <main className="min-h-screen bg-paper px-7 pt-12 pb-12 max-w-md mx-auto">
      <header className="mb-8">
        <h1 className="text-2xl font-semibold text-ink">敏感个人信息处理同意</h1>
        <p className="mt-3 text-sm text-ink/70 leading-relaxed">
          Soak 基于《个人信息保护法》第二十八条,对以下 5 类敏感个人信息逐项征求同意。任意一项不勾选,该类数据不会被采集 — 但部分核心功能将不可用。
        </p>
      </header>

      <section className="bg-white rounded-2xl px-5 py-2">
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
      </section>

      {errorMessage && (
        <div role="alert" className="mt-6 rounded-xl bg-fire-high/10 px-4 py-3 text-sm text-fire-high">
          {errorMessage}
        </div>
      )}

      <footer className="mt-10 flex flex-col items-center gap-4">
        <button
          type="button"
          onClick={() => navigate('/privacy-policy')}
          className="text-sm text-fire-ping underline"
        >
          查看完整《隐私政策》
        </button>
        <button
          type="button"
          onClick={onSubmit}
          disabled={submitting}
          className="w-full rounded-full bg-ink text-white py-3 text-base font-medium disabled:opacity-50"
        >
          {submitting ? '提交中...' : '我已阅读并同意以上 5 项'}
        </button>
      </footer>
    </main>
  );
}
