// Smoke test:验证小程序框架最小可启动 + API wrapper 网络异常降级
//
// 对应 plan U1 测试场景:
// - Happy path: 启动 → app.ts onLaunch 触发 → globalData 正常注册
// - Edge case: 网络不通时 wx.request 失败显示降级文案
// - Edge case: 服务端 5xx 时显示服务忙文案

import { appRegistry } from './setup';

// 模块在测试套件首次加载时初始化一次,后续测试复用
import '../app';
import { request } from '../services/api';

describe('U1 smoke', () => {
  beforeEach(() => {
    (wx.request as jest.Mock).mockReset();
  });

  test('happy path: App() invokes onLaunch and registers globalData', () => {
    expect(appRegistry.instance).not.toBeNull();
    const app = appRegistry.instance!;
    expect(app.globalData).toMatchObject({
      consentVersionRequired: null,
      consentVersionGranted: null,
      apiBaseUrl: expect.stringContaining('/api/v1')
    });
    expect(typeof (app.globalData as { bootedAt: number }).bootedAt).toBe('number');
    expect((app.globalData as { bootedAt: number }).bootedAt).toBeGreaterThan(0);
  });

  test('edge case: api request returns user-friendly fallback when network fails', async () => {
    (wx.request as jest.Mock).mockImplementationOnce((opts: { fail: (e: { errMsg: string }) => void }) => {
      opts.fail({ errMsg: 'request:fail timeout' });
    });

    const result = await request({ url: '/health' });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.fallbackMessage).toBe('网络不通,请检查后重试');
      expect(result.status).toBe(0);
    }
  });

  test('edge case: api request returns 5xx fallback when server errors', async () => {
    (wx.request as jest.Mock).mockImplementationOnce((opts: { success: (r: { statusCode: number; data: unknown }) => void }) => {
      opts.success({ statusCode: 503, data: { error: 'overloaded' } });
    });

    const result = await request({ url: '/health' });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.fallbackMessage).toBe('服务忙,请稍后再试');
      expect(result.status).toBe(503);
    }
  });
});
