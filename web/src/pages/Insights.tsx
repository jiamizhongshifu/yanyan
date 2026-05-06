/**
 * 洞悉 tab — 月历 + 勋章瓶 + 趋势 + 月度统计 + 当日详情面板
 *
 * 数据源:
 *   - /yan-score/today + /home/today + /users/me/progress + /sugar/today
 *   - /users/me/challenges/month  → 月历着色 + 玻璃瓶累计计数
 *   - /users/me/yan-score/history → 30 天趋势折线
 *   - /home/month                  → 月度真实统计(餐数/天数/步数)
 *   - 点击趋势点 → 拉 /home/today?date=X(餐食列表)
 */

import { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import { useLocation } from 'wouter';
import { fetchHomeToday, fetchProgress, type TodayMealItem, type UserProgress } from '../services/home';
import { fetchYanScoreToday, type YanScoreToday } from '../services/symptoms';
import { fetchSugarToday, type SugarToday } from '../services/sugar';
import { fetchMonthChallenges, type MonthChallenges } from '../services/dailyChallenges';
import { fetchYanScoreHistory, type YanScoreHistory } from '../services/yanScoreHistory';
import { fetchHomeMonth, fetchMealsByDate, type HomeMonth } from '../services/homeMonth';
import { evaluateChallenges, tierForDay } from '../services/challenges';
import { InflammationTrendChart } from '../components/InflammationTrendChart';
import { useWellness, todayKey } from '../store/wellness';
import { MonthCalendarGrid } from '../components/MonthCalendarGrid';
// matter.js (~80KB) 只在显示勋章瓶时才加载;Insights 页空状态 / 月历 不需要
const AchievementJar = lazy(() =>
  import('../components/AchievementJarPhysics').then((m) => ({ default: m.AchievementJarPhysics }))
);
import { track } from '../services/tracker';
import { asset } from '../services/assets';
import { Icon, type IconName } from '../components/Icon';
import { LevelIcon } from '../components/LevelIcon';
import { AchievementBadgeIcon, type AchievementVariant } from '../components/AchievementBadgeIcon';
import { LEVEL_TO_LABEL, LEVEL_TO_STARS, scoreToStars } from '../services/score-display';
import type { FireLevel } from '../services/symptoms';

const LEVEL_COLOR: Record<FireLevel, string> = {
  平: 'text-fire-ping',
  微火: 'text-fire-ping',
  中火: 'text-fire-mild',
  大火: 'text-fire-mid'
};

export function Insights() {
  const [, navigate] = useLocation();
  const [yanScore, setYanScore] = useState<YanScoreToday | null>(null);
  const [meals, setMeals] = useState<TodayMealItem[]>([]);
  const [progress, setProgress] = useState<UserProgress | null>(null);
  const [sugar, setSugar] = useState<SugarToday | null>(null);
  const [monthCh, setMonthCh] = useState<MonthChallenges | null>(null);
  const [history, setHistory] = useState<YanScoreHistory | null>(null);
  const [monthAgg, setMonthAgg] = useState<HomeMonth | null>(null);

  // 趋势点击选中日 → 详情面板数据
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedDateMeals, setSelectedDateMeals] = useState<TodayMealItem[] | null>(null);
  // 趋势锁定面板:即使 < 21 天也允许点开看现有数据
  const [trendExpanded, setTrendExpanded] = useState(false);

  // 月份切换器:控制橘子瓶 + 月度统计 反映哪个月。默认当月。
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1; // 1-12
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [selectedMonth, setSelectedMonth] = useState(currentMonth);
  const isCurrentMonth = selectedYear === currentYear && selectedMonth === currentMonth;

  const dateKey = todayKey();
  const dayEntry = useWellness((s) => s.dailyMap[dateKey]) ?? { waterCups: 0, steps: 0 };

  // 一次性拉:今日相关数据 + 趋势历史(与月份切换无关)
  useEffect(() => {
    let mounted = true;
    track('tab_insights_visit');
    void Promise.all([
      fetchYanScoreToday(),
      fetchHomeToday(),
      fetchProgress(),
      fetchSugarToday(),
      fetchYanScoreHistory()
    ]).then(([y, h, p, s, hist]) => {
      if (!mounted) return;
      setYanScore(y);
      setMeals(h?.meals ?? []);
      setProgress(p);
      setSugar(s);
      setHistory(hist);
    });
    return () => {
      mounted = false;
    };
  }, []);

  // 月份切换 → 重新拉该月的橘子瓶 + 月度统计
  useEffect(() => {
    let mounted = true;
    void Promise.all([
      fetchMonthChallenges(selectedYear, selectedMonth),
      fetchHomeMonth(selectedYear, selectedMonth)
    ]).then(([m, ma]) => {
      if (!mounted) return;
      setMonthCh(m);
      setMonthAgg(ma);
    });
    return () => {
      mounted = false;
    };
  }, [selectedYear, selectedMonth]);

  // 选中日变化 → 拉当日餐食
  useEffect(() => {
    if (!selectedDate) {
      setSelectedDateMeals(null);
      return;
    }
    let mounted = true;
    void fetchMealsByDate(selectedDate).then((r) => {
      if (mounted) setSelectedDateMeals(r?.meals ?? []);
    });
    return () => {
      mounted = false;
    };
  }, [selectedDate]);

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
  const monthLabel = `${selectedYear} 年 ${selectedMonth} 月`;

  // 仅当浏览当月时,把今日 tier 累加进去(server 还没收到 upsert 的乐观值)
  const todayInServer = monthCh?.days.some((d) => d.date === dateKey) ?? false;
  const addToday =
    isCurrentMonth && !todayInServer
      ? {
          perfect: todayTier === 'perfect' ? 1 : 0,
          great: todayTier === 'great' ? 1 : 0,
          nice: todayTier === 'nice' ? 1 : 0
        }
      : { perfect: 0, great: 0, nice: 0 };
  const perfect = (monthCh?.perfect ?? 0) + addToday.perfect;
  const great = (monthCh?.great ?? 0) + addToday.great;
  const nice = (monthCh?.nice ?? 0) + addToday.nice;

  function shiftMonth(delta: number) {
    let y = selectedYear;
    let m = selectedMonth + delta;
    if (m < 1) {
      m += 12;
      y -= 1;
    } else if (m > 12) {
      m -= 12;
      y += 1;
    }
    // 不允许跳到未来月
    const target = y * 100 + m;
    const cur = currentYear * 100 + currentMonth;
    if (target > cur) return;
    setSelectedYear(y);
    setSelectedMonth(m);
    setSelectedDate(null); // 切月清空选中日
  }

  const selectedDay = selectedDate
    ? history?.entries.find((e) => e.date === selectedDate) ?? null
    : null;
  const selectedSnapshot = selectedDate
    ? monthCh?.days.find((d) => d.date === selectedDate) ?? null
    : null;

  return (
    <main className="min-h-screen bg-paper px-5 pt-10 pb-28 max-w-md mx-auto" data-testid="insights">
      <header className="mb-5 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs text-ink/45">洞悉</p>
          <p className="mt-0.5 text-xl font-medium text-ink truncate">{monthLabel}</p>
          <span className="mt-1 inline-block text-xs text-ink/45">累计 {cumulativeDays} 天</span>
        </div>
        {/* 月份切换器 */}
        <div className="flex items-center gap-1 bg-white rounded-full px-1 py-1 shadow-sm" data-testid="month-switcher">
          <button
            type="button"
            onClick={() => shiftMonth(-1)}
            className="w-7 h-7 rounded-full flex items-center justify-center text-ink/65 hover:bg-paper active:scale-95 transition"
            aria-label="上一个月"
          >
            ◀
          </button>
          <span className="text-xs text-ink px-1.5 min-w-[3.5rem] text-center" data-testid="month-switcher-label">
            {selectedYear}.{String(selectedMonth).padStart(2, '0')}
          </span>
          <button
            type="button"
            onClick={() => shiftMonth(1)}
            disabled={isCurrentMonth}
            className="w-7 h-7 rounded-full flex items-center justify-center text-ink/65 hover:bg-paper active:scale-95 transition disabled:opacity-30 disabled:cursor-not-allowed"
            aria-label="下一个月"
          >
            ▶
          </button>
        </div>
      </header>

      {/* 全新用户:0 数据 → 显示引导卡片替代空玻璃瓶 */}
      {cumulativeDays === 0 && meals.length === 0 && (perfect + great + nice) === 0 ? (
        <section className="mb-4 rounded-3xl bg-fire-ping/10 px-5 py-6 flex items-center gap-4" data-testid="insights-new-user">
          <img
            src={asset('mascot-thinking.png')}
            alt=""
            className="w-20 h-20 object-contain flex-shrink-0"
            loading="lazy"
          />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-ink">这里还没什么可看</p>
            <p className="mt-1.5 text-xs text-ink/65 leading-relaxed">
              拍第一餐 + 完成今日挑战后,玻璃瓶会开始装勋章,日历会出现小太阳。
              累计 21 天解锁抗炎趋势线。
            </p>
          </div>
        </section>
      ) : (
        <Suspense
          fallback={
            <div className="rounded-2xl bg-white px-6 py-10 flex items-center justify-center">
              <span className="text-xs text-ink/40">勋章瓶加载中…</span>
            </div>
          }
        >
          <AchievementJar
            monthLabel={monthLabel}
            perfect={perfect}
            great={great}
            nice={nice}
          />
        </Suspense>
      )}

      {sugar && (
        <p className="mt-3 mb-4 text-[11px] text-ink/45 leading-relaxed text-center">
          本月相比基线({sugar.baselineDailyG} g/天)累计减糖{' '}
          <span className="text-fire-ping font-medium">{sugar.monthSavedG} g</span>
          {' · '}今日{sugar.todayGrams === null ? '尚无餐照' : `已摄入 ${sugar.todayGrams} g`}
          {sugar.todaySavedG > 0 && ` · 今日减糖 ${sugar.todaySavedG} g`}
        </p>
      )}

      {/* 抗炎指数趋势 */}
      {(() => {
        const TREND_THRESHOLD = progress?.thresholds.trendLineDays ?? 21;
        const canDraw = (progress?.flags.canDrawTrend ?? false) || cumulativeDays >= TREND_THRESHOLD;
        if (!canDraw) {
          // 锁定面板:右侧用真实迷你曲线 preview 替代装饰图;
          // 整卡可点 → 展开本期已有的全量趋势(即使数据稀疏)
          const entries = history?.entries ?? [];
          return (
            <section className="mt-6 rounded-3xl bg-white px-5 py-5" data-testid="trend-locked">
              <button
                type="button"
                onClick={() => setTrendExpanded((v) => !v)}
                className="w-full text-left flex items-start gap-4"
                aria-expanded={trendExpanded}
              >
                <div className="flex-1 min-w-0">
                  <h2 className="text-base font-medium text-ink flex items-center gap-1.5">
                    抗炎指数趋势
                    <span className="text-xs text-ink/40">{trendExpanded ? '收起 ▴' : '展开 ▾'}</span>
                  </h2>
                  <p className="mt-1 text-xs text-ink/55 leading-relaxed">
                    累计 {cumulativeDays} / {TREND_THRESHOLD} 天{cumulativeDays >= TREND_THRESHOLD ? '' : ',再坚持解锁完整版'}
                  </p>
                  <div className="mt-3 h-2 rounded-full bg-paper overflow-hidden">
                    <div
                      className="h-full bg-fire-ping/60 transition-all"
                      style={{ width: `${Math.min(1, cumulativeDays / TREND_THRESHOLD) * 100}%` }}
                    />
                  </div>
                </div>
                {/* 真实迷你曲线预览(36px 高,无坐标轴) */}
                <div className="flex-shrink-0 w-28 pl-2 pointer-events-none">
                  <MiniTrendPreview entries={entries} />
                </div>
              </button>

              {trendExpanded && (
                <div className="mt-5 pt-4 border-t border-ink/5">
                  <p className="text-xs text-ink/45 mb-2">{entries.length === 0 ? '当前没有可显示的数据点' : `${entries.length} 天数据`}</p>
                  <InflammationTrendChart
                    entries={entries}
                    onSelectDate={setSelectedDate}
                    selectedDate={selectedDate}
                  />
                  {selectedDate && (
                    <DayDetailPanel
                      date={selectedDate}
                      entry={selectedDay}
                      snapshot={selectedSnapshot}
                      meals={selectedDateMeals}
                    />
                  )}
                </div>
              )}
            </section>
          );
        }
        return (
          <section className="mt-6 rounded-3xl bg-white px-5 py-5" data-testid="trend-chart-section">
            <div className="flex items-baseline justify-between mb-1">
              <h2 className="text-base font-medium text-ink">抗炎指数趋势 · 近 30 天</h2>
              {selectedDate && (
                <button
                  type="button"
                  onClick={() => setSelectedDate(null)}
                  className="text-[11px] text-ink/45 underline"
                >
                  取消选中
                </button>
              )}
            </div>
            <p className="text-xs text-ink/45 mb-3">点击点查看当日详情</p>
            <InflammationTrendChart
              entries={history?.entries ?? []}
              onSelectDate={setSelectedDate}
              selectedDate={selectedDate}
            />

            {selectedDate && (
              <DayDetailPanel
                date={selectedDate}
                entry={selectedDay}
                snapshot={selectedSnapshot}
                meals={selectedDateMeals}
              />
            )}
          </section>
        );
      })()}

      <section className="mt-5 rounded-3xl bg-white px-5 py-5">
        <h2 className="mb-1 text-base font-medium text-ink">日历视图</h2>
        <p className="text-xs text-ink/45 mb-4">每天的小太阳记录当日抗炎指数,点击趋势点回看当日</p>
        <MonthCalendarGrid
          cumulativeInMonth={Math.min(cumulativeDays, 31)}
          todayLevel={yanScore?.result?.level ?? null}
          monthBase={new Date(selectedYear, selectedMonth - 1, 1)}
          daysHistory={(monthCh?.days ?? []).map((d) => ({
            date: d.date,
            tier: d.tier,
            fireLevel: d.fireLevel
          }))}
          onSelectDate={(date, intent) => {
            if (intent === 'navigate') navigate('/app');
            else setSelectedDate(date);
          }}
        />
        {selectedDate && (
          <DayDetailPanel
            date={selectedDate}
            entry={selectedDay}
            snapshot={selectedSnapshot}
            meals={selectedDateMeals}
          />
        )}
      </section>

      {/* 月度统计 — 真实数据 */}
      <section className="mt-5 rounded-3xl bg-white px-5 py-5" data-testid="month-stats">
        <h2 className="mb-3 text-base font-medium text-ink">每月统计</h2>
        <div className="grid grid-cols-2 gap-3">
          <StatTile icon="meal" label="本月拍餐" value={`${monthAgg?.totalMeals ?? 0}`} unit="餐" />
          <StatTile icon="camera" label="拍餐天数" value={`${monthAgg?.photoDays ?? 0}`} unit="天" />
          <StatTile icon="moon" label="次晨打卡" value={`${monthAgg?.checkinDays ?? 0}`} unit="天" />
          <StatTile icon="steps" label="累计步数" value={fmtSteps(monthAgg?.totalSteps ?? 0)} unit="" />
          <StatTile
            icon="drop"
            label="今日喝水"
            value={`${dayEntry.waterCups}`}
            unit="/ 8 杯"
          />
          <StatTile
            icon="sugar"
            label="本月减糖"
            value={`${sugar?.monthSavedG ?? 0}`}
            unit="g"
            highlight
          />
        </div>
      </section>

      {/* 成就解锁卡片 */}
      <section className="mt-5 rounded-3xl bg-white px-5 py-5">
        <h2 className="mb-3 text-base font-medium text-ink">成就解锁</h2>
        <div className="space-y-2.5">
          <AchievementCard
            unlocked={cumulativeDays >= 7}
            variant="week-streak"
            title="坚持一周"
            requirement="累计打卡 7 天"
            progress={cumulativeDays / 7}
          />
          <AchievementCard
            unlocked={(progress?.flags.canDrawTrend ?? false) || cumulativeDays >= 21}
            variant="trend-unlock"
            title="趋势线解锁"
            requirement={`累计打卡 ${progress?.thresholds.trendLineDays ?? 21} 天`}
            progress={cumulativeDays / (progress?.thresholds.trendLineDays ?? 21)}
          />
          <AchievementCard
            unlocked={progress?.flags.eligibleForProfilePdf ?? false}
            variant="month-archive"
            title="30 天体质档案"
            requirement={`累计打卡 ${progress?.thresholds.profilePdfDay ?? 30} 天`}
            progress={cumulativeDays / (progress?.thresholds.profilePdfDay ?? 30)}
          />
          <AchievementCard
            unlocked={(sugar?.monthSavedG ?? 0) >= 50}
            variant="sugar-master"
            title="减糖小达人"
            requirement="本月累计减糖 50 g"
            progress={(sugar?.monthSavedG ?? 0) / 50}
          />
        </div>
      </section>
    </main>
  );
}

function StatTile({
  icon,
  label,
  value,
  unit,
  highlight
}: {
  icon: IconName;
  label: string;
  value: string;
  unit: string;
  highlight?: boolean;
}) {
  return (
    <div className={`rounded-2xl px-4 py-3 ${highlight ? 'bg-fire-ping/10' : 'bg-paper'}`}>
      <div className="flex items-center gap-1.5">
        <span className={highlight ? 'text-fire-ping' : 'text-ink/65'}>
          <Icon name={icon} className="w-4 h-4" />
        </span>
        <span className="text-xs text-ink/55">{label}</span>
      </div>
      <p className="mt-1.5">
        <span className={`text-2xl font-medium ${highlight ? 'text-fire-ping' : 'text-ink'}`}>{value}</span>
        {unit && <span className="ml-1 text-xs text-ink/45">{unit}</span>}
      </p>
    </div>
  );
}

function AchievementCard({
  unlocked,
  variant,
  title,
  requirement,
  progress
}: {
  unlocked: boolean;
  variant: AchievementVariant;
  title: string;
  requirement: string;
  progress: number;
}) {
  const pct = Math.max(0, Math.min(1, progress));
  return (
    <div className={`relative flex items-center gap-3 rounded-2xl px-4 py-3 overflow-hidden ${unlocked ? 'bg-fire-mild/10' : 'bg-paper'}`}>
      <div className="relative z-10 flex-shrink-0">
        <AchievementBadgeIcon variant={variant} className="w-12 h-12" locked={!unlocked} />
        {!unlocked && (
          // 未解锁:右下角小锁角标
          <div className="absolute -right-1 -bottom-1 w-5 h-5 rounded-full bg-ink/85 flex items-center justify-center shadow-sm">
            <svg viewBox="0 0 24 24" className="w-3 h-3 text-paper" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <rect x="5" y="11" width="14" height="10" rx="2" />
              <path d="M8 11V7a4 4 0 1 1 8 0v4" />
            </svg>
          </div>
        )}
      </div>
      <div className="flex-1 min-w-0 relative z-10">
        <p className={`text-sm font-medium flex items-center gap-1 ${unlocked ? 'text-ink' : 'text-ink/45'}`}>
          {unlocked && <Icon name="check" className="w-3.5 h-3.5 text-fire-ping" />}
          {title}
        </p>
        <p className="text-[11px] text-ink/45 mt-0.5">
          {unlocked ? '已达成 · ' : `${Math.round(pct * 100)}% · `}
          {requirement}
        </p>
        {!unlocked && (
          <div className="mt-1.5 h-1 rounded-full bg-ink/10 overflow-hidden">
            <div className="h-full bg-fire-ping/55 transition-all" style={{ width: `${pct * 100}%` }} />
          </div>
        )}
      </div>
    </div>
  );
}

function MiniTrendPreview({ entries }: { entries: import('../services/yanScoreHistory').YanScoreHistoryEntry[] }) {
  const W = 112;
  const H = 36;
  const valid = entries.filter((e) => e.total !== null);

  // 数据不足 2 个有效点 → 画一条水平直线(占位也是"基线"的意思),不再画波浪/单点
  if (valid.length < 2) {
    return (
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-9">
        <line
          x1={2}
          y1={H / 2}
          x2={W - 2}
          y2={H / 2}
          stroke="#0002"
          strokeWidth="2"
          strokeLinecap="round"
        />
      </svg>
    );
  }
  const stepX = W / Math.max(1, entries.length - 1);
  const path: string[] = [];
  let drawing = false;
  for (let i = 0; i < entries.length; i++) {
    const v = entries[i].total;
    if (v === null) {
      drawing = false;
      continue;
    }
    const x = i * stepX;
    const y = H - 4 - (Math.max(0, Math.min(100, v)) / 100) * (H - 8);
    path.push(`${drawing ? 'L' : 'M'} ${x.toFixed(1)} ${y.toFixed(1)}`);
    drawing = true;
  }
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-9">
      <defs>
        <linearGradient id="mini-trend-grad" x1="0%" y1="100%" x2="0%" y2="0%">
          <stop offset="0%" stopColor="#4A8B6F" />
          <stop offset="50%" stopColor="#C9A227" />
          <stop offset="100%" stopColor="#B43A30" />
        </linearGradient>
      </defs>
      <path d={path.join(' ')} fill="none" stroke="url(#mini-trend-grad)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function fmtSteps(n: number): string {
  if (n >= 10000) return `${(n / 10000).toFixed(1)}万`;
  return String(n);
}

function DayDetailPanel({
  date,
  entry,
  snapshot,
  meals
}: {
  date: string;
  entry: import('../services/yanScoreHistory').YanScoreHistoryEntry | null;
  snapshot: import('../services/dailyChallenges').DailyChallengeSnapshot | null;
  meals: TodayMealItem[] | null;
}) {
  const [y, m, d] = date.split('-');
  const hasScore = entry && entry.total !== null;

  return (
    <div className="mt-5 rounded-2xl bg-paper p-4 space-y-4" data-testid={`day-detail-${date}`}>
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-ink">
          {Number(y)}.{Number(m).toString().padStart(2, '0')}.{Number(d).toString().padStart(2, '0')}
        </p>
        {entry?.level && (
          <div className="flex items-center gap-2">
            <LevelIcon level={entry.level} className="w-8 h-8" />
            <span className={`text-base font-medium ${LEVEL_COLOR[entry.level]}`}>
              {LEVEL_TO_LABEL[entry.level]}
            </span>
          </div>
        )}
      </div>

      {hasScore ? (
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="rounded-xl bg-white px-3 py-2">
            <p className="text-ink/45">抗炎指数</p>
            <p className="mt-0.5 text-base font-medium text-ink">
              {entry!.level
                ? `${'★'.repeat(LEVEL_TO_STARS[entry!.level])} / 5`
                : `${'★'.repeat(scoreToStars(entry!.total!))} / 5`}
            </p>
          </div>
          {entry!.partScores.food !== null && (
            <div className="rounded-xl bg-white px-3 py-2">
              <p className="text-ink/45">饮食 part</p>
              <p className="mt-0.5 text-base font-medium text-ink">{entry!.partScores.food}</p>
            </div>
          )}
          {entry!.partScores.symptom !== null && (
            <div className="rounded-xl bg-white px-3 py-2">
              <p className="text-ink/45">体感 part</p>
              <p className="mt-0.5 text-base font-medium text-ink">{entry!.partScores.symptom}</p>
            </div>
          )}
          {snapshot && (
            <div className="rounded-xl bg-white px-3 py-2">
              <p className="text-ink/45">挑战完成</p>
              <p className="mt-0.5 text-base font-medium text-ink">
                {snapshot.completedCount} / 5{snapshot.tier !== 'none' ? ` · ${snapshot.tier === 'perfect' ? '完美' : snapshot.tier === 'great' ? '美好' : '奈斯'}` : ''}
              </p>
            </div>
          )}
        </div>
      ) : (
        <p className="text-xs text-ink/45 text-center py-3">这一天没有完整数据</p>
      )}

      {meals && meals.length > 0 && (
        <div>
          <p className="text-xs text-ink/45 mb-2">这一天拍了 {meals.length} 餐</p>
          <div className="flex gap-2 overflow-x-auto -mx-1 px-1 pb-1">
            {meals.map((m) => (
              <div key={m.id} className="flex-shrink-0 w-20 rounded-xl bg-white p-2 text-center">
                {m.level && <LevelIcon level={m.level} className="w-10 h-10 mx-auto" />}
                <p className="mt-1 text-[10px] text-ink/55">
                  {new Date(m.ateAt).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}
                </p>
                {m.sugarGrams !== null && (
                  <p className="text-[10px] text-fire-mid">{m.sugarGrams}g 糖</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
