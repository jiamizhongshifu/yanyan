/**
 * In-app 兜底提醒 banner(Phase 2 U9)
 *
 * 显示场景:Home 主屏 / 主流程顶部
 * 用户行为:点击 → 跳到 url(如 /check-in/step1)+ dismiss;关闭 → 仅 dismiss
 */

import { useEffect, useState } from 'react';
import { useLocation } from 'wouter';
import { dismissReminder, fetchPendingReminders, type InappReminder } from '../services/inappReminders';

export function InappRemindersBanner() {
  const [reminders, setReminders] = useState<InappReminder[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [, navigate] = useLocation();

  useEffect(() => {
    let mounted = true;
    void fetchPendingReminders().then((r) => {
      if (!mounted) return;
      setReminders(r);
      setLoaded(true);
    });
    return () => {
      mounted = false;
    };
  }, []);

  if (!loaded || reminders.length === 0) return null;

  const onAct = async (rem: InappReminder) => {
    setReminders((cur) => cur.filter((r) => r.id !== rem.id));
    void dismissReminder(rem.id);
    if (rem.url) navigate(rem.url);
  };

  const onClose = async (rem: InappReminder) => {
    setReminders((cur) => cur.filter((r) => r.id !== rem.id));
    void dismissReminder(rem.id);
  };

  return (
    <div className="space-y-2 mb-3" data-testid="inapp-reminders">
      {reminders.map((r) => (
        <div
          key={r.id}
          className="rounded-2xl bg-fire-mid/10 border border-fire-mid/20 px-4 py-3 flex items-start gap-3"
          data-testid={`inapp-reminder-${r.kind}`}
        >
          <div className="flex-1">
            <p className="text-sm font-medium text-ink">{r.title}</p>
            <p className="mt-0.5 text-xs text-ink/70">{r.body}</p>
          </div>
          {r.url && (
            <button
              type="button"
              onClick={() => onAct(r)}
              className="shrink-0 px-3 py-1 rounded-full bg-ink text-white text-xs"
              data-testid={`reminder-act-${r.id}`}
            >
              去打卡
            </button>
          )}
          <button
            type="button"
            onClick={() => onClose(r)}
            className="shrink-0 text-ink/30 text-xl leading-none"
            aria-label="关闭"
            data-testid={`reminder-close-${r.id}`}
          >
            ×
          </button>
        </div>
      ))}
    </div>
  );
}
