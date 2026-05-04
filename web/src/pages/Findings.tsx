/**
 * 发物与发现 tab(plan U10 R21 空状态版)
 *
 * v1 行为:展示"发物档案将在 Day 30 生成"占位 + 当前累计天数进度。
 * 真实发物清单(渐进式 Day 14-29 + Day 30 体质档案)由 Phase 2 实施。
 */

import { useEffect, useState } from 'react';
import { fetchProgress, type UserProgress } from '../services/home';
import { track } from '../services/tracker';

export function Findings() {
  const [progress, setProgress] = useState<UserProgress | null>(null);

  useEffect(() => {
    let mounted = true;
    track('tab_findings_visit');
    void fetchProgress().then((p) => {
      if (mounted) setProgress(p);
    });
    return () => {
      mounted = false;
    };
  }, []);

  const days = progress?.cumulativeCheckinDays ?? 0;
  const target = progress?.thresholds.profilePdfDay ?? 30;
  const ratio = Math.min(1, days / target);
  const eligible = progress?.flags.eligibleForProfilePdf ?? false;

  return (
    <main className="min-h-screen bg-paper px-5 pt-12 pb-24" data-testid="findings">
      <header className="mb-6">
        <h1 className="text-xl font-medium text-ink">发物与发现</h1>
        <p className="mt-2 text-sm text-ink/60 leading-relaxed">
          {eligible
            ? '你的体质档案已可生成。'
            : '继续拍照 + 次晨打卡,你的个人发物档案会在 Day 30 出现。'}
        </p>
      </header>

      <section className="rounded-2xl bg-white px-6 py-7" data-testid="progress-card">
        <div className="flex items-baseline justify-between">
          <h2 className="text-base font-medium text-ink">体质档案进度</h2>
          <p className="text-sm text-ink/60" data-testid="day-progress">
            Day {days} / {target}
          </p>
        </div>
        <div className="mt-4 h-2 rounded-full bg-paper overflow-hidden">
          <div
            className="h-full bg-ink transition-all"
            style={{ width: `${ratio * 100}%` }}
            data-testid="progress-bar"
          />
        </div>
        <p className="mt-4 text-xs text-ink/40 leading-relaxed">
          {eligible
            ? '体质档案 v0.5(群体先验版)已生成,Phase 2 个体 Bayesian 版会替换。'
            : days >= 14
            ? '已超过 14 天:Phase 2 上线后,这里会渐进展示候选发物 + 置信度。'
            : '未到 14 天:发物候选规律需要更多数据。'}
        </p>
      </section>
    </main>
  );
}
