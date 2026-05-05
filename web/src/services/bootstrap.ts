/**
 * 登录后基于 Quiz 答案的"静默初始化"
 *
 * 用户已在 /quiz 完成 7 维度症状 + 反向定位 + 生活方式三步答题,且在 Login 页
 * 勾选了《隐私政策》同意。session 落地后调用这里:
 *   1. ensureUser
 *   2. postConsent(5 个 scope,版本号取 server 当前要求)
 *   3. postBaseline(quiz 答案)
 *
 * 任一步失败 → 返回 {ok:false, failedAt} 让上层决定 UI(重试 / 退到引导)。
 */
import { CONSENT_SCOPES, fetchRequiredVersion, postConsent } from './consents';
import { ensureUser, postBaseline, type ReverseFilterChoice, type SymptomDimension, type SymptomFrequency, type FireLevel } from './onboarding';

interface QuizPayload {
  reverseFilterChoice: ReverseFilterChoice;
  symptomsFrequency: Partial<Record<SymptomDimension, SymptomFrequency>>;
}

export type BootstrapStep = 'ensure' | 'consent' | 'baseline';

export type BootstrapResult =
  | { ok: true; initialFireLevel: FireLevel }
  | { ok: false; failedAt: BootstrapStep };

export async function bootstrapFromQuiz(quiz: QuizPayload): Promise<BootstrapResult> {
  const ensured = await ensureUser();
  if (!ensured.ok) {
    // eslint-disable-next-line no-console
    console.error('[bootstrap] ensureUser failed');
    return { ok: false, failedAt: 'ensure' };
  }

  const version = (await fetchRequiredVersion()) ?? 1;
  const consentOk = await postConsent([...CONSENT_SCOPES], version);
  if (!consentOk) {
    // eslint-disable-next-line no-console
    console.error('[bootstrap] postConsent failed');
    return { ok: false, failedAt: 'consent' };
  }

  const baseline = await postBaseline(quiz.reverseFilterChoice, quiz.symptomsFrequency);
  if (!baseline) {
    // eslint-disable-next-line no-console
    console.error('[bootstrap] postBaseline failed');
    return { ok: false, failedAt: 'baseline' };
  }
  return { ok: true, initialFireLevel: baseline.initialFireLevel };
}
