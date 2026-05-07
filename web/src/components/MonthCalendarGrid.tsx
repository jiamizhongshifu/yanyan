/**
 * 月历网格 — 统一三态橘子图标(与水豚头顶橘子呼应)
 *
 * 状态对应:
 *   - 已点亮(过去日 + 有数据 / 今天 + 有等级)→ orange-filled 实色饱满
 *   - 未点亮(过去日 但 无数据)              → orange-filled grayscale opacity-40
 *   - 未到来(未来日)                          → orange-outline 描边空心
 *   - 今日                                      → 橘子 + 黑色 ring 高光
 *
 * 不再用 streak/level/tier 图区分:统一橘子,降低识别成本。
 * tier(完美/美好/奈斯)+ fireLevel 通过 title 提示可见,不占视觉。
 */

import { useMemo } from 'react';
import type { FireLevel } from '../services/symptoms';
import { OrangeIcon, type OrangeVariant } from './OrangeIcon';

interface DayInfo {
  date: string; // YYYY-MM-DD
  tier: 'perfect' | 'great' | 'nice' | 'none';
  fireLevel: FireLevel | null;
}

const TIER_TO_VARIANT: Record<DayInfo['tier'], OrangeVariant | null> = {
  perfect: 'perfect',
  great: 'great',
  nice: 'nice',
  none: null
};

interface Props {
  /** 当月内已打卡的累计天数(粗略 fallback,在 server 历史拿到前用) */
  cumulativeInMonth: number;
  /** 今日等级,用于 title 提示 */
  todayLevel: FireLevel | null;
  /** 月份基准日期(默认今天) */
  monthBase?: Date;
  /** 来自 server 的当月每日挑战快照 — 优先用这个判断"是否已点亮" */
  daysHistory?: DayInfo[];
  /** 点击某一天:今天/未来 → navigate;过去 → expand 内嵌详情面板 */
  onSelectDate?: (date: string, intent: 'navigate' | 'expand') => void;
}

const TIER_LABEL: Record<DayInfo['tier'], string> = {
  perfect: '完美一天',
  great: '美好一天',
  nice: '奈斯一天',
  none: ''
};

export function MonthCalendarGrid({
  cumulativeInMonth,
  todayLevel,
  monthBase = new Date(),
  daysHistory,
  onSelectDate
}: Props) {
  const historyByDate = new Map((daysHistory ?? []).map((d) => [d.date, d]));
  const cells = useMemo(() => {
    const year = monthBase.getFullYear();
    const month = monthBase.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startWeekday = firstDay.getDay();
    const totalDays = lastDay.getDate();
    const today = new Date();
    const todayMidnight = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const isCurrentMonth = today.getFullYear() === year && today.getMonth() === month;
    const todayDate = today.getDate();

    type Cell = { day: number | null; isToday: boolean; isPast: boolean; isFuture: boolean };
    const arr: Cell[] = [];
    for (let i = 0; i < startWeekday; i++) arr.push({ day: null, isToday: false, isPast: false, isFuture: false });
    for (let d = 1; d <= totalDays; d++) {
      const isToday = isCurrentMonth && d === todayDate;
      const cellDate = new Date(year, month, d);
      const isPast = cellDate < todayMidnight;
      const isFuture = cellDate > todayMidnight;
      arr.push({ day: d, isToday, isPast, isFuture });
    }
    while (arr.length % 7 !== 0) arr.push({ day: null, isToday: false, isPast: false, isFuture: false });
    return arr;
  }, [monthBase]);

  // 之前用 cumulativeInMonth 倒推"已点亮"是错的(累计打卡不等于每日完美一天勋章),
  // 现在严格按 daysHistory.tier !== 'none' 判定,cumulativeInMonth 仅作为 prop 兼容,不影响视觉
  void cumulativeInMonth;

  return (
    <section data-testid="month-calendar">
      <div className="grid grid-cols-7 gap-y-3 gap-x-1 mb-2 text-xs text-ink/50 text-center">
        {['周日', '周一', '周二', '周三', '周四', '周五', '周六'].map((d) => (
          <span key={d}>{d}</span>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-y-3 gap-x-1">
        {cells.map((c, i) => {
          if (c.day === null) return <div key={i} />;
          const dateStr = `${monthBase.getFullYear()}-${String(monthBase.getMonth() + 1).padStart(2, '0')}-${String(c.day).padStart(2, '0')}`;
          const hist = historyByDate.get(dateStr);
          // 严格:只有真的拿到了每日勋章(tier !== 'none')才算"点亮"
          // fireLevel 不为 null 只代表"做了打卡",不代表完成完美一天/美好一天/奈斯一天
          const hasMedal = !!hist && hist.tier !== 'none';
          const isLit = c.isToday || c.isPast ? hasMedal : false;

          // title 提示:已点亮显示等级 + tier 中文
          const tierLabel = hist ? TIER_LABEL[hist.tier] : '';
          const levelLabel = hist?.fireLevel ?? (c.isToday ? todayLevel : null);
          const title = isLit
            ? [levelLabel, tierLabel].filter(Boolean).join(' · ') || '已点亮'
            : c.isFuture
            ? '未到来'
            : '未点亮';

          const intent: 'navigate' | 'expand' = c.isPast ? 'expand' : 'navigate';
          const handleClick = () => onSelectDate?.(dateStr, intent);

          return (
            <button
              type="button"
              key={i}
              onClick={handleClick}
              disabled={!onSelectDate}
              className="flex flex-col items-center gap-1 active:opacity-60 disabled:opacity-100 disabled:cursor-default"
              data-testid={`calendar-cell-${dateStr}`}
              aria-label={title}
            >
              {/* 选中态(今日)放在日期数字上 — 深色圆形背景,不再绕橘子加 ring */}
              <span
                className={`text-[11px] flex items-center justify-center ${
                  c.isToday
                    ? 'w-5 h-5 rounded-full bg-ink text-paper font-medium'
                    : 'text-ink/50'
                }`}
              >
                {c.day}
              </span>
              <div className="w-9 h-9 rounded-full flex items-center justify-center" title={title}>
                {(() => {
                  // 未来 → outline 空心;过去/今日 + 有 tier → 金/银/铜;过去/今日无 tier → gray
                  const variant: OrangeVariant = c.isFuture
                    ? 'outline'
                    : isLit
                    ? (hist && TIER_TO_VARIANT[hist.tier]) || 'great'
                    : 'gray';
                  return <OrangeIcon variant={variant} className="w-7 h-7" />;
                })()}
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
}
