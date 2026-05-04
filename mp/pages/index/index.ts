// 首页(占位)
// U1 阶段只验证小程序框架可启动 + 路由可达;U10 主屏由后续单元实现真正的"今日体质卡片 + 餐食历史 + 打卡入口"

Page({
  data: {
    bootMessage: '炎炎消防队 — 等待 U10 主屏实现'
  },

  onLoad() {
    // U10 阶段在此调 /yan-score/today + /meals/today;U1 阶段保持空
  }
});
