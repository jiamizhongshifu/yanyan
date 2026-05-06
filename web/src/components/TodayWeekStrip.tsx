/**
 * Today 顶部 7 天日期条(类 Grow App 风格)
 *
 * 显示 [today-3 ... today ... today+3] 7 个日期。每天:
 *   - 数字(今天加粗 + 圆形深色背景)
 *   - 橘子图标:已拿到勋章 → tier-* 实心橘子;过去未拿 → 空心橘子;未来 → 浅色空心橘子
 *
 * 数据源:daysHistory(同 MonthCalendarGrid)。今天若有 tier 则用今天的 tier 着色。
 */

import { useMemo } from 'react';
import type { DayTier } from '../services/challenges';
import { asset } from '../services/assets';

interface DayInfo {
  date: string;
  tier: DayTier;
}

interface Props {
  daysHistory?: DayInfo[];
  todayTier?: DayTier;
  todayDate?: Date;
}

const TIER_TO_ICON: Record<Exclude<DayTier, 'none'>, string> = {
  perfect: 'tier-perfect.png',
  great: 'tier-great.png',
  nice: 'tier-nice.png'
};

const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六'];

export function TodayWeekStrip({ daysHistory, todayTier = 'none', todayDate = new Date() }: Props) {
  const histByDate = useMemo(
    () => new Map((daysHistory ?? []).map((d) => [d.date, d.tier])),
    [daysHistory]
  );

  const cells = useMemo(() => {
    const today = new Date(todayDate.getFullYear(), todayDate.getMonth(), todayDate.getDate());
    const arr: Array<{ date: string; day: number; weekday: number; isPast: boolean; isToday: boolean; tier: DayTier }> = [];
    for (let offset = -3; offset <= 3; offset++) {
      const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() + offset);
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      const dateStr = `${yyyy}-${mm}-${dd}`;
      const isToday = offset === 0;
      const isPast = offset < 0;
      const tier = isToday ? todayTier : histByDate.get(dateStr) ?? 'none';
      arr.push({ date: dateStr, day: d.getDate(), weekday: d.getDay(), isPast, isToday, tier });
    }
    return arr;
  }, [histByDate, todayTier, todayDate]);

  const outlineSrc = asset('orange-outline.png');

  return (
    <div className="grid grid-cols-7 gap-1" data-testid="today-week-strip">
      {cells.map((c) => {
        const tierIcon = c.tier !== 'none' ? asset(TIER_TO_ICON[c.tier as keyof typeof TIER_TO_ICON]) : null;
        return (
          <div key={c.date} className="flex flex-col items-center gap-1">
            <span className="text-[10px] text-ink/40">{WEEKDAYS[c.weekday]}</span>
            <span
              className={`text-xs ${
                c.isToday
                  ? 'w-6 h-6 rounded-full bg-ink text-paper flex items-center justify-center font-medium'
                  : 'text-ink/65'
              }`}
            >
              {c.day}
            </span>
            <div className="w-7 h-7 flex items-center justify-center">
              {tierIcon ? (
                <img src={tierIcon} alt="" className="w-7 h-7 object-contain" />
              ) : (
                <img
                  src={outlineSrc}
                  alt=""
                  className={`w-6 h-6 object-contain ${c.isPast ? 'opacity-55' : 'opacity-30'}`}
                />
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
