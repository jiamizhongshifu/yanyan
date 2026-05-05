/**
 * 月历网格 — Grow App 洞悉页风格
 *
 * 7 列(周日 → 周六),每格一个等级太阳图标。
 * v1:用 cumulativeDays + 当日 level 推断已打卡的天数,未打卡显示空太阳。
 *      下版接 server 端"按日 level 历史"接口后做精确填色。
 */

import { useMemo } from 'react';
import { asset } from '../services/assets';
import type { FireLevel } from '../services/symptoms';

interface DayInfo {
  date: string; // YYYY-MM-DD
  tier: 'perfect' | 'great' | 'nice' | 'none';
  fireLevel: FireLevel | null;
}

interface Props {
  /** 当月内已打卡的累计天数(粗略 fallback,在 server 历史拿到前用) */
  cumulativeInMonth: number;
  /** 今日等级,用于高亮今天 */
  todayLevel: FireLevel | null;
  /** 月份基准日期(默认今天) */
  monthBase?: Date;
  /** 来自 server 的当月每日挑战快照 — 优先用这个着色 */
  daysHistory?: DayInfo[];
}

const TIER_COLOR: Record<DayInfo['tier'], string> = {
  perfect: 'bg-fire-mild/70',
  great: 'bg-fire-ping/45',
  nice: 'bg-ink/20',
  none: 'bg-ink/10'
};

const LEVEL_ICON_FILE: Record<FireLevel, string> = {
  平: 'level-ping.png',
  微火: 'level-weihuo.png',
  中火: 'level-zhonghuo.png',
  大火: 'level-dahuo.png'
};

export function MonthCalendarGrid({ cumulativeInMonth, todayLevel, monthBase = new Date(), daysHistory }: Props) {
  const historyByDate = new Map((daysHistory ?? []).map((d) => [d.date, d]));
  const cells = useMemo(() => {
    const year = monthBase.getFullYear();
    const month = monthBase.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startWeekday = firstDay.getDay(); // 0=Sun
    const totalDays = lastDay.getDate();
    const today = new Date();
    const isCurrentMonth = today.getFullYear() === year && today.getMonth() === month;
    const todayDate = today.getDate();

    type Cell = { day: number | null; isToday: boolean; isPast: boolean };
    const arr: Cell[] = [];
    for (let i = 0; i < startWeekday; i++) arr.push({ day: null, isToday: false, isPast: false });
    for (let d = 1; d <= totalDays; d++) {
      const isToday = isCurrentMonth && d === todayDate;
      const isPast = isCurrentMonth ? d < todayDate : new Date(year, month, d) < new Date(today.getFullYear(), today.getMonth(), today.getDate());
      arr.push({ day: d, isToday, isPast });
    }
    while (arr.length % 7 !== 0) arr.push({ day: null, isToday: false, isPast: false });
    return arr;
  }, [monthBase]);

  // 已打卡天的位置:从今天倒推 cumulativeInMonth 个 past day(粗略可视化)
  const checkedDays = useMemo(() => {
    const set = new Set<number>();
    const past = cells.filter((c) => c.day !== null && c.isPast).map((c) => c.day!);
    const tail = past.slice(-cumulativeInMonth);
    tail.forEach((d) => set.add(d));
    return set;
  }, [cells, cumulativeInMonth]);

  return (
    <section data-testid="month-calendar">
      <div className="grid grid-cols-7 gap-y-3 gap-x-1 mb-2 text-xs text-ink/45 text-center">
        {['周日', '周一', '周二', '周三', '周四', '周五', '周六'].map((d) => (
          <span key={d}>{d}</span>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-y-3 gap-x-1">
        {cells.map((c, i) => {
          if (c.day === null) return <div key={i} />;
          const dateStr = `${monthBase.getFullYear()}-${String(monthBase.getMonth() + 1).padStart(2, '0')}-${String(c.day).padStart(2, '0')}`;
          const hist = historyByDate.get(dateStr);
          const showTodayLevel = c.isToday && (hist?.fireLevel ?? todayLevel) !== null;
          const todayDisplayLevel = hist?.fireLevel ?? todayLevel;
          const isChecked = checkedDays.has(c.day);
          return (
            <div key={i} className="flex flex-col items-center gap-1">
              <span
                className={`text-[11px] ${
                  c.isToday ? 'text-fire-ping font-medium' : 'text-ink/55'
                }`}
              >
                {c.day}
              </span>
              <div
                className={`w-9 h-9 rounded-full flex items-center justify-center ${
                  c.isToday ? 'bg-ink/95' : 'bg-transparent'
                }`}
              >
                {showTodayLevel && todayDisplayLevel ? (
                  <img
                    src={asset(LEVEL_ICON_FILE[todayDisplayLevel])}
                    alt={todayDisplayLevel}
                    className="w-7 h-7 object-contain"
                  />
                ) : hist && hist.tier !== 'none' ? (
                  <div
                    className={`w-7 h-7 rounded-full ${TIER_COLOR[hist.tier]}`}
                    title={hist.tier}
                  />
                ) : isChecked ? (
                  <div className="w-7 h-7 rounded-full bg-ink/15" />
                ) : (
                  <div className="w-6 h-6 rounded-full border border-ink/15" />
                )}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
