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
import { fetchSugarToday, type SugarToday } from '../services/sugar';
import { fetchMonthChallenges, type MonthChallenges } from '../services/dailyChallenges';
import { fetchYanScoreHistory, type YanScoreHistory } from '../services/yanScoreHistory';
import { evaluateChallenges, tierForDay } from '../services/challenges';
import { InflammationTrendChart } from '../components/InflammationTrendChart';
import { useWellness, todayKey } from '../store/wellness';
import { MonthCalendarGrid } from '../components/MonthCalendarGrid';
import { AchievementJar } from '../components/AchievementJar';
import { track } from '../services/tracker';

export function Insights() {
  const [yanScore, setYanScore] = useState<YanScoreToday | null>(null);
  const [meals, setMeals] = useState<TodayMealItem[]>([]);
  const [progress, setProgress] = useState<UserProgress | null>(null);
  const [sugar, setSugar] = useState<SugarToday | null>(null);
  const [monthCh, setMonthCh] = useState<MonthChallenges | null>(null);
  const [history, setHistory] = useState<YanScoreHistory | null>(null);

  const dateKey = todayKey();
  const dayEntry = useWellness((s) => s.dailyMap[dateKey]) ?? { waterCups: 0, steps: 0 };

  useEffect(() => {
    let mounted = true;
    track('tab_insights_visit');
    void Promise.all([
      fetchYanScoreToday(),
      fetchHomeToday(),
      fetchProgress(),
      fetchSugarToday(),
      fetchMonthChallenges(),
      fetchYanScoreHistory() // 默认过去 30 天
    ]).then(([y, h, p, s, m, hist]) => {
      if (!mounted) return;
      setYanScore(y);
      setMeals(h?.meals ?? []);
      setProgress(p);
      setSugar(s);
      setMonthCh(m);
      setHistory(hist);
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

  // 月度计数:优先用 server 累积值;若 server 还没今日记录,把当下计算出的 tier 暂叠加(防双计:server 已有今日记录则不再叠)
  const todayInServer = monthCh?.days.some((d) => d.date === dateKey) ?? false;
  const addToday = todayInServer
    ? { perfect: 0, great: 0, nice: 0 }
    : {
        perfect: todayTier === 'perfect' ? 1 : 0,
        great: todayTier === 'great' ? 1 : 0,
        nice: todayTier === 'nice' ? 1 : 0
      };
  const perfect = (monthCh?.perfect ?? 0) + addToday.perfect;
  const great = (monthCh?.great ?? 0) + addToday.great;
  const nice = (monthCh?.nice ?? 0) + addToday.nice;

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
        sugarBadges={(sugar?.monthlyBadges ?? []).map((b) => ({
          emoji: b.emoji,
          label: b.label,
          count: b.count
        }))}
      />

      {sugar && (
        <p className="mt-3 mb-4 text-[11px] text-ink/45 leading-relaxed">
          本月相比基线({sugar.baselineDailyG} g/天)累计减糖 <span className="text-ink font-medium">{sugar.monthSavedG} g</span>
          {' · '}今日{sugar.todayGrams === null ? '尚无餐照' : `已摄入 ${sugar.todayGrams} g`}
          {sugar.todaySavedG > 0 && ` · 今日减糖 ${sugar.todaySavedG} g`}
        </p>
      )}

      {/* 炎症指数趋势 — 21 天阈值后展开 */}
      {(() => {
        const TREND_THRESHOLD = progress?.thresholds.trendLineDays ?? 21;
        const canDraw = (progress?.flags.canDrawTrend ?? false) || cumulativeDays >= TREND_THRESHOLD;
        if (!canDraw) {
          return (
            <section className="mt-6 rounded-3xl bg-white px-5 py-5" data-testid="trend-locked">
              <h2 className="mb-2 text-base font-medium text-ink">炎症指数趋势</h2>
              <p className="text-xs text-ink/55 leading-relaxed">
                累计打卡 {TREND_THRESHOLD} 天后解锁。当前 {cumulativeDays} / {TREND_THRESHOLD}。
              </p>
              <div className="mt-3 h-2 rounded-full bg-paper overflow-hidden">
                <div
                  className="h-full bg-ink/40 transition-all"
                  style={{ width: `${Math.min(1, cumulativeDays / TREND_THRESHOLD) * 100}%` }}
                />
              </div>
            </section>
          );
        }
        return (
          <section className="mt-6 rounded-3xl bg-white px-5 py-5" data-testid="trend-chart-section">
            <h2 className="mb-1 text-base font-medium text-ink">炎症指数趋势 · 近 30 天</h2>
            <p className="text-xs text-ink/45 mb-3">每天一点;断层 = 当天没数据</p>
            <InflammationTrendChart entries={history?.entries ?? []} />
          </section>
        );
      })()}

      <section className="mt-5 rounded-3xl bg-white px-5 py-5">
        <h2 className="mb-1 text-base font-medium text-ink">日历视图</h2>
        <p className="text-xs text-ink/45 mb-4">每天的小太阳记录今日炎症等级</p>
        <MonthCalendarGrid
          cumulativeInMonth={Math.min(cumulativeDays, 31)}
          todayLevel={yanScore?.result?.level ?? null}
          daysHistory={(monthCh?.days ?? []).map((d) => ({
            date: d.date,
            tier: d.tier,
            fireLevel: d.fireLevel
          }))}
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
