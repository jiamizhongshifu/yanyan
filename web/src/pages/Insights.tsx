/**
 * 洞悉 tab — 月历 + 勋章瓶 + 月度统计
 *
 * v1 数据源:
 *   - cumulativeCheckinDays(progress)→ 月历"已打卡"格子
 *   - 今日 yanScore.result.level → 高亮今天的小太阳
 *   - 今日挑战 tier(perfect/great/nice)→ 当月勋章瓶 +1(本地累积,key=YYYY-MM)
 *
 * 糖分勋章(棒棒糖 / 可乐 / 奶茶 / 巧克力)在下个 commit 接 LLM 真实糖分识别后注入。
 */

import { useEffect, useMemo, useState } from 'react';
import { fetchHomeToday, fetchProgress, type TodayMealItem, type UserProgress } from '../services/home';
import { fetchYanScoreToday, type YanScoreToday } from '../services/symptoms';
import { evaluateChallenges, tierForDay } from '../services/challenges';
import { useWellness, todayKey } from '../store/wellness';
import { MonthCalendarGrid } from '../components/MonthCalendarGrid';
import { AchievementJar } from '../components/AchievementJar';
import { track } from '../services/tracker';

export function Insights() {
  const [yanScore, setYanScore] = useState<YanScoreToday | null>(null);
  const [meals, setMeals] = useState<TodayMealItem[]>([]);
  const [progress, setProgress] = useState<UserProgress | null>(null);

  const dateKey = todayKey();
  const dayEntry = useWellness((s) => s.dailyMap[dateKey]) ?? { waterCups: 0, steps: 0 };

  useEffect(() => {
    let mounted = true;
    track('tab_insights_visit');
    void Promise.all([fetchYanScoreToday(), fetchHomeToday(), fetchProgress()]).then(([y, h, p]) => {
      if (!mounted) return;
      setYanScore(y);
      setMeals(h?.meals ?? []);
      setProgress(p);
    });
    return () => {
      mounted = false;
    };
  }, []);

  // 今日 tier 推断 → 月度计数(粗略:今天若达成,本月就 +1;真实历史等下版接 server)
  const todayTier = useMemo(() => {
    const ps = evaluateChallenges({
      meals,
      yanScore,
      waterCups: dayEntry.waterCups,
      steps: dayEntry.steps
    });
    return tierForDay(ps);
  }, [meals, yanScore, dayEntry]);

  const cumulativeDays = progress?.cumulativeCheckinDays ?? 0;
  const monthLabel = useMemo(
    () => `${new Date().getFullYear()} 年 ${new Date().getMonth() + 1} 月`,
    []
  );

  // 今日 tier 计入本月(server 端历史接入前的占位估算)
  const perfect = todayTier === 'perfect' ? 1 : 0;
  const great = todayTier === 'great' ? 1 : 0;
  const nice = todayTier === 'nice' ? 1 : 0;

  return (
    <main className="min-h-screen bg-paper px-5 pt-10 pb-28" data-testid="insights">
      <header className="mb-5 flex items-center justify-between">
        <div>
          <p className="text-xs text-ink/45">洞悉</p>
          <p className="mt-0.5 text-xl font-medium text-ink">{monthLabel}</p>
        </div>
        <span className="text-xs text-ink/45">累计打卡 {cumulativeDays} 天</span>
      </header>

      <AchievementJar
        monthLabel={monthLabel}
        perfect={perfect}
        great={great}
        nice={nice}
        sugarBadges={[]}
      />

      <p className="mt-3 mb-4 text-[11px] text-ink/40 leading-relaxed">
        控糖勋章(🍭 1 棒棒糖 = 减糖 6 g · 🥤 1 可乐 = 35 g · 🧋 1 奶茶 = 50 g)将在拍餐糖分识别上线后自动入瓶。
      </p>

      <section className="mt-6 rounded-3xl bg-white px-5 py-5">
        <h2 className="mb-1 text-base font-medium text-ink">日历视图</h2>
        <p className="text-xs text-ink/45 mb-4">每天的小太阳记录今日炎症等级</p>
        <MonthCalendarGrid
          cumulativeInMonth={Math.min(cumulativeDays, 31)}
          todayLevel={yanScore?.result?.level ?? null}
        />
      </section>

      {/* 月度统计 */}
      <section className="mt-5 rounded-3xl bg-white px-5 py-5" data-testid="month-stats">
        <h2 className="mb-3 text-base font-medium text-ink">每月统计</h2>
        <div className="space-y-3">
          <StatRow emoji="🍱" label="拍餐" value={`${meals.length} 餐 · 今日`} />
          <StatRow emoji="🌙" label="次晨打卡" value={`${cumulativeDays} 天 · 累计`} />
          <StatRow emoji="💧" label="今日喝水" value={`${dayEntry.waterCups} / 8 杯`} />
          <StatRow emoji="🚶" label="今日步数" value={`${dayEntry.steps}`} />
        </div>
      </section>
    </main>
  );
}

function StatRow({ emoji, label, value }: { emoji: string; label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-3">
        <span className="text-lg w-6 text-center">{emoji}</span>
        <span className="text-sm text-ink">{label}</span>
      </div>
      <span className="text-sm text-ink/55">{value}</span>
    </div>
  );
}
