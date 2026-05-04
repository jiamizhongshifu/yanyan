/**
 * U12 客户端埋点 tracker 测试
 *
 * 覆盖:
 *   - track() 入队 localStorage
 *   - flush() 未登录(无 token)→ 不上传,事件保留队列
 *   - flush() 成功 → 队列清空 + POST /events 一次
 *   - flush() server 失败 → 队列保留
 *   - 队列上限 200(超出截断)
 */

import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';

const QUEUE_KEY = 'yanyan.tracker.queue.v1';

beforeEach(() => {
  vi.resetModules();
  localStorage.clear();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('U12 tracker', () => {
  test('track() 入队 localStorage', async () => {
    vi.doMock('../services/auth', () => ({ getCurrentAccessToken: vi.fn().mockResolvedValue(null) }));
    vi.doMock('../services/api', () => ({ request: vi.fn() }));
    const { track } = await import('../services/tracker');
    track('photo_uploaded', { foo: 1 });
    const raw = localStorage.getItem(QUEUE_KEY);
    expect(raw).not.toBeNull();
    const q = JSON.parse(raw!);
    expect(q).toHaveLength(1);
    expect(q[0].eventName).toBe('photo_uploaded');
    expect(q[0].payload).toEqual({ foo: 1 });
    expect(q[0].clientOccurredAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  test('flush() 未登录 → 不上传,事件保留队列', async () => {
    const requestSpy = vi.fn();
    vi.doMock('../services/auth', () => ({ getCurrentAccessToken: vi.fn().mockResolvedValue(null) }));
    vi.doMock('../services/api', () => ({ request: requestSpy }));
    const { track, flush } = await import('../services/tracker');
    track('photo_uploaded');
    await flush();
    expect(requestSpy).not.toHaveBeenCalled();
    const q = JSON.parse(localStorage.getItem(QUEUE_KEY)!);
    expect(q).toHaveLength(1);
  });

  test('flush() 成功 → 队列清空 + POST /events 一次', async () => {
    const requestSpy = vi.fn().mockResolvedValue({ ok: true, status: 200, data: { ok: true } });
    vi.doMock('../services/auth', () => ({ getCurrentAccessToken: vi.fn().mockResolvedValue('jwt-x') }));
    vi.doMock('../services/api', () => ({ request: requestSpy }));
    const { track, flush } = await import('../services/tracker');
    track('photo_uploaded');
    track('checkin_step1_complete');
    await flush();
    // track() 内部也会异步触发 flush — 等微任务清完
    await new Promise((r) => setTimeout(r, 10));
    expect(requestSpy.mock.calls.length).toBeGreaterThanOrEqual(1);
    const totalUploaded = requestSpy.mock.calls.reduce(
      (sum, c) => sum + (c[0].data.events?.length ?? 0),
      0
    );
    expect(totalUploaded).toBeGreaterThanOrEqual(2);
    const firstCall = requestSpy.mock.calls[0][0];
    expect(firstCall.url).toBe('/events');
    expect(firstCall.method).toBe('POST');
    expect(firstCall.authToken).toBe('jwt-x');
    expect(localStorage.getItem(QUEUE_KEY)).toBe('[]');
  });

  test('flush() server 失败 → 队列保留', async () => {
    const requestSpy = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      error: 'http_500',
      fallbackMessage: '服务忙'
    });
    vi.doMock('../services/auth', () => ({ getCurrentAccessToken: vi.fn().mockResolvedValue('jwt-x') }));
    vi.doMock('../services/api', () => ({ request: requestSpy }));
    const { track, flush } = await import('../services/tracker');
    track('photo_uploaded');
    await flush();
    const q = JSON.parse(localStorage.getItem(QUEUE_KEY)!);
    expect(q).toHaveLength(1);
  });

  test('队列上限 200 — 写入会截断到最后 200 条', async () => {
    vi.doMock('../services/auth', () => ({ getCurrentAccessToken: vi.fn().mockResolvedValue(null) }));
    vi.doMock('../services/api', () => ({ request: vi.fn() }));
    const { track } = await import('../services/tracker');
    for (let i = 0; i < 250; i++) track('photo_uploaded', { i });
    const q = JSON.parse(localStorage.getItem(QUEUE_KEY)!);
    expect(q).toHaveLength(200);
    // 截断保留尾部 — 第一条 i 应 = 50
    expect(q[0].payload.i).toBe(50);
    expect(q[199].payload.i).toBe(249);
  });
});
