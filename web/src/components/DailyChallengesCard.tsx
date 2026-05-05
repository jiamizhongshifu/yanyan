/**
 * 每日挑战卡 — 5 项进度条
 *
 * 每行:emoji + 标题 + 进度条 + status 文案 + ✓(done) 角标
 * 整卡顶部一句"完成 N / 5,距离 完美一天 还差 X 项"
 */

import type { ChallengeProgress, DayTier } from '../services/challenges';
import { TIER_LABEL } from '../services/challenges';
import { asset } from '../services/assets';
import { Icon } from './Icon';

const TIER_ICON: Record<DayTier, string | null> = {
  perfect: 'level-ping.png', // 完美一天 = 平,绿
  great: 'level-weihuo.png',
  nice: 'level-zhonghuo.png',
  none: null
};

interface Props {
  progresses: ChallengeProgress[];
  tier: DayTier;
}

export function DailyChallengesCard({ progresses, tier }: Props) {
  const done = progresses.filter((p) => p.done).length;
  const remainingForPerfect = Math.max(0, 4 - done);

  const tierIconFile = TIER_ICON[tier];

  return (
    <section className="rounded-3xl bg-white px-6 pt-6 pb-5" data-testid="daily-challenges-card">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-medium text-ink">今日挑战</h2>
        <div className="flex items-center gap-1.5">
          {tierIconFile && (
            <img src={asset(tierIconFile)} alt={TIER_LABEL[tier]} className="w-5 h-5 object-contain" />
          )}
          <p className="text-xs text-ink/40">
            {done} / 5 完成{tier !== 'none' ? ` · ${TIER_LABEL[tier]}` : ''}
          </p>
        </div>
      </div>

      {remainingForPerfect > 0 && tier !== 'perfect' && (
        <p className="mt-1 text-xs text-ink/50">距离 完美一天 还差 {remainingForPerfect} 项</p>
      )}
      {tier === 'perfect' && (
        <p className="mt-1 text-xs text-fire-ping flex items-center gap-1">
          今日已达成 完美一天
          <Icon name="sparkle" className="w-3.5 h-3.5" />
        </p>
      )}

      <ul className="mt-4 space-y-3">
        {progresses.map((p) => (
          <li key={p.key} className="flex items-center gap-3" data-testid={`challenge-${p.key}`}>
            <span className={`w-6 flex justify-center ${p.done ? 'text-fire-ping' : 'text-ink/65'}`}>
              <Icon name={p.iconName} className="w-5 h-5" />
            </span>
            <div className="flex-1 min-w-0">
              <div className="flex items-baseline justify-between gap-2">
                <span className={`text-sm ${p.done ? 'text-ink' : 'text-ink/80'} font-medium`}>
                  {p.title}
                </span>
                <span className="text-xs text-ink/45">{p.status}</span>
              </div>
              <div className="mt-1.5 h-1.5 rounded-full bg-paper overflow-hidden">
                <div
                  className={`h-full rounded-full transition-[width] ${
                    p.done ? 'bg-fire-ping' : 'bg-ink/40'
                  }`}
                  style={{ width: `${Math.round(p.progress * 100)}%` }}
                />
              </div>
            </div>
            <span className={`w-4 flex justify-center ${p.done ? 'text-fire-ping' : 'text-transparent'}`}>
              <Icon name="check" className="w-4 h-4" />
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
