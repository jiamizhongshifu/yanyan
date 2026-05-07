/**
 * 底部导航 — 5 位结构:今天 / 身体 / [📷 浮起拍照 FAB] / 洞悉 / 我的
 *
 * 中间的拍照按钮是 floating action button(浮起圆形,深底白图标),
 * 视觉上比四个 tab 高一截 — 强调"拍餐"是 app 的核心动作。
 *
 * 点击 FAB 跳到 /camera。
 */

import { Link, useLocation } from 'wouter';
import { Icon, type IconName } from './Icon';

/** 记录 FAB 拍照触发时所在的 tab,MealResult / Camera 完成后回到原 tab */
const CAMERA_FROM_KEY = 'yanyan.camera.fromTab';
function rememberFromTab(path: string) {
  if (typeof sessionStorage === 'undefined') return;
  // 只记 4 个主 tab,deep link 之外的不记
  if (['/app', '/app/body', '/app/insights', '/me'].includes(path)) {
    sessionStorage.setItem(CAMERA_FROM_KEY, path);
  }
}
export function consumeCameraFromTab(): string | null {
  if (typeof sessionStorage === 'undefined') return null;
  const v = sessionStorage.getItem(CAMERA_FROM_KEY);
  if (v) sessionStorage.removeItem(CAMERA_FROM_KEY);
  return v;
}

interface TabItem {
  key: string;
  label: string;
  href: string;
  icon: IconName;
  matchPrefix: string;
  /** 仅当 location 完全等于 matchPrefix 时高亮(避免 /app 被 /app/body 误触发) */
  exact?: boolean;
}

// 4 个普通 tab(左 2 + 右 2),中间留给 FAB
const LEFT_TABS: TabItem[] = [
  { key: 'today', label: '今天', href: '/app', icon: 'sun', matchPrefix: '/app', exact: true },
  { key: 'body', label: '身体', href: '/app/body', icon: 'body', matchPrefix: '/app/body' }
];
const RIGHT_TABS: TabItem[] = [
  { key: 'insights', label: '洞悉', href: '/app/insights', icon: 'sparkle', matchPrefix: '/app/insights' },
  { key: 'me', label: '我的', href: '/me', icon: 'user', matchPrefix: '/me' }
];

export function BottomTabs() {
  const [location] = useLocation();
  const cameraActive = location.startsWith('/camera');

  return (
    <nav
      className="fixed bottom-0 inset-x-0 z-30 bg-white/90 backdrop-blur border-t border-ink/10"
      data-testid="bottom-tabs"
    >
      <div className="relative max-w-md mx-auto">
        {/* 普通 tab(左 2 + 中间留空 + 右 2) */}
        <ul className="grid grid-cols-5 items-end">
          {LEFT_TABS.map((t) => (
            <TabLink key={t.key} item={t} location={location} />
          ))}
          {/* 中间空位,FAB 用 absolute 浮起 */}
          <li aria-hidden="true" />
          {RIGHT_TABS.map((t) => (
            <TabLink key={t.key} item={t} location={location} />
          ))}
        </ul>

        {/* 中间 FAB — 拍照按钮(点击时记录来源 tab,拍完回原 tab) */}
        <Link
          href="/camera"
          aria-label="拍餐"
          data-testid="tab-camera-fab"
          onClick={() => rememberFromTab(location)}
          className={`absolute left-1/2 -translate-x-1/2 -top-6 w-14 h-14 rounded-full bg-ink text-paper flex items-center justify-center shadow-lg shadow-ink/20 active:scale-95 transition-transform ${
            cameraActive ? 'ring-4 ring-fire-mid/40' : ''
          }`}
        >
          <Icon name="camera" className="w-6 h-6" />
        </Link>
      </div>
      <div className="h-[env(safe-area-inset-bottom)]" />
    </nav>
  );
}

function TabLink({ item, location }: { item: TabItem; location: string }) {
  const active = item.exact ? location === item.matchPrefix : location.startsWith(item.matchPrefix);
  return (
    <li>
      <Link
        href={item.href}
        className={`flex flex-col items-center py-2.5 text-xs ${active ? 'text-ink' : 'text-ink/30'}`}
        aria-current={active ? 'page' : undefined}
        data-testid={`tab-${item.key}`}
      >
        <Icon name={item.icon} className="w-5 h-5" />
        <span className="mt-0.5">{item.label}</span>
      </Link>
    </li>
  );
}
