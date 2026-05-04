/**
 * 当日餐食时间线 — 列表卡片
 */

import { Link } from 'wouter';
import type { TodayMealItem } from '../services/home';
import type { FireLevel } from '../services/symptoms';

const LEVEL_COLOR: Record<FireLevel, string> = {
  平: 'bg-fire-ping/10 text-fire-ping',
  微火: 'bg-fire-mild/10 text-fire-mild',
  中火: 'bg-fire-mid/10 text-fire-mid',
  大火: 'bg-fire-high/10 text-fire-high'
};

interface Props {
  meals: TodayMealItem[];
}

export function MealHistoryList({ meals }: Props) {
  if (meals.length === 0) {
    return (
      <section className="rounded-2xl bg-white px-6 py-7" data-testid="meal-history">
        <h2 className="text-sm text-ink/60">今日餐食</h2>
        <p className="mt-3 text-sm text-ink/50 leading-relaxed">还没拍今天的第一餐。</p>
        <Link
          href="/camera"
          className="mt-4 inline-block rounded-full bg-ink px-5 py-2 text-sm text-white"
        >
          拍这一餐
        </Link>
      </section>
    );
  }

  return (
    <section className="rounded-2xl bg-white px-6 py-5" data-testid="meal-history">
      <h2 className="text-sm text-ink/60">今日餐食 · {meals.length} 餐</h2>
      <ul className="mt-3 divide-y divide-paper">
        {meals.map((m) => {
          const time = new Date(m.ateAt).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false });
          return (
            <li key={m.id} className="py-3 flex items-center justify-between" data-testid={`meal-row-${m.id}`}>
              <div>
                <div className="text-sm text-ink">{time}</div>
                <div className="text-xs text-ink/40 mt-0.5">
                  发 {m.tcmLabelsSummary.发} · 温和 {m.tcmLabelsSummary.温和} · 平 {m.tcmLabelsSummary.平}
                </div>
              </div>
              {m.level && (
                <span className={`text-xs px-2.5 py-1 rounded-full ${LEVEL_COLOR[m.level]}`}>
                  {m.level} {m.fireScore}
                </span>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
