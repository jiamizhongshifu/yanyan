/**
 * Onboarding Step 3 — baseline 即视感 + 5 scope 同意一键完成
 *
 * UX 简化:
 *   - 5 个 scope 默认全部 checked,UI 不显示 checkbox 列表(只显示一句"我已阅读《隐私政策》")
 *   - 用户只需点单按钮"同意并继续"
 *   - 完整 5 项明细在 /privacy-policy 详情页
 *
 * 内部仍调:ensureUser → postConsent(5 项)→ postBaseline,任一失败显示 errorMessage
 */

import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation } from 'wouter';
import { CONSENT_SCOPES, fetchRequiredVersion, postConsent } from '../../services/consents';
import { ensureUser, localEstimateFireLevel, postBaseline, type FireLevel } from '../../services/onboarding';
import { useOnboarding } from '../../store/onboarding';

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
    let mounted = true;
    void fetchRequiredVersion().then((v) => {
      if (mounted && v != null) setConsentVersion(v);
    });
    return () => {
      mounted = false;
    };
  }, []);

  const onSubmit = async () => {
    if (submitting) return;
    if (!reverseFilterChoice) {
      setErrorMessage('缺少第一步选项,请退回 Step 1 重选。');
      return;
    }
    setSubmitting(true);
    setErrorMessage('');

    // 1. ensure user(post-Supabase Auth 创建 public.users 行 + 生成 DEK)
    const ensured = await ensureUser();
    if (!ensured.ok) {
      setSubmitting(false);
      setErrorMessage('账号初始化失败,请刷新或重新登录后重试。');
      return;
    }

    // 2. POST consents — 默认 5 项全部同意
    const consentOk = await postConsent([...CONSENT_SCOPES], consentVersion);
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
        <h2 className="text-base font-medium text-ink">敏感信息处理同意</h2>
        <p className="mt-3 text-sm text-ink/70 leading-relaxed">
          为了给你出准确的火分 + 30 天发物档案,我们需要处理 5 类敏感信息:健康生理、医疗体检、食物照片 AI 识别、所在城市(空气与花粉)、次晨打卡推送。
        </p>
        <p className="mt-3 text-sm text-ink/70 leading-relaxed">
          数据仅在你的账号下保留,境内 AI 模型识别后不出境。完整规则见{' '}
          <Link href="/privacy-policy" className="text-fire-ping underline">
            《隐私政策》
          </Link>
          (《个保法》第二十八条)。
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
        {submitting ? '提交中...' : '我已阅读并同意 → 下一步'}
      </button>

      <p className="mt-4 text-xs text-ink/40 text-center">
        点击上方按钮即视为对 5 项敏感个人信息处理单独同意。
      </p>
    </main>
  );
}
