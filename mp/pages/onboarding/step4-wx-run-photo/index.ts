/**
 * Onboarding Step 4 — 微信运动授权 + 首次拍照引导(合并屏)
 *
 * 微信运动授权可跳过(plan U4 R5):用户拒绝时 Yan-Score ActivityPart 缺失,U8 算法降级运行。
 * 首次拍照 CTA 跳到 U6 拍照页(暂用占位 navigateTo /pages/index/index 因 U6 还未实施)。
 */

interface PageData {
  wxRunGranted: boolean | null; // null = 未点过, true/false = 点过结果
  busy: boolean;
}

Page<PageData, { onLinkWxRun: () => Promise<void>; onSkipWxRun: () => void; onTakeFirstPhoto: () => void }>({
  data: {
    wxRunGranted: null,
    busy: false
  },

  async onLinkWxRun() {
    if (this.data.busy) return;
    this.setData({ busy: true });
    const res = await new Promise<{ errMsg?: string; authSetting?: Record<string, boolean> }>((resolve) => {
      wx.authorize({
        scope: 'scope.werun',
        success: () => resolve({ errMsg: 'ok' }),
        fail: (e) => resolve(e)
      });
    });
    const granted = res.errMsg === 'ok' || res.errMsg === 'authorize:ok';
    this.setData({ busy: false, wxRunGranted: granted });
  },

  onSkipWxRun() {
    this.setData({ wxRunGranted: false });
  },

  onTakeFirstPhoto() {
    // U6 拍照页未实施前,先 reLaunch 主屏让 onboarding 完成
    // 主屏会拉取已 onboarded 的状态;后续 U6 上线后此处改为跳 /pages/camera/index
    wx.reLaunch({ url: '/pages/index/index' });
  }
});
