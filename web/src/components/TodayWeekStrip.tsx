/**
 * Today 顶部 7 天日期条(类 Grow App 风格)
 *
 * 显示 [today-3 ... today ... today+3] 7 个日期。每天:
 *   - 数字(今天加粗 + 圆形深色背景)
 *   - 橘子图标(SVG 绘制,变体按 tier 决定):已拿到勋章 → tier 实色 / 过去未拿 → 空心 / 未来 → 浅空心
 */

import { useMemo } from 'react';
import type { DayTier } from '../services/challenges';
import { OrangeIcon, type OrangeVariant } from './OrangeIcon';

interface DayInfo {
  date: string;
  tier: DayTier;
}

interface Props {
  daysHistory?: DayInfo[];
  todayTier?: DayTier;
  todayDate?: Date;
}

const TIER_TO_VARIANT: Record<Exclude<DayTier, 'none'>, OrangeVariant> = {
  perfect: 'perfect',
  great: 'great',
  nice: 'nice'
};

export function TodayWeekStrip({ daysHistory, todayTier = 'none', todayDate = new Date() }: Props) {
  const histByDate = useMemo(
    () => new Map((daysHistory ?? []).map((d) => [d.date, d.tier])),
    [daysHistory]
  );

  const cells = useMemo(() => {
    const today = new Date(todayDate.getFullYear(), todayDate.getMonth(), todayDate.getDate());
    const arr: Array<{ date: string; day: number; isPast: boolean; isToday: boolean; tier: DayTier }> = [];
    for (let offset = -3; offset <= 3; offset++) {
      const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() + offset);
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      const dateStr = `${yyyy}-${mm}-${dd}`;
      const isToday = offset === 0;
      const isPast = offset < 0;
      const tier = isToday ? todayTier : histByDate.get(dateStr) ?? 'none';
      arr.push({ date: dateStr, day: d.getDate(), isPast, isToday, tier });
    }
    return arr;
  }, [histByDate, todayTier, todayDate]);

  return (
    <div className="grid grid-cols-7 gap-1" data-testid="today-week-strip">
      {cells.map((c) => {
        // tier 决定金/银/铜;无 tier 时:过去 + 今日 → gray(灰填充);未来 → outline(空心)
        const variant: OrangeVariant =
          c.tier !== 'none'
            ? TIER_TO_VARIANT[c.tier as keyof typeof TIER_TO_VARIANT]
            : c.isPast || c.isToday
            ? 'gray'
            : 'outline';
        return (
          <div key={c.date} className="flex flex-col items-center gap-1.5">
            {/* 日期 — 固定 24×24 高度,所有 cell 视觉等高 */}
            <div
              className={`w-6 h-6 rounded-full flex items-center justify-center text-xs ${
                c.isToday ? 'bg-ink text-paper font-medium' : 'text-ink/70'
              }`}
            >
              {c.day}
            </div>
            {/* 橘子徽标 */}
            <OrangeIcon variant={variant} className="w-7 h-7" />
          </div>
        );
      })}
    </div>
  );
}
