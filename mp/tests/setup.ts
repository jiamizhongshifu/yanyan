// Jest 测试环境 wx / App / Page mock
// 微信小程序运行时全局对象在 node 测试环境不存在;这里提供最小可用 mock

type AppOptions = {
  globalData?: Record<string, unknown>;
  onLaunch?: () => void;
  onShow?: () => void;
  onError?: (msg: string) => void;
  ensureConsentOrRedirect?: () => Promise<void>;
  [key: string]: unknown;
};

interface PageInstance {
  data: Record<string, unknown>;
  setData: (patch: Record<string, unknown>) => void;
  [key: string]: unknown;
}

type PageOptions = Partial<PageInstance> & {
  data?: Record<string, unknown>;
  onLoad?: (this: PageInstance) => void;
  [key: string]: unknown;
};

const appRegistry: { instance: AppOptions | null; lastPageOptions: PageOptions | null } = {
  instance: null,
  lastPageOptions: null
};

(global as unknown as { App: (opts: AppOptions) => void }).App = (opts: AppOptions) => {
  appRegistry.instance = opts;
  if (typeof opts.onLaunch === 'function') {
    opts.onLaunch();
  }
};

(global as unknown as { Page: (opts: PageOptions) => void }).Page = (opts: PageOptions) => {
  // 缓存最近一个 Page() 注册,供测试用来构造实例并断言
  appRegistry.lastPageOptions = opts;
};

/** 测试用:把缓存的 Page options 实例化成可调用的 PageInstance */
export function instantiateLastPage(): PageInstance {
  const opts = appRegistry.lastPageOptions;
  if (!opts) throw new Error('No Page() registered yet');
  const inst: PageInstance = {
    data: { ...((opts.data as Record<string, unknown>) ?? {}) },
    setData(patch) {
      this.data = { ...this.data, ...patch };
    }
  };
  for (const [k, v] of Object.entries(opts)) {
    if (k === 'data') continue;
    if (typeof v === 'function') {
      // bind page handlers / lifecycle
      (inst as Record<string, unknown>)[k] = (v as (...args: unknown[]) => unknown).bind(inst);
    }
  }
  return inst;
}

(global as unknown as { getApp: <T = AppOptions>() => T }).getApp = <T = AppOptions>() => {
  if (!appRegistry.instance) {
    throw new Error('App not initialized — did you import app.ts before getApp()?');
  }
  return appRegistry.instance as unknown as T;
};

(global as unknown as { getCurrentPages: () => Array<{ route?: string }> }).getCurrentPages = () => [];

(global as unknown as { wx: Record<string, unknown> }).wx = {
  request: jest.fn(),
  chooseMedia: jest.fn(),
  login: jest.fn(),
  showToast: jest.fn(),
  redirectTo: jest.fn(),
  navigateTo: jest.fn(),
  reLaunch: jest.fn(),
  setClipboardData: jest.fn()
};

export { appRegistry };
