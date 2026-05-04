/**
 * 单独同意页(R5b)
 *
 * 触发时机:
 *   - 新用户:onboarding R4 baseline 屏完成后(嵌入 baseline 底部 → step3 / step4 合并)
 *   - 存量用户:onLaunch / onShow 检测 needsReconsent=true 时强制跳转
 *
 * UX 约束:
 *   - 5 个 scope 全部强制勾选才能 proceed(《个保法》第 28 条单独同意)
 *   - 不勾选不能进入下一步(关闭 App 后下次重进仍然这一页)
 *   - 文案为占位,正式上线前法务审核
 */

import { CONSENT_SCOPES, postConsent, type ConsentScope } from '../../services/consents';

interface PageData {
  scopes: Array<{ key: ConsentScope; label: string; description: string; checked: boolean }>;
  consentVersionRequired: number;
  submitting: boolean;
  errorMessage: string;
}

const SCOPE_COPY: Record<ConsentScope, { label: string; description: string }> = {
  health_data: {
    label: '健康生理信息',
    description: '步数、心率、血氧、睡眠等手机健康数据 — 用于综合判断你的火分。'
  },
  medical_report: {
    label: '医疗体检数据',
    description: '体检报告中的血糖、尿酸、CRP、血脂等 — 用于长程改善验证。'
  },
  photo_ai: {
    label: '食物照片 AI 识别',
    description: '你拍摄的食物照片送入境内 AI 模型识别食材,用于火分计算。照片仅在你的账号下保留,不出境。'
  },
  location: {
    label: '所在城市(空气与花粉)',
    description: '获取你所在城市的 PM2.5 与花粉数据,精度仅到城市级,不存储精确位置。'
  },
  subscribe_push: {
    label: '次晨打卡推送',
    description: '每天 7:30 提醒你完成 30 秒身体反应打卡。可在设置中随时关闭。'
  }
};

Page<PageData, { onScopeChange: (e: WechatMiniprogram.CustomEvent) => void; onSubmit: () => void; onPrivacyPolicyTap: () => void }>({
  data: {
    scopes: CONSENT_SCOPES.map((key) => ({ key, ...SCOPE_COPY[key], checked: false })),
    consentVersionRequired: 1,
    submitting: false,
    errorMessage: ''
  },

  onScopeChange(e) {
    const key = e.currentTarget.dataset.scope as ConsentScope;
    const next = this.data.scopes.map((s) => (s.key === key ? { ...s, checked: !s.checked } : s));
    this.setData({ scopes: next, errorMessage: '' });
  },

  async onSubmit() {
    if (this.data.submitting) return;
    const allChecked = this.data.scopes.every((s) => s.checked);
    if (!allChecked) {
      this.setData({ errorMessage: '5 项均需勾选才能继续 — 任意一项缺失将无法使用核心功能。' });
      return;
    }
    this.setData({ submitting: true, errorMessage: '' });

    const userId = (getApp() as { globalData: { userId: string | null } }).globalData.userId ?? null;
    if (!userId) {
      this.setData({ submitting: false, errorMessage: '账号尚未初始化,请重新进入。' });
      return;
    }

    const ok = await postConsent(
      userId,
      this.data.scopes.map((s) => s.key),
      this.data.consentVersionRequired
    );

    if (!ok) {
      this.setData({ submitting: false, errorMessage: '提交失败,请检查网络后重试。' });
      return;
    }

    // 提交成功 → 把全局 granted 同步上去 + 跳转主页
    const app = getApp() as { globalData: { consentVersionGranted: number | null } };
    app.globalData.consentVersionGranted = this.data.consentVersionRequired;
    wx.reLaunch({ url: '/pages/index/index' });
  },

  onPrivacyPolicyTap() {
    wx.navigateTo({ url: '/pages/privacy-policy/index' });
  }
});
