/**
 * Onboarding Step 3 — 体质 baseline 即视感 + 同意嵌入(R5b)
 *
 * 这一屏完成 4 件事:
 *   1. 客户端先做本地启发式估算 → 显示"看起来你近期偏 X"(防止网络等待时 UX 空白)
 *   2. wx.login 拿 code → POST /users 创建/查找用户 → 拿到 userId
 *   3. 用户勾选 5 个 scope → POST /consents
 *   4. POST /users/me/baseline 持久化 7 维度数据 + 用服务端确认的 initialFireLevel 替换本地估算
 *   5. 全部成功 → 跳转 step4
 *
 * 同意逻辑与 /pages/consent 保持一致,但不 reLaunch — 而是顺势进入 step4。
 */

import { CONSENT_SCOPES, postConsent, type ConsentScope } from '../../../services/consents';
import { login, postBaseline, type ReverseFilterChoice, type SymptomDimension, type SymptomFrequency } from '../../../services/onboarding';

const SCOPE_LABELS: Record<ConsentScope, string> = {
  health_data: '健康生理信息',
  medical_report: '医疗体检数据',
  photo_ai: '食物照片 AI 识别',
  location: '所在城市',
  subscribe_push: '次晨打卡推送'
};

interface PageData {
  initialFireLevelLocal: '平' | '微火' | '中火' | '大火';
  scopes: Array<{ key: ConsentScope; label: string; checked: boolean }>;
  submitting: boolean;
  errorMessage: string;
}

function localEstimateFireLevel(
  symptomsFrequency: Partial<Record<SymptomDimension, SymptomFrequency>>
): '平' | '微火' | '中火' | '大火' {
  const w: Record<SymptomFrequency, number> = { rare: 0, sometimes: 1, often: 2 };
  let total = 0;
  let count = 0;
  for (const v of Object.values(symptomsFrequency)) {
    if (v) {
      total += w[v];
      count++;
    }
  }
  const ratio = count > 0 ? total / (count * 2) : 0;
  if (ratio <= 0.15) return '平';
  if (ratio <= 0.40) return '微火';
  if (ratio <= 0.65) return '中火';
  return '大火';
}

Page<PageData, { onScopeChange: (e: WechatMiniprogram.CustomEvent) => void; onSubmit: () => Promise<void>; onLoad: () => void }>({
  data: {
    initialFireLevelLocal: '平',
    scopes: CONSENT_SCOPES.map((key) => ({ key, label: SCOPE_LABELS[key], checked: false })),
    submitting: false,
    errorMessage: ''
  },

  onLoad() {
    const app = getApp() as { globalData: { onboarding: { symptomsFrequency: Partial<Record<SymptomDimension, SymptomFrequency>> } } };
    const local = localEstimateFireLevel(app.globalData.onboarding.symptomsFrequency);
    this.setData({ initialFireLevelLocal: local });
  },

  onScopeChange(e) {
    const key = e.currentTarget.dataset.scope as ConsentScope;
    const next = this.data.scopes.map((s) => (s.key === key ? { ...s, checked: !s.checked } : s));
    this.setData({ scopes: next, errorMessage: '' });
  },

  async onSubmit() {
    if (this.data.submitting) return;
    if (!this.data.scopes.every((s) => s.checked)) {
      this.setData({ errorMessage: '5 项均需勾选才能继续 — 任意一项缺失将无法使用核心功能。' });
      return;
    }

    this.setData({ submitting: true, errorMessage: '' });

    const app = getApp() as {
      globalData: {
        userId: string | null;
        consentVersionRequired: number | null;
        consentVersionGranted: number | null;
        onboarding: {
          reverseFilterChoice: ReverseFilterChoice | null;
          symptomsFrequency: Partial<Record<SymptomDimension, SymptomFrequency>>;
          initialFireLevel: '平' | '微火' | '中火' | '大火' | null;
        };
      };
    };

    // 1. wx.login 拿 code
    const loginRes = await new Promise<{ code?: string; errMsg?: string }>((resolve) => {
      wx.login({ success: resolve, fail: resolve });
    });
    if (!loginRes.code) {
      this.setData({ submitting: false, errorMessage: '登录失败,请检查网络后重试。' });
      return;
    }

    // 2. POST /users
    const userId = await login(loginRes.code);
    if (!userId) {
      this.setData({ submitting: false, errorMessage: '账号创建失败,请稍后重试。' });
      return;
    }
    app.globalData.userId = userId;

    // 3. POST /consents
    const consentVersion = app.globalData.consentVersionRequired ?? 1;
    const consentOk = await postConsent(
      userId,
      this.data.scopes.map((s) => s.key),
      consentVersion
    );
    if (!consentOk) {
      this.setData({ submitting: false, errorMessage: '同意提交失败,请稍后重试。' });
      return;
    }
    app.globalData.consentVersionGranted = consentVersion;

    // 4. POST /users/me/baseline
    if (!app.globalData.onboarding.reverseFilterChoice) {
      this.setData({ submitting: false, errorMessage: '缺少第一步选项,请退回重试。' });
      return;
    }
    const baselineRes = await postBaseline(
      userId,
      app.globalData.onboarding.reverseFilterChoice,
      app.globalData.onboarding.symptomsFrequency
    );
    if (!baselineRes) {
      this.setData({ submitting: false, errorMessage: '体质数据保存失败,请稍后重试。' });
      return;
    }
    app.globalData.onboarding.initialFireLevel = baselineRes.initialFireLevel;

    // 5. 进入 step4
    wx.navigateTo({ url: '/pages/onboarding/step4-wx-run-photo/index' });
  }
});
