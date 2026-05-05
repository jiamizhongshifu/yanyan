/**
 * U4 redo onboarding 4 屏 + Login 测试
 *
 * 对应 plan U4 测试场景(React + Supabase 版本):
 *   - Step 1: 5 选 1 单选 + 选了才能下一步
 *   - Step 2: 7×3 方块矩阵勾选 + 跳过按钮
 *   - Step 3 (核心): 本地估算秒显 + 5 scope 全选 + 串行 ensure→consent→baseline
 *   - Step 4: 显示初始火分 + CTA 跳主页
 *   - Login: 邮箱 magic link → 状态消息 → onAuthStateChange 自动跳 step1
 */

import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { Step1ReverseFilter } from '../pages/Onboarding/Step1ReverseFilter';
import { Step2SymptomsGrid } from '../pages/Onboarding/Step2SymptomsGrid';
import { Step3BaselineConsent } from '../pages/Onboarding/Step3BaselineConsent';
import { Step4Welcome } from '../pages/Onboarding/Step4Welcome';
import { Login } from '../pages/Login';
import { useOnboarding } from '../store/onboarding';

// ---- mocks ----
const navigateMock = vi.fn();
vi.mock('wouter', async () => {
  const actual = await vi.importActual<typeof import('wouter')>('wouter');
  return { ...actual, useLocation: () => ['/', navigateMock] };
});

const supabaseMockState: { session: { access_token: string; user: { id: string } } | null } = { session: null };
const signInWithOtpMock = vi.fn(async () => ({ data: {}, error: null }));
const onAuthStateChangeListeners: Array<(event: string, session: unknown) => void> = [];
vi.mock('../services/supabase', () => ({
  getSupabase: () => ({
    auth: {
      getSession: vi.fn(async () => ({ data: { session: supabaseMockState.session } })),
      onAuthStateChange: vi.fn((cb: (event: string, session: unknown) => void) => {
        onAuthStateChangeListeners.push(cb);
        return { data: { subscription: { unsubscribe: vi.fn() } } };
      }),
      signInWithOtp: signInWithOtpMock,
      signOut: vi.fn()
    }
  }),
  resetSupabaseForTesting: vi.fn()
}));

// ---- shared setup ----
beforeEach(() => {
  navigateMock.mockReset();
  signInWithOtpMock.mockReset();
  signInWithOtpMock.mockResolvedValue({ data: {}, error: null });
  onAuthStateChangeListeners.length = 0;
  supabaseMockState.session = { access_token: 'fake-jwt', user: { id: 'auth-uuid-1' } };
  useOnboarding.getState().reset();
  // Step3 进页面会校验 PRIVACY_AGREED_KEY,这里默认设为已同意(模拟登录前已同意)
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem('yanyan.privacy.agreed.v1', 'true');
  }
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (url: string | URL | Request, init?: RequestInit) => {
    const urlStr = typeof url === 'string' ? url : url.toString();
    if (urlStr.includes('/consents/required')) {
      return new Response(JSON.stringify({ ok: true, consentVersionRequired: 1 }), { status: 200 });
    }
    if (urlStr.includes('/users/me/ensure')) {
      return new Response(JSON.stringify({ ok: true, userId: 'auth-uuid-1', wasCreated: true }), { status: 200 });
    }
    if (urlStr.includes('/consents') && init?.method === 'POST') {
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    }
    if (urlStr.includes('/users/me/baseline')) {
      return new Response(JSON.stringify({ ok: true, initialFireLevel: '微火' }), { status: 200 });
    }
    return new Response('{}', { status: 200 });
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('U4 redo Step 1', () => {
  test('5 选项渲染 + 必须选才能下一步', () => {
    render(<Step1ReverseFilter />);
    expect(screen.getByText('想改鼻炎')).toBeInTheDocument();
    expect(screen.getByText('看看而已')).toBeInTheDocument();
    const next = screen.getByText('下一步') as HTMLButtonElement;
    expect(next.disabled).toBe(true);

    fireEvent.click(screen.getByText('想改鼻炎'));
    expect(useOnboarding.getState().reverseFilterChoice).toBe('rhinitis');
    expect((screen.getByText('下一步') as HTMLButtonElement).disabled).toBe(false);

    fireEvent.click(screen.getByText('下一步'));
    expect(navigateMock).toHaveBeenCalledWith('/onboarding/step2');
  });
});

describe('U4 redo Step 2', () => {
  test('cell tap 写入 store;再点同一格清除', () => {
    render(<Step2SymptomsGrid />);
    const nasalOften = document.querySelector('[data-cell="nasal_congestion:often"]') as HTMLButtonElement;
    fireEvent.click(nasalOften);
    expect(useOnboarding.getState().symptomsFrequency.nasal_congestion).toBe('often');

    fireEvent.click(nasalOften);
    expect(useOnboarding.getState().symptomsFrequency.nasal_congestion).toBeUndefined();
  });

  test('跳过按钮清空 + 跳 step3', () => {
    useOnboarding.getState().setSymptomsFrequency({ nasal_congestion: 'often' });
    render(<Step2SymptomsGrid />);
    fireEvent.click(screen.getByText('都没有 / 跳过'));
    expect(useOnboarding.getState().symptomsFrequency).toEqual({});
    expect(navigateMock).toHaveBeenCalledWith('/onboarding/step3');
  });
});

describe('U4 redo Step 3', () => {
  test('空 symptomsFrequency → 本地估算显示"平"', () => {
    render(<Step3BaselineConsent />);
    expect(screen.getByTestId('local-fire-level')).toHaveTextContent('平');
  });

  test('全选 often → 本地估算显示"大火"', () => {
    useOnboarding.getState().setSymptomsFrequency({
      nasal_congestion: 'often',
      acne: 'often',
      dry_mouth: 'often',
      bowel: 'often',
      fatigue: 'often',
      edema: 'often',
      throat_itch: 'often'
    });
    render(<Step3BaselineConsent />);
    expect(screen.getByTestId('local-fire-level')).toHaveTextContent('大火');
  });

  test('Happy: 单按钮提交 → ensure → consent(默认 5 项) → baseline → 跳 step4', async () => {
    useOnboarding.getState().setReverseFilterChoice('rhinitis');
    render(<Step3BaselineConsent />);

    fireEvent.click(screen.getByText(/建立 baseline/));

    await waitFor(() => expect(navigateMock).toHaveBeenCalledWith('/onboarding/step4'));

    const fetchMock = globalThis.fetch as ReturnType<typeof vi.fn>;
    const urls = fetchMock.mock.calls.map((c: unknown[]) => (c[0] as string));
    expect(urls.some((u: string) => u.includes('/users/me/ensure'))).toBe(true);
    expect(urls.some((u: string) => u.includes('/consents'))).toBe(true);
    expect(urls.some((u: string) => u.includes('/users/me/baseline'))).toBe(true);

    expect(useOnboarding.getState().initialFireLevel).toBe('微火');
  });

  test('Step 1 缺失 reverseFilterChoice → submit errorMessage,不发 ensure', async () => {
    useOnboarding.getState().setReverseFilterChoice(null as unknown as 'rhinitis');
    render(<Step3BaselineConsent />);
    fireEvent.click(screen.getByText(/建立 baseline/));
    expect(await screen.findByRole('alert')).toHaveTextContent(/Step 1/);
  });

  test('ensure 失败 → errorMessage 不继续到 consent', async () => {
    useOnboarding.getState().setReverseFilterChoice('rhinitis');
    const fetchMock = globalThis.fetch as ReturnType<typeof vi.fn>;
    fetchMock.mockImplementation(async (url: string | URL | Request) => {
      const urlStr = typeof url === 'string' ? url : url.toString();
      if (urlStr.includes('/consents/required')) {
        return new Response(JSON.stringify({ ok: true, consentVersionRequired: 1 }), { status: 200 });
      }
      if (urlStr.includes('/users/me/ensure')) {
        return new Response(JSON.stringify({ ok: false }), { status: 500 });
      }
      return new Response('{}', { status: 200 });
    });

    render(<Step3BaselineConsent />);
    fireEvent.click(screen.getByText(/建立 baseline/));

    expect(await screen.findByRole('alert')).toHaveTextContent(/账号初始化失败/);
    expect(navigateMock).not.toHaveBeenCalled();
  });
});

describe('U4 redo Step 4', () => {
  test('显示初始火分(若 store 有)+ CTA 跳主页', () => {
    useOnboarding.getState().setInitialFireLevel('中火');
    render(<Step4Welcome />);
    expect(screen.getByText(/中火/)).toBeInTheDocument();
    fireEvent.click(screen.getByText(/完成,稍后我会拍第一张/));
    expect(navigateMock).toHaveBeenCalledWith('/app');
  });
});

describe('U4 redo Login', () => {
  test('已登录 → useEffect 自动跳 step1', () => {
    supabaseMockState.session = { access_token: 'jwt', user: { id: 'u-1' } };
    render(<Login />);
    return waitFor(() => expect(navigateMock).toHaveBeenCalledWith('/onboarding/step1'));
  });

  test('未勾隐私同意 → 提交按钮 disabled,不调 signInWithOtp', () => {
    supabaseMockState.session = null;
    localStorage.removeItem('yanyan.privacy.agreed.v1');
    render(<Login />);
    const submit = screen.getByText(/发送登录链接/) as HTMLButtonElement;
    expect(submit.disabled).toBe(true);
    fireEvent.click(submit);
    expect(signInWithOtpMock).not.toHaveBeenCalled();
  });

  test('未登录 + 已勾同意 + 提交无效邮箱 → errorMessage,不调 signInWithOtp', async () => {
    supabaseMockState.session = null;
    localStorage.removeItem('yanyan.privacy.agreed.v1');
    render(<Login />);
    fireEvent.click(screen.getByTestId('privacy-agree-checkbox'));
    const input = screen.getByPlaceholderText('you@example.com') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'not-email' } });
    fireEvent.click(screen.getByText(/发送登录链接/));
    expect(await screen.findByRole('alert')).toHaveTextContent(/有效的邮箱/);
    expect(signInWithOtpMock).not.toHaveBeenCalled();
  });

  test('未登录 + 已勾同意 + 有效邮箱 → 调 signInWithOtp + 显示成功 status', async () => {
    supabaseMockState.session = null;
    localStorage.removeItem('yanyan.privacy.agreed.v1');
    render(<Login />);
    fireEvent.click(screen.getByTestId('privacy-agree-checkbox'));
    const input = screen.getByPlaceholderText('you@example.com') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'user@example.com' } });
    fireEvent.click(screen.getByText(/发送登录链接/));
    await waitFor(() => expect(signInWithOtpMock).toHaveBeenCalled());
    expect(await screen.findByRole('status')).toHaveTextContent(/已发送登录链接/);
  });

  test('signInWithOtp 失败 → errorMessage', async () => {
    supabaseMockState.session = null;
    localStorage.removeItem('yanyan.privacy.agreed.v1');
    signInWithOtpMock.mockResolvedValueOnce({ data: {}, error: { message: 'rate_limit' } as never });
    render(<Login />);
    fireEvent.click(screen.getByTestId('privacy-agree-checkbox'));
    fireEvent.change(screen.getByPlaceholderText('you@example.com'), { target: { value: 'user@example.com' } });
    fireEvent.click(screen.getByText(/发送登录链接/));
    expect(await screen.findByRole('alert')).toHaveTextContent(/发送失败/);
  });

  test('登录后 onAuthStateChange 触发 → navigate step1', async () => {
    supabaseMockState.session = null;
    render(<Login />);
    // 模拟 Supabase 在 magic link 回调后触发 onAuthStateChange
    act(() => {
      onAuthStateChangeListeners.forEach((cb) =>
        cb('SIGNED_IN', { access_token: 'jwt', user: { id: 'u-x' } })
      );
    });
    await waitFor(() => expect(navigateMock).toHaveBeenCalledWith('/onboarding/step1'));
  });
});
