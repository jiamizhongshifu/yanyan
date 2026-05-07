/**
 * 主屏顶部"日历条" — Grow App 风格(过去 7 天 + 今天)
 *
 * 当前阶段没有日级别 yan_score 历史 API,先用累计打卡天数表达进度:
 *   - 已累计的天数显示彩色"小太阳",未到的灰色
 *   - 中间一个高亮(蓝)= 今天
 */

import { useMemo } from 'react';
import { asset } from '../services/assets';
import type { FireLevel } from '../services/symptoms';

interface Props {
  /** 累计打卡天数 — 用作"已累计"的视觉信号 */
  cumulativeDays: number;
  /** 今天的等级,用于高亮当天图标 */
  todayLevel: FireLevel | null;
}

// 用 streak-* 系列(极简单色,28px 圆环里仍可辨)
// 替代复用主仪表盘 level-* 系列(细节多,小尺寸糊)
const LEVEL_ICON_FILE: Record<FireLevel, string> = {
  平: 'streak-ping.png',
  微火: 'streak-weihuo.png',
  中火: 'streak-zhonghuo.png',
  大火: 'streak-dahuo.png'
};

export function HomeStreakStrip({ cumulativeDays, todayLevel }: Props) {
  const today = useMemo(() => new Date(), []);
  const days = useMemo(() => {
    // 显示 [today-3 ... today ... today+3] 7 个,与 Grow App 一致
    const arr: Array<{ date: Date; isToday: boolean; isPast: boolean; isFuture: boolean }> = [];
    for (let i = -3; i <= 3; i++) {
      const d = new Date(today);
      d.setDate(today.getDate() + i);
      arr.push({
        date: d,
        isToday: i === 0,
        isPast: i < 0,
        isFuture: i > 0
      });
    }
    return arr;
  }, [today]);

  return (
    <div className="flex items-center justify-between" data-testid="home-streak-strip">
      {days.map((d, i) => {
        const dayNum = d.date.getDate();
        const showLevel = d.isToday && todayLevel !== null;
        return (
          <div key={i} className="flex flex-col items-center gap-1.5 flex-1">
            <span
              className={`text-[10px] tracking-wide ${
                d.isToday ? 'text-ink font-medium' : 'text-ink/30'
              }`}
            >
              {dayNum}
            </span>
            <div
              className={`w-9 h-9 rounded-full flex items-center justify-center ${
                d.isToday ? 'bg-ink/95' : 'bg-transparent'
              }`}
            >
              {showLevel ? (
                <img
                  src={asset(LEVEL_ICON_FILE[todayLevel!])}
                  alt={todayLevel ?? ''}
                  className={`object-contain ${d.isToday ? 'w-7 h-7' : 'w-8 h-8'}`}
                />
              ) : (
                <div
                  className={`rounded-full ${
                    d.isFuture
                      ? 'w-6 h-6 border border-ink/20'
                      : d.isPast && cumulativeDays > 0
                      ? 'w-7 h-7 bg-ink/15'
                      : 'w-6 h-6 border border-ink/20'
                  }`}
                />
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
