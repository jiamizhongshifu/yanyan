/**
 * Step 3 Yan-Score 揭晓(plan F3 step 3 + R14 + R18)
 *
 * 在 Step 2 之后才揭晓 — UI 流转保证(R14)。
 * 点击火分展开归因 breakdown(R18)。
 *
 * U7 阶段返回的是占位算法结果(isPlaceholder=true)— UI 显式提示。
 */

import { useEffect, useState } from 'react';
import { useLocation } from 'wouter';
import { fetchYanScoreToday, type FireLevel } from '../../services/symptoms';
import { useCheckin } from '../../store/checkin';

const LEVEL_COLOR: Record<FireLevel, string> = {
  平: 'text-fire-ping',
  微火: 'text-fire-mild',
  中火: 'text-fire-mid',
  大火: 'text-fire-high'
};

export function Step3Reveal() {
  const [, navigate] = useLocation();
  const { yanScore, setYanScore } = useCheckin();
  const [showBreakdown, setShowBreakdown] = useState(false);

  useEffect(() => {
    let mounted = true;
    void fetchYanScoreToday().then((s) => {
      if (mounted) setYanScore(s);
    });
    return () => {
      mounted = false;
    };
  }, [setYanScore]);

  if (!yanScore) {
    return (
      <main className="min-h-screen bg-paper px-7 pt-12 pb-10">
        <p className="text-sm text-ink/60">加载中…</p>
      </main>
    );
  }

  if (!yanScore.hasCheckin) {
    return (
      <main className="min-h-screen bg-paper px-7 pt-12 pb-10">
        <p className="text-sm text-ink/60 leading-relaxed">
          没找到今早打卡记录。先去打卡吧。
        </p>
        <button
          type="button"
          onClick={() => navigate('/check-in/step1')}
          className="mt-6 w-full rounded-full bg-ink text-white py-3 text-base font-medium"
        >
          打卡
        </button>
      </main>
    );
  }

  const level = yanScore.level ?? '平';
  return (
    <main className="min-h-screen bg-paper px-7 pt-12 pb-10" data-testid="checkin-step3">
      <header className="mb-3 text-xs text-ink/50">早安 · 揭晓</header>
      <p className="text-sm text-ink/60">今日体质</p>
      <button
        type="button"
        onClick={() => setShowBreakdown((v) => !v)}
        className="block w-full text-left"
        aria-label="点击查看归因 breakdown"
      >
        <div className={`mt-2 text-7xl font-semibold leading-none ${LEVEL_COLOR[level]}`} data-testid="reveal-level">
          {level}
        </div>
        <div className="mt-1 text-xs text-ink/40">
          火分 <span data-testid="reveal-score">{yanScore.score}</span> / 100
          <span className="ml-2">{showBreakdown ? '收起' : '展开归因 →'}</span>
        </div>
      </button>

      {showBreakdown && yanScore.breakdown && (
        <section className="mt-6 rounded-2xl bg-white px-5 py-4 space-y-2 text-sm" data-testid="breakdown">
          <Row label="饮食" value={yanScore.breakdown.food} />
          <Row label="体感" value={yanScore.breakdown.symptom} />
          <Row label="环境" value={yanScore.breakdown.env} />
          <Row label="作息" value={yanScore.breakdown.activity} />
        </section>
      )}

      {yanScore.isPlaceholder && (
        <p className="mt-6 text-xs text-ink/40 leading-relaxed">
          ⓘ U7 阶段占位算法 — 仅基于体感打卡(SymptomPart 30% 权重)。<br />
          U8 接入后:饮食 50% / 体感 30% / 环境 15% / 作息 5%。
        </p>
      )}

      <button
        type="button"
        onClick={() => navigate('/')}
        className="mt-10 w-full rounded-full bg-ink text-white py-3 text-base font-medium"
      >
        回主页
      </button>
    </main>
  );
}

function Row({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex justify-between">
      <span className="text-ink/60">{label}</span>
      <span className="text-ink">{value}</span>
    </div>
  );
}
