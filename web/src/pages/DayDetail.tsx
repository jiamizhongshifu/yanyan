/**
 * 历史某一天详情 — /day/:date
 *
 * 视觉沿用主屏卡片:
 *   - 顶部该日 yan-score 总分 + 等级
 *   - 4 part 拆分(饮食/体感/环境/活动)
 *   - 当天餐食列表(若 /home/today?date= 返回)
 *
 * 数据源:
 *   - GET /users/me/yan-score/history?since=date&until=date
 *   - GET /home/today?date=date
 */

import { useEffect, useState } from 'react';
import { Link, useLocation } from 'wouter';
import { fetchYanScoreHistory, type YanScoreHistoryEntry } from '../services/yanScoreHistory';
import { fetchHomeToday, type TodayMealItem } from '../services/home';
import { MealHistoryList } from '../components/MealHistoryList';
import { asset } from '../services/assets';
import type { FireLevel } from '../services/symptoms';

const LEVEL_ICON_FILE: Record<FireLevel, string> = {
  平: 'level-ping.png',
  微火: 'level-weihuo.png',
  中火: 'level-zhonghuo.png',
  大火: 'level-dahuo.png'
};

const PART_LABEL: Array<{ key: 'food' | 'symptom' | 'env' | 'activity'; title: string; icon: string }> = [
  { key: 'food', title: '饮食', icon: 'body-food.png' },
  { key: 'symptom', title: '体感', icon: 'body-symptom.png' },
  { key: 'env', title: '环境', icon: 'body-env.png' },
  { key: 'activity', title: '活动', icon: 'body-activity.png' }
];

function partColor(score: number | null): string {
  if (score === null) return 'text-ink/30';
  if (score < 25) return 'text-fire-ping';
  if (score < 50) return 'text-fire-mild';
  if (score < 75) return 'text-fire-mid';
  return 'text-fire-high';
}

function formatDate(iso: string): string {
  const [y, m, d] = iso.split('-');
  return `${y}年${parseInt(m, 10)}月${parseInt(d, 10)}日`;
}

interface Props {
  date: string;
}

export function DayDetail({ date }: Props) {
  const [, navigate] = useLocation();
  const [entry, setEntry] = useState<YanScoreHistoryEntry | null>(null);
  const [meals, setMeals] = useState<TodayMealItem[] | null>(null);
  const [loading, setLoading] = useState(true);

  const validDate = /^\d{4}-\d{2}-\d{2}$/.test(date);

  useEffect(() => {
    if (!validDate) return;
    let mounted = true;
    setLoading(true);
    void Promise.all([fetchYanScoreHistory(date, date), fetchHomeToday(date)]).then(([h, m]) => {
      if (!mounted) return;
      setEntry(h?.entries.find((e) => e.date === date) ?? null);
      setMeals(m?.meals ?? []);
      setLoading(false);
    });
    return () => {
      mounted = false;
    };
  }, [date, validDate]);

  if (!validDate) {
    return (
      <main className="min-h-screen bg-paper px-5 pt-10 pb-28 max-w-md mx-auto">
        <p className="text-sm text-ink/60">日期无效。</p>
        <Link href="/app/body" className="mt-4 inline-block text-sm text-ink underline">
          返回主屏
        </Link>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-paper px-5 pt-10 pb-28 max-w-md mx-auto" data-testid="day-detail">
      <header className="mb-4 flex items-center justify-between">
        <button
          onClick={() => navigate('/app/body')}
          className="text-sm text-ink/60"
          aria-label="返回"
        >
          ← 返回
        </button>
        <p className="text-base font-medium text-ink">{formatDate(date)}</p>
        <span className="w-12" />
      </header>

      <section className="mb-4 rounded-3xl bg-white px-6 py-7 text-center" data-testid="day-yanscore">
        {loading ? (
          <p className="text-sm text-ink/40">加载中…</p>
        ) : entry && entry.total !== null && entry.level ? (
          <>
            <img
              src={asset(LEVEL_ICON_FILE[entry.level])}
              alt={entry.level}
              className="w-16 h-16 mx-auto object-contain"
            />
            <p className="mt-3 text-4xl font-medium text-ink">{Math.round(entry.total)}</p>
            <p className="mt-1 text-sm text-ink/60">{entry.level}</p>
          </>
        ) : (
          <p className="py-6 text-sm text-ink/50">这一天没有炎症指数记录。</p>
        )}
      </section>

      {entry && (
        <section className="mb-5" data-testid="day-parts">
          <h2 className="mb-3 text-base font-medium text-ink">身体</h2>
          <div className="grid grid-cols-2 gap-3">
            {PART_LABEL.map((p) => {
              const score = entry.partScores[p.key];
              return (
                <div
                  key={p.key}
                  className="rounded-2xl bg-white px-5 py-4 min-h-[120px] flex flex-col relative overflow-hidden"
                >
                  <img
                    src={asset(p.icon)}
                    alt=""
                    className="absolute -right-2 -top-2 w-16 h-16 object-contain opacity-60 pointer-events-none"
                    aria-hidden="true"
                  />
                  <p className="text-xs text-ink/50 relative z-10">{p.title}</p>
                  {score !== null ? (
                    <p className={`mt-2 text-3xl font-medium ${partColor(score)} relative z-10`}>
                      {Math.round(score)}
                    </p>
                  ) : (
                    <p className="mt-2 text-2xl font-light text-ink/30 relative z-10">—</p>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )}

      <section>
        <h2 className="mb-3 text-base font-medium text-ink">餐食</h2>
        <MealHistoryList meals={meals ?? []} />
      </section>
    </main>
  );
}
