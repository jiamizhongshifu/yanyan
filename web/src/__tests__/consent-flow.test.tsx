/**
 * U3 redo:Consent 页交互测试
 *
 * 对应 plan U3 测试场景(React 版):
 *   - Initial: 5 scope 全部 unchecked
 *   - Edge: 不勾选直接 submit → errorMessage,无网络调用
 *   - Edge: 部分勾选 → errorMessage
 *   - Happy: 全勾 → POST 成功 → navigate '/'
 *   - Network: POST 失败 → errorMessage,不 navigate
 */

import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { Consent } from '../pages/Consent';

// Mock Supabase auth (返回 access token)
vi.mock('../services/supabase', () => ({
  getSupabase: () => ({
    auth: {
      getSession: vi.fn(async () => ({ data: { session: { access_token: 'fake-jwt-abc' } } })),
      onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
      signOut: vi.fn()
    }
  }),
  resetSupabaseForTesting: vi.fn()
}));

// Mock wouter useLocation 给 navigate 钩
const navigateMock = vi.fn();
vi.mock('wouter', async () => {
  const actual = await vi.importActual<typeof import('wouter')>('wouter');
  return {
    ...actual,
    useLocation: () => ['/', navigateMock]
  };
});

describe('U3 web Consent page', () => {
  beforeEach(() => {
    navigateMock.mockReset();
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (url: string | URL | Request) => {
      const urlStr = typeof url === 'string' ? url : url.toString();
      if (urlStr.includes('/consents/required')) {
        return new Response(JSON.stringify({ ok: true, consentVersionRequired: 1 }), { status: 200 });
      }
      return new Response('{}', { status: 200 });
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  test('renders 5 scope checkboxes, all initially unchecked', async () => {
    render(<Consent />);
    const cbs = await screen.findAllByRole('checkbox');
    expect(cbs).toHaveLength(5);
    for (const cb of cbs) expect(cb).not.toBeChecked();
  });

  test('Edge: submit without checking shows errorMessage, no POST', async () => {
    render(<Consent />);
    await screen.findAllByRole('checkbox');
    fireEvent.click(screen.getByText(/我已阅读并同意/));
    expect(await screen.findByRole('alert')).toHaveTextContent(/5 项均需勾选/);
    // fetch 应只被调用一次(GET /consents/required),没有 POST
    const fetchMock = globalThis.fetch as ReturnType<typeof vi.fn>;
    const postCalls = fetchMock.mock.calls.filter((c: unknown[]) => {
      const init = c[1] as RequestInit | undefined;
      return init?.method === 'POST';
    });
    expect(postCalls).toHaveLength(0);
  });

  test('Edge: partial check (3/5) → errorMessage, no POST', async () => {
    render(<Consent />);
    const cbs = await screen.findAllByRole('checkbox');
    fireEvent.click(cbs[0]);
    fireEvent.click(cbs[1]);
    fireEvent.click(cbs[2]);
    fireEvent.click(screen.getByText(/我已阅读并同意/));
    expect(await screen.findByRole('alert')).toHaveTextContent(/5 项均需勾选/);
  });

  test('Happy: all 5 checked → POST with JWT → navigate /', async () => {
    const fetchMock = globalThis.fetch as ReturnType<typeof vi.fn>;
    fetchMock.mockImplementation(async (url: string | URL | Request, init?: RequestInit) => {
      const urlStr = typeof url === 'string' ? url : url.toString();
      if (urlStr.includes('/consents/required')) {
        return new Response(JSON.stringify({ ok: true, consentVersionRequired: 1 }), { status: 200 });
      }
      if (urlStr.includes('/consents') && init?.method === 'POST') {
        return new Response(JSON.stringify({ ok: true }), { status: 200 });
      }
      return new Response('{}', { status: 200 });
    });

    render(<Consent />);
    const cbs = await screen.findAllByRole('checkbox');
    cbs.forEach((cb) => fireEvent.click(cb));

    fireEvent.click(screen.getByText(/我已阅读并同意/));

    await waitFor(() => expect(navigateMock).toHaveBeenCalledWith('/'));

    // 验证 POST 调用带 JWT + 5 个 scopes + version
    const postCall = fetchMock.mock.calls.find((c: unknown[]) => {
      const init = c[1] as RequestInit | undefined;
      return init?.method === 'POST';
    });
    expect(postCall).toBeDefined();
    const init = postCall![1] as RequestInit;
    const headers = init.headers as Record<string, string>;
    expect(headers['Authorization']).toBe('Bearer fake-jwt-abc');
    const body = JSON.parse(init.body as string);
    expect(body.scopes).toHaveLength(5);
    expect(body.consentVersion).toBe(1);
  });

  test('Network failure on POST → errorMessage, no navigate', async () => {
    const fetchMock = globalThis.fetch as ReturnType<typeof vi.fn>;
    fetchMock.mockImplementation(async (url: string | URL | Request, init?: RequestInit) => {
      const urlStr = typeof url === 'string' ? url : url.toString();
      if (urlStr.includes('/consents/required')) {
        return new Response(JSON.stringify({ ok: true, consentVersionRequired: 1 }), { status: 200 });
      }
      if (init?.method === 'POST') {
        throw new TypeError('Failed to fetch');
      }
      return new Response('{}', { status: 200 });
    });

    render(<Consent />);
    const cbs = await screen.findAllByRole('checkbox');
    cbs.forEach((cb) => fireEvent.click(cb));
    fireEvent.click(screen.getByText(/我已阅读并同意/));

    expect(await screen.findByRole('alert')).toHaveTextContent(/提交失败/);
    expect(navigateMock).not.toHaveBeenCalled();
  });
});
