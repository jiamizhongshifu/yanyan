/**
 * PWA 添加到主屏 banner — 监听 beforeinstallprompt 后弹出
 *
 * - Android Chrome 触发 beforeinstallprompt 事件,可调 prompt() 弹原生安装窗
 * - iOS Safari 不触发该事件,fallback 显示 banner 引导用户手动"分享 → 添加到主屏"
 *
 * 用户拒绝 / 安装后:写 localStorage 标记,7 天内不再弹
 */
import { useEffect, useState } from 'react';
import { asset } from '../services/assets';

const DISMISS_KEY = 'yanyan.install.dismissed.v1';
const DISMISS_DAYS = 7;

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

function recentlyDismissed(): boolean {
  if (typeof localStorage === 'undefined') return false;
  const v = localStorage.getItem(DISMISS_KEY);
  if (!v) return false;
  const ts = Number(v);
  if (!Number.isFinite(ts)) return false;
  return Date.now() - ts < DISMISS_DAYS * 24 * 60 * 60 * 1000;
}

function isStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  // matchMedia 在 jsdom 测试环境可能不存在
  const mm = typeof window.matchMedia === 'function'
    ? window.matchMedia('(display-mode: standalone)').matches
    : false;
  const ios = (window.navigator as unknown as { standalone?: boolean }).standalone === true;
  return mm || ios;
}

function isIos(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /iphone|ipad|ipod/i.test(navigator.userAgent) && !/CriOS|FxiOS/.test(navigator.userAgent);
}

export function InstallPrompt() {
  const [event, setEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [showIosTip, setShowIosTip] = useState(false);
  const [dismissed, setDismissed] = useState(() => recentlyDismissed() || isStandalone());

  useEffect(() => {
    if (dismissed) return;

    const handler = (e: Event) => {
      e.preventDefault();
      setEvent(e as BeforeInstallPromptEvent);
    };
    window.addEventListener('beforeinstallprompt', handler);

    // iOS:没有事件,延迟 5s 弹一次软提示
    let iosTimer: ReturnType<typeof setTimeout> | null = null;
    if (isIos() && !isStandalone()) {
      iosTimer = setTimeout(() => setShowIosTip(true), 5000);
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
      if (iosTimer) clearTimeout(iosTimer);
    };
  }, [dismissed]);

  const close = () => {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(DISMISS_KEY, String(Date.now()));
    }
    setEvent(null);
    setShowIosTip(false);
    setDismissed(true);
  };

  const install = async () => {
    if (!event) return;
    await event.prompt();
    const result = await event.userChoice;
    if (result.outcome === 'accepted' || result.outcome === 'dismissed') {
      close();
    }
  };

  if (dismissed || (!event && !showIosTip)) return null;

  return (
    <div
      className="fixed bottom-20 inset-x-3 z-50 rounded-2xl bg-white shadow-lg border border-ink/10 px-4 py-3 flex items-center gap-3"
      role="dialog"
      data-testid="install-prompt"
    >
      <img
        src={asset('install-banner.png')}
        alt=""
        className="w-14 h-14 object-contain flex-shrink-0"
      />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-ink">添加到主屏</p>
        <p className="mt-0.5 text-[11px] text-ink/55 leading-snug">
          {event ? '一键安装,以后从桌面图标直接打开' : '点击底部分享 → 添加到主屏幕'}
        </p>
      </div>
      {event ? (
        <button
          type="button"
          onClick={() => void install()}
          className="rounded-full bg-ink text-white px-4 py-1.5 text-xs font-medium flex-shrink-0"
        >
          安装
        </button>
      ) : null}
      <button
        type="button"
        onClick={close}
        className="text-ink/40 text-lg w-7 h-7 flex items-center justify-center flex-shrink-0"
        aria-label="关闭"
      >
        ×
      </button>
    </div>
  );
}
