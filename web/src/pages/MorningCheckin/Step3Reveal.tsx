/**
 * Step 3 Yan-Score 揭晓(plan F3 step 3 + R14 + R18)
 *
 * Post-U8:result 字段为 null 时(可用 Part < 2 / 重分配超上限)显式 UI 提示"数据还不够"。
 * 完整 result 时:level + score + 4 Part breakdown + effectiveWeights(展开后展示)。
 */

import { useEffect, useState } from 'react';
import { useLocation } from 'wouter';
import { fetchYanScoreToday, type FireLevel } from '../../services/symptoms';
import { useCheckin } from '../../store/checkin';
import { track } from '../../services/tracker';
import { TodaySuggestionCard } from '../../components/TodaySuggestionCard';
import { asset } from '../../services/assets';

const LEVEL_COLOR: Record<FireLevel, string> = {
  平: 'text-fire-ping',
  微火: 'text-fire-mild',
  中火: 'text-fire-mid',
  大火: 'text-fire-high'
};

const PART_LABELS: Record<'food' | 'symptom' | 'env' | 'activity', string> = {
  food: '饮食',
  symptom: '体感',
  env: '环境',
  activity: '作息'
};

export function Step3Reveal() {
  const [, navigate] = useLocation();
  const { yanScore, setYanScore } = useCheckin();
  const [showBreakdown, setShowBreakdown] = useState(false);

  useEffect(() => {
    let mounted = true;
    track('score_revealed');
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

  // hasCheckin=false:今日完全无数据
  if (!yanScore.hasCheckin) {
    return (
      <main className="min-h-screen bg-paper px-7 pt-12 pb-10">
        <p className="text-sm text-ink/60 leading-relaxed">没找到今早打卡记录。先去打卡吧。</p>
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

  // result=null:可用 Part 不足 / 上限超
  if (!yanScore.result) {
    return (
      <main className="min-h-screen bg-paper px-7 pt-12 pb-10" data-testid="checkin-step3">
        <header className="mb-3 text-xs text-ink/50">早安 · 揭晓</header>
        <div className="flex justify-center mb-3">
          <img src={asset('checkin-reveal.png')} alt="" className="w-32 h-32 object-contain" loading="lazy" />
        </div>
        <p className="text-sm text-ink/60 leading-relaxed">
          数据还不够,先不评分。再拍几餐 / 完整一天后火分会出现。
        </p>
        <section className="mt-6 rounded-2xl bg-white px-5 py-4 space-y-2 text-sm" data-testid="part-scores">
          {(['food', 'symptom', 'env', 'activity'] as const).map((k) => {
            const v = yanScore.partScores[k];
            return (
              <div key={k} className="flex justify-between text-ink/70">
                <span>{PART_LABELS[k]}</span>
                <span className={v === null ? 'text-ink/30' : 'text-ink'}>
                  {v === null ? '—' : v}
                </span>
              </div>
            );
          })}
        </section>
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

  // 完整 result
  const r = yanScore.result;
  const level = r.level;
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
          火分 <span data-testid="reveal-score">{r.score}</span> / 100
          <span className="ml-2">{showBreakdown ? '收起' : '展开归因 →'}</span>
        </div>
      </button>

      {showBreakdown && (
        <section className="mt-6 rounded-2xl bg-white px-5 py-4 space-y-2 text-sm" data-testid="breakdown">
          {(['food', 'symptom', 'env', 'activity'] as const).map((k) => {
            const isMissing = r.missingParts.includes(k);
            return (
              <div key={k} className="flex justify-between">
                <span className="text-ink/60">
                  {PART_LABELS[k]}
                  {isMissing && <span className="ml-1 text-xs text-ink/40">(缺)</span>}
                </span>
                <span className="text-ink">{r.breakdown[k]}</span>
              </div>
            );
          })}
        </section>
      )}

      {r.missingParts.length > 0 && (
        <p className="mt-6 text-xs text-ink/40 leading-relaxed">
          ⓘ {r.missingParts.map((p) => PART_LABELS[p]).join(' / ')} 未接入,权重已按比例重分配到其他 Part。
        </p>
      )}

      <div className="mt-8">
        <TodaySuggestionCard />
      </div>

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
