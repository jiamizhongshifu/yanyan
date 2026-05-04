/**
 * 4 tab 底部导航(plan U10):首页 / 拍照 / 发物 / 我的
 *
 * 拍照 tab 直接 navigate /camera(不 nest 在 tab 容器内,避免拍照页底部摩擦)
 */

import { Link, useLocation } from 'wouter';

const TABS: Array<{ key: string; label: string; href: string; icon: string; matchPrefix: string }> = [
  { key: 'home', label: '首页', href: '/app', icon: '·', matchPrefix: '/app' },
  { key: 'camera', label: '拍照', href: '/camera', icon: '○', matchPrefix: '/camera' },
  { key: 'findings', label: '发物', href: '/findings', icon: '⚆', matchPrefix: '/findings' },
  { key: 'me', label: '我的', href: '/me', icon: '◆', matchPrefix: '/me' }
];

export function BottomTabs() {
  const [location] = useLocation();
  return (
    <nav className="fixed bottom-0 inset-x-0 z-30 bg-white/90 backdrop-blur border-t border-ink/10" data-testid="bottom-tabs">
      <ul className="flex max-w-3xl mx-auto">
        {TABS.map((t) => {
          const active =
            t.matchPrefix === '/app'
              ? location === '/app' || location.startsWith('/app/')
              : location.startsWith(t.matchPrefix);
          return (
            <li key={t.key} className="flex-1">
              <Link
                href={t.href}
                className={`flex flex-col items-center py-2.5 text-xs ${
                  active ? 'text-ink' : 'text-ink/40'
                }`}
                aria-current={active ? 'page' : undefined}
                data-testid={`tab-${t.key}`}
              >
                <span className="text-base">{t.icon}</span>
                <span>{t.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
      {/* 底部安全区占位 */}
      <div className="h-[env(safe-area-inset-bottom)]" />
    </nav>
  );
}
