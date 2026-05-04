/**
 * 同意页交互逻辑测试
 *
 * 对应 plan U3 测试场景:
 *   - Happy path: 5 个 scope 全勾 → onSubmit → reLaunch 主屏
 *   - Edge case: 不勾选直接 onSubmit → errorMessage 提示 + 不发请求
 *   - Edge case: 部分勾选 → errorMessage 提示
 */

import { appRegistry, instantiateLastPage } from './setup';

// 先初始化 App() 让 getApp() 可用
import '../app';

describe('U3 consent page interaction', () => {
  beforeEach(() => {
    (wx.request as jest.Mock).mockReset();
    (wx.reLaunch as jest.Mock).mockReset();
    appRegistry.instance!.globalData = {
      userId: 'u-test',
      consentVersionRequired: 1,
      consentVersionGranted: 0,
      apiBaseUrl: 'https://api.test.local/api/v1',
      bootedAt: Date.now()
    };
  });

  function loadPage() {
    jest.isolateModules(() => {
      require('../pages/consent/index');
    });
    return instantiateLastPage();
  }

  test('initial data: 5 scopes, all unchecked', () => {
    const page = loadPage();
    expect(page.data.scopes).toBeDefined();
    const scopes = page.data.scopes as Array<{ checked: boolean }>;
    expect(scopes).toHaveLength(5);
    expect(scopes.every((s) => !s.checked)).toBe(true);
  });

  test('Edge case: submit with nothing checked → errorMessage + no network call', async () => {
    const page = loadPage();
    await (page.onSubmit as () => Promise<void>)();
    expect(page.data.errorMessage).toMatch(/5 项均需勾选/);
    expect(wx.request).not.toHaveBeenCalled();
    expect(wx.reLaunch).not.toHaveBeenCalled();
  });

  test('Edge case: submit with partial check (3/5) → errorMessage + no network call', async () => {
    const page = loadPage();
    const onScopeChange = page.onScopeChange as (e: { currentTarget: { dataset: { scope: string } } }) => void;
    onScopeChange({ currentTarget: { dataset: { scope: 'health_data' } } });
    onScopeChange({ currentTarget: { dataset: { scope: 'medical_report' } } });
    onScopeChange({ currentTarget: { dataset: { scope: 'photo_ai' } } });
    await (page.onSubmit as () => Promise<void>)();
    expect(page.data.errorMessage).toMatch(/5 项均需勾选/);
    expect(wx.request).not.toHaveBeenCalled();
  });

  test('Happy path: all 5 checked → POST /consents → reLaunch home', async () => {
    const page = loadPage();
    const onScopeChange = page.onScopeChange as (e: { currentTarget: { dataset: { scope: string } } }) => void;
    for (const scope of ['health_data', 'medical_report', 'photo_ai', 'location', 'subscribe_push']) {
      onScopeChange({ currentTarget: { dataset: { scope } } });
    }

    (wx.request as jest.Mock).mockImplementationOnce((opts: { success: (r: { statusCode: number; data: unknown }) => void }) => {
      opts.success({ statusCode: 200, data: { ok: true } });
    });

    await (page.onSubmit as () => Promise<void>)();

    expect(wx.request).toHaveBeenCalledTimes(1);
    const callArgs = (wx.request as jest.Mock).mock.calls[0][0];
    expect(callArgs.method).toBe('POST');
    expect(callArgs.url).toContain('/consents');
    expect(callArgs.header['X-User-Id']).toBe('u-test');
    expect(callArgs.data).toEqual({
      scopes: ['health_data', 'medical_report', 'photo_ai', 'location', 'subscribe_push'],
      consentVersion: 1
    });
    expect(wx.reLaunch).toHaveBeenCalledWith({ url: '/pages/index/index' });
  });

  test('Network failure: submit returns gracefully with errorMessage, no reLaunch', async () => {
    const page = loadPage();
    const onScopeChange = page.onScopeChange as (e: { currentTarget: { dataset: { scope: string } } }) => void;
    for (const scope of ['health_data', 'medical_report', 'photo_ai', 'location', 'subscribe_push']) {
      onScopeChange({ currentTarget: { dataset: { scope } } });
    }
    (wx.request as jest.Mock).mockImplementationOnce((opts: { fail: (e: { errMsg: string }) => void }) => {
      opts.fail({ errMsg: 'request:fail timeout' });
    });

    await (page.onSubmit as () => Promise<void>)();

    expect(page.data.errorMessage).toMatch(/提交失败/);
    expect(wx.reLaunch).not.toHaveBeenCalled();
  });
});
