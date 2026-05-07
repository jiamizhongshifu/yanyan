/**
 * 今日体质卡片(主屏顶部)
 *
 * 状态机:
 *   - loading 时显示骨架
 *   - hasCheckin=false:大字"等待打卡" + 副字"明早打卡后揭晓你的首份火分"(AE3 / R19)
 *   - result=null + insufficient_parts:"数据还不够"
 *   - 完整 result:level + score + 周内趋势(canDrawTrend ? 真实 : "数据累积中")
 */

import { Link } from 'wouter';
import type { FireLevel, YanScoreToday } from '../services/symptoms';

const LEVEL_COLOR: Record<FireLevel, string> = {
  平: 'text-fire-ping',
  微火: 'text-fire-mild',
  中火: 'text-fire-mid',
  大火: 'text-fire-high'
};

interface Props {
  yanScore: YanScoreToday | null;
  canDrawTrend: boolean;
  cumulativeDays: number;
}

export function TodayFireCard({ yanScore, canDrawTrend, cumulativeDays }: Props) {
  if (!yanScore) {
    return (
      <section className="rounded-2xl bg-white px-6 py-8" data-testid="today-fire-card">
        <p className="text-sm text-ink/30">加载中…</p>
      </section>
    );
  }

  // AE3:hasCheckin=false 路径
  if (!yanScore.hasCheckin) {
    return (
      <section className="rounded-2xl bg-white px-6 py-8" data-testid="today-fire-card">
        <p className="text-sm text-ink/50">今日体质</p>
        <div className="mt-2 text-3xl font-medium text-ink/30" data-testid="card-state">
          等待打卡
        </div>
        <p className="mt-2 text-sm text-ink/50 leading-relaxed">明早打卡后揭晓你的首份火分。</p>
        <Link
          href="/check-in/step1"
          className="mt-4 inline-block rounded-full bg-ink px-5 py-2 text-sm text-white"
        >
          去打卡
        </Link>
      </section>
    );
  }

  // result 缺失:数据不够(< 2 Part)
  if (!yanScore.result) {
    return (
      <section className="rounded-2xl bg-white px-6 py-8" data-testid="today-fire-card">
        <p className="text-sm text-ink/50">今日体质</p>
        <div className="mt-2 text-2xl font-medium text-ink/50" data-testid="card-state">
          数据还不够
        </div>
        <p className="mt-2 text-sm text-ink/50 leading-relaxed">再拍几餐 + 完整一天打卡后,火分会出现。</p>
      </section>
    );
  }

  const r = yanScore.result;
  return (
    <section className="rounded-2xl bg-white px-6 py-8" data-testid="today-fire-card">
      <p className="text-sm text-ink/50">今日体质</p>
      <div className={`mt-1 text-7xl font-semibold leading-none ${LEVEL_COLOR[r.level]}`} data-testid="card-level">
        {r.level}
      </div>
      <p className="mt-1 text-xs text-ink/30">
        火分 <span data-testid="card-score">{r.score}</span> / 100
      </p>

      <div className="mt-4 text-xs text-ink/50">
        {canDrawTrend ? (
          // 真实趋势线由 ce-work 阶段引入 sparkline 库;此处先占位 + Day N 数字
          <span data-testid="card-trend">本周趋势(数据已累计 {cumulativeDays} 天 ✓)</span>
        ) : (
          <span data-testid="card-trend-pending">
            数据累积中,先不画趋势(累计 {cumulativeDays}/21 天)
          </span>
        )}
      </div>
    </section>
  );
}
