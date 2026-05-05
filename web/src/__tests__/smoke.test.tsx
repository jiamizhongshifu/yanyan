/**
 * U1-redo smoke:验证 PWA 工程框架最小可启动 + API wrapper 网络降级
 *
 * 测试点(对应 plan U1 测试场景的 H5 版本):
 *   - Happy path: <App /> 渲染首页 → 标题 "Soak" 出现
 *   - Edge case: fetch 失败 → 返回降级文案"网络不通,请检查后重试"
 *   - Edge case: 5xx → 返回"服务忙,请稍后再试"
 *   - Edge case: timeout → 返回"请求超时,请检查网络后重试"
 */

import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { App } from '../App';
import { request } from '../services/api';

describe('U1 web smoke', () => {
  test('App renders Soak brand somewhere(任一路径)', () => {
    // U10 后路由结构变了:/ 受 RequireAuth 保护;无 session 时 RequireAuth 显示 loading 或重定向 login
    // smoke test 只断言 React 树能正常 mount(找品牌名,Login / Home / 未授权 loading 任一路径都包含)
    render(<App />);
    expect(screen.queryAllByText(/Soak|加载中|控糖/).length).toBeGreaterThan(0);
  });
});

describe('U1 web api wrapper', () => {
  beforeEach(() => {
    vi.spyOn(globalThis, 'fetch');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  test('happy path: 200 returns ok=true with data', async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      new Response(JSON.stringify({ ok: true, foo: 'bar' }), { status: 200 })
    );
    const res = await request<{ ok: true; foo: string }>({ url: '/health' });
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.data.foo).toBe('bar');
  });

  test('edge case: network failure returns user-friendly fallback', async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new TypeError('Failed to fetch'));
    const res = await request({ url: '/health' });
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.fallbackMessage).toBe('网络不通,请检查后重试');
      expect(res.status).toBe(0);
    }
  });

  test('edge case: 5xx returns 服务忙 fallback', async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      new Response(JSON.stringify({ error: 'overloaded' }), { status: 503 })
    );
    const res = await request({ url: '/health' });
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.fallbackMessage).toBe('服务忙,请稍后再试');
      expect(res.status).toBe(503);
    }
  });

  test('edge case: 4xx returns 请求异常 fallback', async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      new Response(JSON.stringify({ error: 'bad request' }), { status: 400 })
    );
    const res = await request({ url: '/health' });
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.fallbackMessage).toBe('请求异常,请稍后再试');
    }
  });

  test('edge case: timeout via AbortController returns user-friendly fallback', async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockImplementationOnce((_url: string, init: RequestInit) => {
      return new Promise((_resolve, reject) => {
        init.signal?.addEventListener('abort', () => {
          const err = new Error('aborted');
          err.name = 'AbortError';
          reject(err);
        });
      });
    });
    const res = await request({ url: '/slow', timeoutMs: 50 });
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.error).toBe('timeout');
      expect(res.fallbackMessage).toBe('请求超时,请检查网络后重试');
    }
  });

  test('authToken header is added when present', async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      new Response(JSON.stringify({}), { status: 200 })
    );
    await request({ url: '/me', authToken: 'jwt-abc' });
    const callArgs = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    const init = callArgs[1] as RequestInit;
    const headers = init.headers as Record<string, string>;
    expect(headers['Authorization']).toBe('Bearer jwt-abc');
  });
});
