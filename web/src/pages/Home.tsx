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
import { fetchHomeToday, fetchProgress, peekHomeToday, peekProgress, type TodayMealItem, type UserProgress } from '../services/home';
import { fetchYanScoreToday, peekYanScoreToday, type YanScoreToday, type FireLevel } from '../services/symptoms';
import { useQuiz } from '../store/quiz';
import { useOnboarding } from '../store/onboarding';
import { computeInflammationIndex } from '../services/quiz';
import { track } from '../services/tracker';
import { LEVEL_TO_HOME_ENCOURAGEMENT } from '../services/score-display';

// 走 score-display 模块的 LEVEL_TO_HOME_ENCOURAGEMENT;此处仅保留 import 锚

export function Home() {
  // 初始值从客户端缓存读 — 切回 tab 时第一帧就有数据,避免"空 → 数据"闪烁
  const [yanScore, setYanScore] = useState<YanScoreToday | null>(() => peekYanScoreToday());
  const [meals, setMeals] = useState<TodayMealItem[] | null>(() => peekHomeToday()?.meals ?? null);
  const [progress, setProgress] = useState<UserProgress | null>(() => peekProgress());

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

  return (
    <main className="min-h-screen bg-paper px-5 pt-10 pb-28 max-w-md mx-auto" data-testid="home">
      <header className="mb-4">
        <h1 className="text-xl font-medium text-ink">身体</h1>
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
            <p className="mt-2 px-2 text-sm text-ink/70 text-center leading-relaxed" data-testid="dial-encourage">
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
        <p className="mt-6 text-center text-xs text-ink/30">
          趋势线 {progress.thresholds.trendLineDays} 天解锁(累计 {progress.cumulativeCheckinDays}/
          {progress.thresholds.trendLineDays})
        </p>
      )}
    </main>
  );
}
