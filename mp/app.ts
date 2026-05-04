// Yanyan 小程序入口
// 职责:启动时拉取并校验隐私同意版本(R5b),引导未同意用户去 consent 页;为 onShow 复用同一逻辑应对热启动场景
//
// 实施约束:
// - consent 校验必须发生在所有页面 onLoad 之前;依靠 launch 阻塞或全局 redirect
// - 已登录用户在新 consent_version 上线后必须被强制拦截到同意页

interface AppGlobalData {
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
}

App<YanyanApp>({
  globalData: {
    consentVersionRequired: null,
    consentVersionGranted: null,
    apiBaseUrl: 'https://TODO_REPLACE_WITH_REAL_API.yanyan.com/api/v1',
    bootedAt: 0
  },

  onLaunch() {
    this.globalData.bootedAt = Date.now();

    // 后续 U3 接入隐私同意校验:
    //   1. 调 GET /consents/current 拿当前 consent_version_required
    //   2. 调 GET /users/me/consent 拿用户已 granted 的 consent_version
    //   3. 不一致 → wx.redirectTo 到 /pages/consent/index
    //
    // U1 阶段仅完成壳子,具体逻辑由 U3 实现后注入。
  },

  onShow() {
    // 热启动时同样执行 consent 版本校验,避免后台版本升级后绕过(对应 ce-doc-review 的"存量用户拦截"修订)
  },

  onError(msg: string) {
    // 后续接入观测埋点(U12)前,先用 wx 的 console
    // eslint-disable-next-line no-console
    console.error('[Yanyan] runtime error:', msg);
  }
});
