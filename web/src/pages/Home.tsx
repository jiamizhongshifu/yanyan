/**
 * 主屏 — Grow App / Perfect Day 风格
 *
 * 视觉结构:
 *   1. 顶部 streak 日历条(过去 3 天 + 今天 + 未来 3 天)
 *   2. 中央炎症仪表盘(SVG 270° 弧 + 中心分数)
 *   3. "身体"分组:4 张 part 卡片(饮食 / 体感 / 环境 / 活动)
 *   4. "日常"分组:今日餐食列表 + 今日建议 + 提醒 banner
 *
 * 数据源:
 *   - GET /yan-score/today        → 主分数 + 4 part 拆分
 *   - GET /home/today             → 今日餐食列表
 *   - GET /users/me/progress      → 累计打卡天数 + 趋势阈值
 *   - useOnboarding/useQuiz       → 首日仪表盘 fallback(quiz baseline / initialFireLevel)
 *
 * 缺数据时仪表盘退化:
 *   - 有 yanScore.result.score → 显示 server 分
 *   - 否则有 quiz.completedAt → 显示 quiz computeInflammationIndex
 *   - 都没 → 显示"尚未建立基线"
 */

import { useEffect, useMemo, useState } from 'react';
import { Link } from 'wouter';
import { InflammationDial } from '../components/InflammationDial';
import { HomeBodyCards } from '../components/HomeBodyCards';
import { MealHistoryList } from '../components/MealHistoryList';
import { TodaySuggestionCard } from '../components/TodaySuggestionCard';
import { InappRemindersBanner } from '../components/InappRemindersBanner';
import { fetchHomeToday, fetchProgress, type TodayMealItem, type UserProgress } from '../services/home';
import { fetchYanScoreToday, type YanScoreToday, type FireLevel } from '../services/symptoms';
import { useQuiz } from '../store/quiz';
import { useOnboarding } from '../store/onboarding';
import { computeInflammationIndex } from '../services/quiz';
import { track } from '../services/tracker';
import { LEVEL_TO_HOME_ENCOURAGEMENT } from '../services/score-display';

// 走 score-display 模块的 LEVEL_TO_HOME_ENCOURAGEMENT;此处仅保留 import 锚

export function Home() {
  const [yanScore, setYanScore] = useState<YanScoreToday | null>(null);
  const [meals, setMeals] = useState<TodayMealItem[] | null>(null);
  const [progress, setProgress] = useState<UserProgress | null>(null);

  const quiz = useQuiz();
  const initialFireLevel = useOnboarding((s) => s.initialFireLevel);

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

  /** 主分数 fallback 链 */
  const dial = useMemo<{ score: number; level: FireLevel; caption: string } | null>(() => {
    // 1. server Yan-Score(数据齐)
    if (yanScore?.result) {
      return { score: yanScore.result.score, level: yanScore.result.level, caption: '今日抗炎指数' };
    }
    // 2. quiz 公开炎症指数(刚登录,还没拍过餐 / 打过卡)
    if (quiz.completedAt && quiz.reverseFilterChoice) {
      const idx = computeInflammationIndex({
        reverseFilterChoice: quiz.reverseFilterChoice,
        symptomsFrequency: quiz.symptomsFrequency,
        recentDiet: quiz.recentDiet,
        sleepPattern: quiz.sleepPattern
      });
      return { score: idx.score, level: idx.level, caption: '初始抗炎指数(基线)' };
    }
    // 3. onboarding 算出的 initialFireLevel(无 quiz 时)
    if (initialFireLevel) {
      const fakeScore =
        initialFireLevel === '平' ? 12 : initialFireLevel === '微火' ? 38 : initialFireLevel === '中火' ? 62 : 85;
      return { score: fakeScore, level: initialFireLevel, caption: '初始抗炎指数(基线)' };
    }
    return null;
  }, [yanScore, quiz, initialFireLevel]);

  const greeting = useMemo(() => {
    const h = new Date().getHours();
    if (h < 6) return '凌晨';
    if (h < 11) return '早上好';
    if (h < 14) return '中午好';
    if (h < 18) return '下午好';
    if (h < 22) return '晚上好';
    return '夜深了';
  }, []);

  return (
    <main className="min-h-screen bg-paper px-5 pt-10 pb-28 max-w-md mx-auto" data-testid="home">
      <header className="mb-4 flex items-center justify-between">
        <div>
          <p className="text-xs text-ink/45">{greeting}</p>
          <p className="mt-0.5 text-lg font-medium text-ink">Soak</p>
        </div>
        <Link
          href="/me"
          className="w-10 h-10 rounded-full bg-white flex items-center justify-center text-ink/60 active:scale-95 transition-transform"
          aria-label="我的"
        >
          <svg viewBox="0 0 24 24" className="w-5 h-5" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
          </svg>
        </Link>
      </header>

      <InappRemindersBanner />

      <section className="mb-2 rounded-3xl bg-white px-6 pt-8 pb-7">
        {dial ? (
          <>
            <InflammationDial
              score={dial.score}
              level={dial.level}
              caption={dial.caption}
            />
            <p className="mt-2 px-2 text-sm text-ink/65 text-center leading-relaxed" data-testid="dial-encourage">
              {LEVEL_TO_HOME_ENCOURAGEMENT[dial.level]}
            </p>
          </>
        ) : (
          <div className="py-12 text-center">
            <p className="text-sm text-ink/50">还没建立体质基线。</p>
            <Link
              href="/quiz/step1"
              className="mt-4 inline-block rounded-full bg-ink px-5 py-2 text-sm text-white"
            >
              做一次评估
            </Link>
          </div>
        )}
      </section>

      <div className="h-5" />

      <HomeBodyCards yanScore={yanScore} />

      <div className="h-5" />

      <section>
        <h2 className="mb-3 text-base font-medium text-ink">日常</h2>
        <TodaySuggestionCard />
        <div className="h-3" />
        <MealHistoryList meals={meals ?? []} />
      </section>

      {progress && !progress.flags.canDrawTrend && (
        <p className="mt-6 text-center text-xs text-ink/40">
          趋势线 {progress.thresholds.trendLineDays} 天解锁(累计 {progress.cumulativeCheckinDays}/
          {progress.thresholds.trendLineDays})
        </p>
      )}
    </main>
  );
}
