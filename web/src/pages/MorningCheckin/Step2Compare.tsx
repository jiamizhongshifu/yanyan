/**
 * Step 2 对照昨日(plan F3 step 2)
 *
 * 仅展示,不再要求输入(R13)。
 * 没昨日数据 → 显示"今天是第一次,无昨日对照"+ 直接跳 Step 3。
 */

import { useEffect } from 'react';
import { useLocation } from 'wouter';
import { fetchYesterdayCompare, SYMPTOM_DIMENSION_LABELS, SYMPTOM_LEVEL_LABELS, type SymptomDimension } from '../../services/symptoms';
import { useCheckin } from '../../store/checkin';
import { track } from '../../services/tracker';

export function Step2Compare() {
  const [, navigate] = useLocation();
  const { payload, yesterday, setYesterday } = useCheckin();

  useEffect(() => {
    let mounted = true;
    track('checkin_step2_view');
    void fetchYesterdayCompare().then((y) => {
      if (mounted) setYesterday(y);
    });
    return () => {
      mounted = false;
    };
  }, [setYesterday]);

  // 处理昨日数据:取昨天勾过的维度
  const yesterdayEntries: Array<{ dim: SymptomDimension; severity: number | null }> = [];
  if (yesterday?.hasYesterday && yesterday.payload) {
    for (const [dim, entry] of Object.entries(yesterday.payload)) {
      if (entry?.engaged) {
        yesterdayEntries.push({ dim: dim as SymptomDimension, severity: entry.severity });
      }
    }
  }

  return (
    <main className="min-h-screen bg-paper px-7 pt-12 pb-10" data-testid="checkin-step2">
      <header className="mb-3 text-xs text-ink/50">早安 · Step 2</header>
      <h1 className="text-2xl font-semibold text-ink">对照昨天</h1>

      {!yesterday && (
        <p className="mt-3 text-sm text-ink/60">加载中…</p>
      )}

      {yesterday && !yesterday.hasYesterday && (
        <p className="mt-3 text-sm text-ink/60 leading-relaxed">
          今天是第一次,无昨日对照。明天就有了。
        </p>
      )}

      {yesterday && yesterday.hasYesterday && yesterdayEntries.length === 0 && (
        <p className="mt-3 text-sm text-ink/60 leading-relaxed">昨天你没勾过任何反应。</p>
      )}

      {yesterday?.hasYesterday && yesterdayEntries.length > 0 && (
        <section className="mt-6 space-y-3" aria-label="对照列表">
          {yesterdayEntries.map(({ dim, severity }) => {
            const labels = SYMPTOM_LEVEL_LABELS[dim];
            const yesterdayLabel = severity ? labels[severity - 1] : '未具体程度';
            const todayEntry = payload[dim];
            const todayLabel =
              todayEntry?.engaged && todayEntry.severity != null
                ? labels[todayEntry.severity - 1]
                : todayEntry?.engaged
                ? '勾了未具体'
                : '无';
            return (
              <div key={dim} className="rounded-xl bg-white px-4 py-3" data-testid={`compare-${dim}`}>
                <div className="text-base text-ink font-medium">{SYMPTOM_DIMENSION_LABELS[dim]}</div>
                <div className="mt-2 flex items-center gap-3 text-sm text-ink/70">
                  <span>昨天:{yesterdayLabel}</span>
                  <span className="text-ink/30">→</span>
                  <span>今早:{todayLabel}</span>
                </div>
              </div>
            );
          })}
        </section>
      )}

      <button
        type="button"
        onClick={() => navigate('/check-in/reveal')}
        className="mt-10 w-full rounded-full bg-ink text-white py-3 text-base font-medium"
      >
        揭晓今日火分
      </button>
    </main>
  );
}
