/**
 * 今天 tab — 每日挑战进度 + 拍餐 CTA + 今日炎症一句话
 *
 * 数据并行:
 *   - /yan-score/today  → 今日炎症 + 是否已打卡(挑战 4)
 *   - /home/today       → 餐食列表(挑战 1 拍餐 + 挑战 2 控糖启发式)
 *   - 本地 wellness     → 喝水(挑战 3) + 步数(挑战 5)
 */

import { useEffect, useState } from 'react';
import { Link } from 'wouter';
import { fetchHomeToday, fetchProgress, type TodayMealItem, type UserProgress } from '../services/home';
import { fetchYanScoreToday, type YanScoreToday, type FireLevel } from '../services/symptoms';
import { evaluateChallenges, tierForDay } from '../services/challenges';
import { useWellness, todayKey } from '../store/wellness';
import { DailyChallengesCard } from '../components/DailyChallengesCard';
import { InappRemindersBanner } from '../components/InappRemindersBanner';
import { TodaySuggestionCard } from '../components/TodaySuggestionCard';
import { track } from '../services/tracker';

const LEVEL_COLOR: Record<FireLevel, string> = {
  平: 'text-fire-ping',
  微火: 'text-fire-mild',
  中火: 'text-fire-mid',
  大火: 'text-fire-high'
};

export function Today() {
  const [yanScore, setYanScore] = useState<YanScoreToday | null>(null);
  const [meals, setMeals] = useState<TodayMealItem[]>([]);
  const [_progress, setProgress] = useState<UserProgress | null>(null);

  const dateKey = todayKey();
  const dayEntry = useWellness((s) => s.dailyMap[dateKey]) ?? { waterCups: 0, steps: 0 };
  const addWater = useWellness((s) => s.addWaterCup);
  const removeWater = useWellness((s) => s.removeWaterCup);
  const setSteps = useWellness((s) => s.setSteps);

  useEffect(() => {
    let mounted = true;
    track('tab_today_visit');
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

  const progresses = evaluateChallenges({
    meals,
    yanScore,
    waterCups: dayEntry.waterCups,
    steps: dayEntry.steps
  });
  const tier = tierForDay(progresses);

  return (
    <main className="min-h-screen bg-paper px-5 pt-10 pb-28" data-testid="today">
      <header className="mb-5 flex items-center justify-between">
        <div>
          <p className="text-xs text-ink/45">今天</p>
          <p className="mt-0.5 text-xl font-medium text-ink">
            {new Date().toLocaleDateString('zh-CN', { month: 'long', day: 'numeric', weekday: 'long' })}
          </p>
        </div>
        <Link
          href="/me"
          className="w-10 h-10 rounded-full bg-white flex items-center justify-center text-ink/60"
          aria-label="设置"
        >
          ◆
        </Link>
      </header>

      <InappRemindersBanner />

      {/* 顶部炎症一句话 */}
      {yanScore?.result && (
        <section className="mb-5 rounded-2xl bg-white px-5 py-4 flex items-center justify-between" data-testid="today-fire-strip">
          <div>
            <p className="text-xs text-ink/50">今日炎症指数</p>
            <p className="mt-0.5">
              <span className={`text-3xl font-light ${LEVEL_COLOR[yanScore.result.level]}`}>
                {yanScore.result.score}
              </span>
              <span className={`ml-2 text-base ${LEVEL_COLOR[yanScore.result.level]}`}>
                {yanScore.result.level}
              </span>
            </p>
          </div>
          <Link href="/app/body" className="text-xs text-ink/50 underline">查看详情</Link>
        </section>
      )}

      <DailyChallengesCard progresses={progresses} tier={tier} />

      {/* 喝水快速 +/- */}
      <section className="mt-3 rounded-2xl bg-white px-5 py-4" data-testid="water-tracker">
        <div className="flex items-center justify-between">
          <p className="text-sm text-ink">💧 喝水</p>
          <p className="text-xs text-ink/50">{dayEntry.waterCups} / 8 杯</p>
        </div>
        <div className="mt-3 flex items-center gap-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <button
              key={i}
              type="button"
              onClick={() => (i < dayEntry.waterCups ? removeWater(dateKey) : addWater(dateKey))}
              className={`flex-1 h-9 rounded-md border ${
                i < dayEntry.waterCups ? 'bg-fire-ping/15 border-fire-ping/30' : 'bg-paper border-ink/10'
              }`}
              aria-label={`第 ${i + 1} 杯`}
            />
          ))}
        </div>
      </section>

      {/* 步数手动录入(Phase 3 接 Apple Health) */}
      <section className="mt-3 rounded-2xl bg-white px-5 py-4" data-testid="steps-tracker">
        <div className="flex items-center justify-between">
          <p className="text-sm text-ink">🚶 步数</p>
          <p className="text-xs text-ink/50">目标 6000 / 天</p>
        </div>
        <div className="mt-3 flex items-center gap-2">
          <input
            type="number"
            inputMode="numeric"
            min={0}
            value={dayEntry.steps || ''}
            onChange={(e) => setSteps(dateKey, Number(e.target.value || 0))}
            placeholder="录入今天的步数"
            className="flex-1 rounded-xl border border-ink/15 bg-paper px-3 py-2 text-sm focus:border-ink focus:outline-none"
          />
          <button
            type="button"
            onClick={() => setSteps(dateKey, dayEntry.steps + 1000)}
            className="px-3 py-2 rounded-xl bg-paper text-sm text-ink"
          >
            +1000
          </button>
        </div>
        <p className="mt-2 text-[11px] text-ink/35">手动录入。Phase 3 接 Apple Health / 微信运动后自动同步。</p>
      </section>

      {/* 今日建议 + 拍餐 CTA */}
      <div className="mt-3">
        <TodaySuggestionCard />
      </div>
      <Link
        href="/camera"
        className="mt-4 block w-full text-center rounded-full bg-ink text-white py-3.5 text-base font-medium"
        data-testid="today-camera-cta"
      >
        📷 拍这一餐
      </Link>
    </main>
  );
}
