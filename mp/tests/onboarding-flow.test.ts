/**
 * Onboarding 4 屏交互逻辑
 *
 * 对应 plan U4 测试场景:
 *   - Happy path: 5 步完成 → 主屏可正常显示
 *   - Edge case: step4 微信运动授权拒绝 → 流程继续
 *   - Edge case: step2 全部选"几乎没"→ step3 体质提示展示"目前看起来很平和"(=平)
 *   - Edge case: step2 跳过 → step3 显示"平"
 *   - 中途强退 → 回到上一步:全局 onboardingState 不持久化(简化),mp 框架本身提供返回
 */

import { appRegistry, instantiateLastPage } from './setup';

import '../app';

describe('U4 onboarding flow', () => {
  beforeEach(() => {
    (wx.request as jest.Mock).mockReset();
    (wx.login as jest.Mock).mockReset();
    (wx.authorize as jest.Mock).mockReset();
    (wx.navigateTo as jest.Mock).mockReset();
    (wx.reLaunch as jest.Mock).mockReset();
    appRegistry.instance!.globalData = {
      userId: null,
      consentVersionRequired: 1,
      consentVersionGranted: null,
      apiBaseUrl: 'https://api.test.local/api/v1',
      bootedAt: Date.now(),
      onboarding: { reverseFilterChoice: null, symptomsFrequency: {}, initialFireLevel: null }
    };
  });

  function loadPage(modulePath: string) {
    jest.isolateModules(() => {
      require(modulePath);
    });
    return instantiateLastPage();
  }

  test('Step 1 reverse-filter: select rhinitis → globalData updated → navigate next', () => {
    const page = loadPage('../pages/onboarding/step1-reverse-filter/index');
    (page.onSelect as (e: { currentTarget: { dataset: { choice: string } } }) => void)({
      currentTarget: { dataset: { choice: 'rhinitis' } }
    });
    expect(page.data.selected).toBe('rhinitis');
    (page.onNext as () => void)();
    const app = appRegistry.instance!;
    expect((app.globalData as { onboarding: { reverseFilterChoice: string } }).onboarding.reverseFilterChoice).toBe('rhinitis');
    expect(wx.navigateTo).toHaveBeenCalledWith({ url: '/pages/onboarding/step2-symptoms-grid/index' });
  });

  test('Step 1: onNext without selection shows toast, no navigate', () => {
    const page = loadPage('../pages/onboarding/step1-reverse-filter/index');
    (page.onNext as () => void)();
    expect(wx.showToast).toHaveBeenCalled();
    expect(wx.navigateTo).not.toHaveBeenCalled();
  });

  test('Step 2 grid: cell tap stores frequency; onNext writes globalData', () => {
    const page = loadPage('../pages/onboarding/step2-symptoms-grid/index');
    (page.onCellTap as (e: { currentTarget: { dataset: { dim: string; freq: string } } }) => void)({
      currentTarget: { dataset: { dim: 'nasal_congestion', freq: 'often' } }
    });
    (page.onCellTap as (e: { currentTarget: { dataset: { dim: string; freq: string } } }) => void)({
      currentTarget: { dataset: { dim: 'acne', freq: 'sometimes' } }
    });
    (page.onNext as () => void)();
    const app = appRegistry.instance!;
    expect((app.globalData as { onboarding: { symptomsFrequency: Record<string, string> } }).onboarding.symptomsFrequency).toEqual({
      nasal_congestion: 'often',
      acne: 'sometimes'
    });
    expect(wx.navigateTo).toHaveBeenCalledWith({ url: '/pages/onboarding/step3-baseline-consent/index' });
  });

  test('Step 2: onSkipAll bypasses with empty frequency', () => {
    const page = loadPage('../pages/onboarding/step2-symptoms-grid/index');
    (page.onSkipAll as () => void)();
    const app = appRegistry.instance!;
    expect((app.globalData as { onboarding: { symptomsFrequency: Record<string, string> } }).onboarding.symptomsFrequency).toEqual({});
  });

  test('Step 3: empty symptomsFrequency → local estimate shows 平', () => {
    const app = appRegistry.instance!;
    (app.globalData as { onboarding: { symptomsFrequency: Record<string, string> } }).onboarding.symptomsFrequency = {};
    const page = loadPage('../pages/onboarding/step3-baseline-consent/index');
    (page.onLoad as () => void)();
    expect(page.data.initialFireLevelLocal).toBe('平');
  });

  test('Step 3: severe symptomsFrequency → local estimate shows 大火', () => {
    const app = appRegistry.instance!;
    (app.globalData as { onboarding: { symptomsFrequency: Record<string, string> } }).onboarding.symptomsFrequency = {
      nasal_congestion: 'often',
      acne: 'often',
      dry_mouth: 'often',
      bowel: 'often',
      fatigue: 'often',
      edema: 'often',
      throat_itch: 'often'
    };
    const page = loadPage('../pages/onboarding/step3-baseline-consent/index');
    (page.onLoad as () => void)();
    expect(page.data.initialFireLevelLocal).toBe('大火');
  });

  test('Step 3: not all 5 scopes checked → errorMessage, no network', async () => {
    const page = loadPage('../pages/onboarding/step3-baseline-consent/index');
    (page.onLoad as () => void)();
    (page.onScopeChange as (e: { currentTarget: { dataset: { scope: string } } }) => void)({
      currentTarget: { dataset: { scope: 'health_data' } }
    });
    await (page.onSubmit as () => Promise<void>)();
    expect(page.data.errorMessage).toMatch(/5 项均需勾选/);
    expect(wx.login).not.toHaveBeenCalled();
  });

  test('Step 3: full happy path — login + consent + baseline → navigate step4', async () => {
    const app = appRegistry.instance!;
    (app.globalData as { onboarding: { reverseFilterChoice: string } }).onboarding.reverseFilterChoice = 'rhinitis';

    // Mock wx.login → returns code
    (wx.login as jest.Mock).mockImplementationOnce((opts: { success: (r: { code: string }) => void }) => {
      opts.success({ code: 'login-code-1' });
    });

    // Mock wx.request:3 sequential calls (POST /users → POST /consents → POST /users/me/baseline)
    const responses: Array<{ statusCode: number; data: unknown }> = [
      { statusCode: 200, data: { ok: true, userId: 'u-100', isNew: true } },
      { statusCode: 200, data: { ok: true } },
      { statusCode: 200, data: { ok: true, initialFireLevel: '微火' } }
    ];
    (wx.request as jest.Mock).mockImplementation((opts: { success: (r: { statusCode: number; data: unknown }) => void }) => {
      const next = responses.shift();
      if (next) opts.success(next);
    });

    const page = loadPage('../pages/onboarding/step3-baseline-consent/index');
    (page.onLoad as () => void)();
    for (const scope of ['health_data', 'medical_report', 'photo_ai', 'location', 'subscribe_push']) {
      (page.onScopeChange as (e: { currentTarget: { dataset: { scope: string } } }) => void)({
        currentTarget: { dataset: { scope } }
      });
    }
    await (page.onSubmit as () => Promise<void>)();

    expect((app.globalData as { userId: string }).userId).toBe('u-100');
    expect((app.globalData as { consentVersionGranted: number }).consentVersionGranted).toBe(1);
    expect((app.globalData as { onboarding: { initialFireLevel: string } }).onboarding.initialFireLevel).toBe('微火');
    expect(wx.navigateTo).toHaveBeenCalledWith({ url: '/pages/onboarding/step4-wx-run-photo/index' });
  });

  test('Step 3: wx.login fail → errorMessage, no /users call', async () => {
    const app = appRegistry.instance!;
    (app.globalData as { onboarding: { reverseFilterChoice: string } }).onboarding.reverseFilterChoice = 'curious';

    (wx.login as jest.Mock).mockImplementationOnce((opts: { fail: (e: { errMsg: string }) => void }) => {
      opts.fail({ errMsg: 'login:fail' });
    });

    const page = loadPage('../pages/onboarding/step3-baseline-consent/index');
    (page.onLoad as () => void)();
    for (const scope of ['health_data', 'medical_report', 'photo_ai', 'location', 'subscribe_push']) {
      (page.onScopeChange as (e: { currentTarget: { dataset: { scope: string } } }) => void)({
        currentTarget: { dataset: { scope } }
      });
    }
    await (page.onSubmit as () => Promise<void>)();
    expect(page.data.errorMessage).toMatch(/登录失败/);
    expect(wx.request).not.toHaveBeenCalled();
  });

  test('Step 4: wx.authorize success → granted=true, no navigation', async () => {
    const page = loadPage('../pages/onboarding/step4-wx-run-photo/index');
    (wx.authorize as jest.Mock).mockImplementationOnce((opts: { success: () => void }) => opts.success());
    await (page.onLinkWxRun as () => Promise<void>)();
    expect(page.data.wxRunGranted).toBe(true);
  });

  test('Step 4: wx.authorize denied → granted=false, flow continues (CTA still works)', async () => {
    const page = loadPage('../pages/onboarding/step4-wx-run-photo/index');
    (wx.authorize as jest.Mock).mockImplementationOnce((opts: { fail: (e: { errMsg: string }) => void }) =>
      opts.fail({ errMsg: 'authorize:deny' })
    );
    await (page.onLinkWxRun as () => Promise<void>)();
    expect(page.data.wxRunGranted).toBe(false);

    // 即便拒绝授权,CTA 仍可点击进入主屏
    (page.onTakeFirstPhoto as () => void)();
    expect(wx.reLaunch).toHaveBeenCalledWith({ url: '/pages/index/index' });
  });

  test('Step 4: skip wx-run → granted=false', () => {
    const page = loadPage('../pages/onboarding/step4-wx-run-photo/index');
    (page.onSkipWxRun as () => void)();
    expect(page.data.wxRunGranted).toBe(false);
  });
});
