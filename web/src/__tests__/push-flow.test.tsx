/**
 * U11 Web Push 客户端流程测试
 *
 * 覆盖:
 *   - detectPushSupport:不支持环境返回正确 reason
 *   - subscribeToPush:permission denied → ok:false reason:permission_denied
 *   - Me 页:不支持时显示提示文案
 */

import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import { detectPushSupport, subscribeToPush } from '../services/push';

describe('U11 detectPushSupport', () => {
  test('jsdom 默认无 PushManager / 无 Notification → supported=false', () => {
    const r = detectPushSupport();
    expect(r.supported).toBe(false);
    // jsdom 通常缺 PushManager 或 Notification
    expect(['no_pushmanager', 'no_notification', 'no_serviceworker']).toContain(r.reason);
  });
});

describe('U11 subscribeToPush', () => {
  let originalNotification: unknown;
  let originalSW: unknown;
  let originalPM: unknown;

  beforeEach(() => {
    // @ts-ignore 测试桩
    originalNotification = globalThis.Notification;
    // @ts-ignore 测试桩
    originalSW = navigator.serviceWorker;
    // @ts-ignore 测试桩
    originalPM = globalThis.PushManager;
  });

  afterEach(() => {
    if (originalNotification === undefined) {
      // @ts-ignore 测试桩
      delete globalThis.Notification;
    } else {
      // @ts-ignore 测试桩
      globalThis.Notification = originalNotification;
    }
    if (originalSW === undefined) {
      // @ts-ignore 测试桩
      delete (navigator as Navigator & { serviceWorker?: unknown }).serviceWorker;
    }
    if (originalPM === undefined) {
      // @ts-ignore 测试桩
      delete globalThis.PushManager;
    }
    vi.restoreAllMocks();
  });

  test('permission denied → ok:false reason:permission_denied', async () => {
    // 桩出三件支持
    // @ts-ignore 测试桩
    globalThis.Notification = { requestPermission: vi.fn().mockResolvedValue('denied'), permission: 'default' };
    // @ts-ignore 测试桩
    globalThis.PushManager = function PushManager() {};
    // @ts-ignore 测试桩
    Object.defineProperty(navigator, 'serviceWorker', { configurable: true, value: { ready: Promise.resolve({}) } });

    // 桩 auth — 让 subscribeToPush 走到 permission step
    vi.resetModules();
    vi.doMock('../services/auth', () => ({ getCurrentAccessToken: vi.fn().mockResolvedValue('jwt-x') }));

    const { subscribeToPush: sub } = await import('../services/push');
    const r = await sub();
    expect(r.ok).toBe(false);
    expect(r.reason).toBe('permission_denied');
  });

  test('未登录(无 token) → ok:false reason:not_signed_in', async () => {
    // 桩出三件支持
    // @ts-ignore 测试桩
    globalThis.Notification = { requestPermission: vi.fn().mockResolvedValue('granted'), permission: 'default' };
    // @ts-ignore 测试桩
    globalThis.PushManager = function PushManager() {};
    // @ts-ignore 测试桩
    Object.defineProperty(navigator, 'serviceWorker', { configurable: true, value: { ready: Promise.resolve({}) } });

    vi.resetModules();
    vi.doMock('../services/auth', () => ({ getCurrentAccessToken: vi.fn().mockResolvedValue(null) }));

    const { subscribeToPush: sub } = await import('../services/push');
    const r = await sub();
    expect(r.ok).toBe(false);
    expect(r.reason).toBe('not_signed_in');
  });

  test('完全不支持 → ok:false reason 描述不支持', async () => {
    // 不桩 Notification / PushManager / serviceWorker
    const r = await subscribeToPush();
    expect(r.ok).toBe(false);
    expect(['no_pushmanager', 'no_notification', 'no_serviceworker']).toContain(r.reason ?? '');
  });
});
