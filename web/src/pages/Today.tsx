/**
 * 今天 tab — 每日挑战进度 + 拍餐 CTA + 今日炎症一句话
 *
 * 数据并行:
 *   - /yan-score/today  → 今日炎症 + 是否已打卡(挑战 4)
 *   - /home/today       → 餐食列表(挑战 1 拍餐 + 挑战 2 控糖启发式)
 *   - 本地 wellness     → 喝水(挑战 3) + 步数(挑战 5)
 */

import { useEffect, useRef, useState } from 'react';
import { Link } from 'wouter';
import { fetchHomeToday, fetchProgress, type TodayMealItem, type UserProgress } from '../services/home';
import { fetchYanScoreToday, type YanScoreToday, type FireLevel } from '../services/symptoms';
import { fetchSugarToday, SUGAR_BADGE_ICON, type SugarToday } from '../services/sugar';
import { fetchHealthToday, postHealthSteps, type HealthDaily } from '../services/health';
import { evaluateChallenges, tierForDay } from '../services/challenges';
import { upsertTodayChallenges } from '../services/dailyChallenges';
import { asset } from '../services/assets';
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
  const [sugar, setSugar] = useState<SugarToday | null>(null);
  const [serverHealth, setServerHealth] = useState<HealthDaily | null>(null);

  const dateKey = todayKey();
  const dayEntry = useWellness((s) => s.dailyMap[dateKey]) ?? { waterCups: 0, steps: 0 };
  const addWater = useWellness((s) => s.addWaterCup);
  const removeWater = useWellness((s) => s.removeWaterCup);
  const setSteps = useWellness((s) => s.setSteps);

  useEffect(() => {
    let mounted = true;
    track('tab_today_visit');
    void Promise.all([
      fetchYanScoreToday(),
      fetchHomeToday(),
      fetchProgress(),
      fetchSugarToday(),
      fetchHealthToday()
    ]).then(([y, h, p, s, hd]) => {
      if (!mounted) return;
      setYanScore(y);
      setMeals(h?.meals ?? []);
      setProgress(p);
      setSugar(s);
      setServerHealth(hd);
    });
    return () => {
      mounted = false;
    };
  }, []);

  // server health 优先(快捷指令同步过的步数);本地 zustand 仅 fallback
  const effectiveSteps = serverHealth?.steps ?? dayEntry.steps;
  const progresses = evaluateChallenges({
    meals,
    yanScore,
    waterCups: dayEntry.waterCups,
    steps: effectiveSteps
  });
  const tier = tierForDay(progresses);

  // 节流上报当日挑战快照(防抖 1.5s):任一挑战值变化 → upsert /users/me/challenges/today
  const completedKeys = progresses.filter((p) => p.done).map((p) => p.key);
  const completedCount = completedKeys.length;
  const upsertTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (upsertTimerRef.current) clearTimeout(upsertTimerRef.current);
    upsertTimerRef.current = setTimeout(() => {
      void upsertTodayChallenges({
        date: dateKey,
        tier,
        completedCount,
        completedKeys,
        fireLevel: yanScore?.result?.level ?? null
      });
    }, 1500);
    return () => {
      if (upsertTimerRef.current) clearTimeout(upsertTimerRef.current);
    };
    // 依赖:tier + completedCount + completedKeys.join + fireLevel + dateKey
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateKey, tier, completedCount, completedKeys.join('|'), yanScore?.result?.level]);

  return (
    <main className="min-h-screen bg-paper px-5 pt-10 pb-28 max-w-md mx-auto" data-testid="today">
      <header className="mb-4 flex items-center justify-between">
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

      {/* 顶部 hero 插画(水豚泡温泉)— ponchi-e 风格点缀 */}
      <div className="mb-4 -mx-1 rounded-3xl overflow-hidden">
        <img
          src={asset('today-hero.png')}
          alt="清晨的水豚"
          className="w-full h-auto block"
          loading="lazy"
        />
      </div>

      <InappRemindersBanner />

      {/* 顶部炎症一句话 — 加 level 插画 */}
      {yanScore?.result && (
        <section className="mb-5 rounded-2xl bg-white px-5 py-4 flex items-center gap-4" data-testid="today-fire-strip">
          <img
            src={asset(`level-${yanScore.result.level === '平' ? 'ping' : yanScore.result.level === '微火' ? 'weihuo' : yanScore.result.level === '中火' ? 'zhonghuo' : 'dahuo'}.png`)}
            alt={yanScore.result.level}
            className="w-14 h-14 object-contain flex-shrink-0"
          />
          <div className="flex-1 min-w-0">
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
          <Link href="/app/body" className="text-xs text-ink/50 underline whitespace-nowrap">查看详情</Link>
        </section>
      )}

      <DailyChallengesCard progresses={progresses} tier={tier} />

      {/* 控糖卡片 — 今日糖摄入 + 减糖 + 月度勋章预览 */}
      {sugar && (
        <section className="mt-3 rounded-2xl bg-white px-5 py-4" data-testid="sugar-tracker">
          <div className="flex items-baseline justify-between">
            <p className="text-sm text-ink">🍬 控糖</p>
            <p className="text-xs text-ink/45">基线 {sugar.baselineDailyG} g / 天</p>
          </div>
          <p className="mt-2">
            <span className="text-3xl font-light text-ink">
              {sugar.todayGrams === null ? '—' : sugar.todayGrams}
            </span>
            <span className="ml-1 text-sm text-ink/55">g 今日添加糖</span>
            {sugar.todaySavedG > 0 && (
              <span className="ml-3 text-xs text-fire-ping font-medium">
                ✓ 减糖 {sugar.todaySavedG} g
              </span>
            )}
          </p>
          {sugar.monthlyBadges.length > 0 && (
            <div className="mt-3 flex flex-wrap items-center gap-2.5 text-sm">
              <span className="text-xs text-ink/45">本月勋章</span>
              {sugar.monthlyBadges.map((b) => (
                <div key={b.kind} className="flex items-center gap-1">
                  <img
                    src={asset(SUGAR_BADGE_ICON[b.kind])}
                    alt={b.label}
                    className="w-7 h-7 object-contain"
                    loading="lazy"
                  />
                  <span className="text-xs text-ink">×{b.count}</span>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

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

      {/* 步数:server 优先(快捷指令同步)+ 手动录入兜底 */}
      <section className="mt-3 rounded-2xl bg-white px-5 py-4" data-testid="steps-tracker">
        <div className="flex items-center justify-between">
          <p className="text-sm text-ink">🚶 步数</p>
          <div className="flex items-center gap-2">
            {serverHealth?.source === 'shortcut' && (
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-fire-ping/15 text-fire-ping">
                Apple Health
              </span>
            )}
            <p className="text-xs text-ink/50">目标 6000 / 天</p>
          </div>
        </div>
        <div className="mt-3 flex items-center gap-2">
          <input
            type="number"
            inputMode="numeric"
            min={0}
            value={effectiveSteps || ''}
            onChange={(e) => {
              const n = Number(e.target.value || 0);
              setSteps(dateKey, n);
              void postHealthSteps({ date: dateKey, steps: n, source: 'manual' }).then((ok) => {
                if (ok) setServerHealth({ date: dateKey, steps: n, restingHr: null, source: 'manual', updatedAt: new Date().toISOString() });
              });
            }}
            placeholder="录入今天的步数"
            className="flex-1 rounded-xl border border-ink/15 bg-paper px-3 py-2 text-sm focus:border-ink focus:outline-none"
          />
          <button
            type="button"
            onClick={() => {
              const n = effectiveSteps + 1000;
              setSteps(dateKey, n);
              void postHealthSteps({ date: dateKey, steps: n, source: 'manual' });
              setServerHealth({ date: dateKey, steps: n, restingHr: null, source: 'manual', updatedAt: new Date().toISOString() });
            }}
            className="px-3 py-2 rounded-xl bg-paper text-sm text-ink"
          >
            +1000
          </button>
        </div>
        <Link
          href="/me/health-shortcut"
          className="mt-2 inline-block text-[11px] text-ink/45 underline"
          data-testid="link-health-shortcut"
        >
          配置 iOS 快捷指令自动同步 Apple Health 步数 →
        </Link>
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
