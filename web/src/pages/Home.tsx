/**
 * 主屏(plan U10)
 *
 * 并行拉取:
 *   - GET /yan-score/today   (火分卡片)
 *   - GET /home/today        (今日餐食列表)
 *   - GET /users/me/progress (累计天数 + 趋势阈值)
 *
 * UI:
 *   - TodayFireCard
 *   - MealHistoryList
 *   - 跳转 CTA(打卡 / 拍照)
 */

import { useEffect, useState } from 'react';
import { TodayFireCard } from '../components/TodayFireCard';
import { MealHistoryList } from '../components/MealHistoryList';
import { fetchHomeToday, fetchProgress, type TodayMealItem, type UserProgress } from '../services/home';
import { fetchYanScoreToday, type YanScoreToday } from '../services/symptoms';
import { track } from '../services/tracker';

export function Home() {
  const [yanScore, setYanScore] = useState<YanScoreToday | null>(null);
  const [meals, setMeals] = useState<TodayMealItem[] | null>(null);
  const [progress, setProgress] = useState<UserProgress | null>(null);

  useEffect(() => {
    let mounted = true;
    track('tab_home_visit');
    void Promise.all([fetchYanScoreToday(), fetchHomeToday(), fetchProgress()]).then(
      ([y, h, p]) => {
        if (!mounted) return;
        setYanScore(y);
        setMeals(h?.meals ?? []);
        setProgress(p);
      }
    );
    return () => {
      mounted = false;
    };
  }, []);

  return (
    <main className="min-h-screen bg-paper px-5 pt-12 pb-24" data-testid="home">
      <header className="mb-5">
        <p className="text-xs text-ink/40">炎炎消防队</p>
      </header>

      <TodayFireCard
        yanScore={yanScore}
        canDrawTrend={progress?.flags.canDrawTrend ?? false}
        cumulativeDays={progress?.cumulativeCheckinDays ?? 0}
      />

      <div className="h-3" />

      <MealHistoryList meals={meals ?? []} />
    </main>
  );
}
