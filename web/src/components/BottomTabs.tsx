/**
 * 3 tab 底部导航 — Grow App 结构:今天 / 身体 / 洞悉
 *
 * 拍照 / 个人 / 易诱炎食物 详情等都从主页内嵌入口跳转,不占 tab 槽位。
 */

import { Link, useLocation } from 'wouter';

const TABS: Array<{ key: string; label: string; href: string; icon: string; matchPrefix: string; exact?: boolean }> = [
  { key: 'today', label: '今天', href: '/app', icon: '☀', matchPrefix: '/app', exact: true },
  { key: 'body', label: '身体', href: '/app/body', icon: '◐', matchPrefix: '/app/body' },
  { key: 'insights', label: '洞悉', href: '/app/insights', icon: '✦', matchPrefix: '/app/insights' }
];

export function BottomTabs() {
  const [location] = useLocation();
  return (
    <nav
      className="fixed bottom-0 inset-x-0 z-30 bg-white/90 backdrop-blur border-t border-ink/10"
      data-testid="bottom-tabs"
    >
      <ul className="flex max-w-md mx-auto">
        {TABS.map((t) => {
          const active = t.exact ? location === t.matchPrefix : location.startsWith(t.matchPrefix);
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
      <div className="h-[env(safe-area-inset-bottom)]" />
    </nav>
  );
}
