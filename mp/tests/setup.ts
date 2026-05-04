// Jest 测试环境 wx / App / Page mock
// 微信小程序运行时的全局对象在 node 测试环境不存在,这里提供最小可用 mock
//
// U1 阶段只 mock 启动相关的最小集合;后续 unit 按需扩展(如 U6 拍照 mock wx.chooseMedia,U11 推送 mock wx.requestSubscribeMessage)

type AppOptions = {
  globalData?: Record<string, unknown>;
  onLaunch?: () => void;
  onShow?: () => void;
  onError?: (msg: string) => void;
  [key: string]: unknown;
};

type PageOptions = {
  data?: Record<string, unknown>;
  onLoad?: () => void;
  [key: string]: unknown;
};

const appRegistry: { instance: AppOptions | null } = { instance: null };

(global as unknown as { App: (opts: AppOptions) => void }).App = (opts: AppOptions) => {
  appRegistry.instance = opts;
  if (typeof opts.onLaunch === 'function') {
    opts.onLaunch();
  }
};

(global as unknown as { Page: (opts: PageOptions) => void }).Page = (_opts: PageOptions) => {
  // U1 阶段只确保不抛错;具体 page lifecycle 在后续单元的测试中按需扩展
};

(global as unknown as { getApp: <T = AppOptions>() => T }).getApp = <T = AppOptions>() => {
  if (!appRegistry.instance) {
    throw new Error('App not initialized — did you import app.ts before getApp()?');
  }
  return appRegistry.instance as unknown as T;
};

(global as unknown as { wx: Record<string, unknown> }).wx = {
  request: jest.fn(),
  chooseMedia: jest.fn(),
  login: jest.fn(),
  showToast: jest.fn(),
  redirectTo: jest.fn(),
  navigateTo: jest.fn()
};

// 导出 registry 给 smoke test 验证
export { appRegistry };
