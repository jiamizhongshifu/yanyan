// Yanyan 小程序入口
//
// 启动 / 热启动时:
//   1. 拉取 consent_version_required(后端 /api/v1/consents/required)
//   2. 拉取当前用户 granted 版本(/api/v1/users/me/consent)
//   3. needsReconsent=true → wx.reLaunch 到 /pages/consent/index 强制拦截
//   4. 网络失败时不强拦截(避免无网可用性归零),但下一次 onShow 会重试
//
// 这处理 plan U3 / Round 2 review 修订:存量用户在新 consent_version 上线后不绕过同意页

import { evaluateConsentNeed } from './services/consents';

interface AppGlobalData {
  userId: string | null;
  consentVersionRequired: number | null;
  consentVersionGranted: number | null;
  apiBaseUrl: string;
  bootedAt: number;
}

interface YanyanApp {
  globalData: AppGlobalData;
  onLaunch(): void;
  onShow(): void;
  onError(msg: string): void;
  ensureConsentOrRedirect(): Promise<void>;
}

const CONSENT_PAGE = '/pages/consent/index';

App<YanyanApp>({
  globalData: {
    userId: null,
    consentVersionRequired: null,
    consentVersionGranted: null,
    apiBaseUrl: 'https://TODO_REPLACE_WITH_REAL_API.yanyan.com/api/v1',
    bootedAt: 0
  },

  onLaunch() {
    this.globalData.bootedAt = Date.now();
    void this.ensureConsentOrRedirect();
  },

  onShow() {
    void this.ensureConsentOrRedirect();
  },

  onError(msg: string) {
    // eslint-disable-next-line no-console
    console.error('[Yanyan] runtime error:', msg);
  },

  async ensureConsentOrRedirect() {
    const userId = this.globalData.userId;
    if (!userId) {
      // 鉴权占位 — 后续 unit 接入 wx.login;v1 此时是首次启动状态,onboarding 自然走到同意页
      return;
    }
    const status = await evaluateConsentNeed(userId);
    if (!status) {
      // 网络失败 — 不强拦截;下次 onShow 重试
      return;
    }
    this.globalData.consentVersionRequired = status.required;
    this.globalData.consentVersionGranted = status.granted;

    if (status.needsReconsent) {
      // 已经在同意页就不重复 redirect
      const pages = getCurrentPages();
      const top = pages[pages.length - 1];
      const onConsentPage = top && top.route && top.route.endsWith('pages/consent/index');
      if (!onConsentPage) {
        wx.reLaunch({ url: CONSENT_PAGE });
      }
    }
  }
});
