/**
 * 完美一天进度环 — 仿 InflammationDial 但小一号,中心放橘子等级勋章
 *
 * 270° 弧形(-135° → +135°),fill = doneCount / 5
 * doneCount 来自 evaluateChallenges:5 项中已完成多少
 *
 *   tier=perfect (4-5 已完成) → tier-perfect.png(亮橘 + 星星)
 *   tier=great   (3 已完成)   → tier-great.png  (中橘)
 *   tier=nice    (1-2 已完成) → tier-nice.png   (浅橘描边)
 *   tier=none    (0 已完成)   → 灰底 outline 橘子
 */

import type { DayTier } from '../services/challenges';
import { TIER_LABEL } from '../services/challenges';
import { asset } from '../services/assets';

interface Props {
  doneCount: number; // 0-5
  total?: number;    // 默认 5
  tier: DayTier;
}

const TIER_TO_ICON: Record<DayTier, string> = {
  perfect: 'tier-perfect.png',
  great: 'tier-great.png',
  nice: 'tier-nice.png',
  none: 'tier-nice.png' // none 时 icon 也用 nice 但加灰度
};

const TIER_COLOR: Record<DayTier, string> = {
  perfect: '#D9762C', // 亮橘
  great: '#E8954E',
  nice: '#F0B679',
  none: '#D8D2C5'
};

export function PerfectDayRing({ doneCount, total = 5, tier }: Props) {
  const ratio = Math.max(0, Math.min(1, doneCount / total));
  const radius = 86;
  const stroke = 12;
  const cx = 110;
  const cy = 110;

  const startAngle = 135;
  const endAngle = 405;
  const totalSweep = endAngle - startAngle;

  const polar = (deg: number): [number, number] => {
    const r = ((deg - 90) * Math.PI) / 180;
    return [cx + radius * Math.cos(r), cy + radius * Math.sin(r)];
  };

  const [bgX1, bgY1] = polar(startAngle);
  const [bgX2, bgY2] = polar(endAngle);
  const bgArc = `M ${bgX1} ${bgY1} A ${radius} ${radius} 0 1 1 ${bgX2} ${bgY2}`;

  const fillEnd = startAngle + totalSweep * ratio;
  const [fX2, fY2] = polar(fillEnd);
  const fillLargeArc = totalSweep * ratio > 180 ? 1 : 0;
  const fillArc = `M ${bgX1} ${bgY1} A ${radius} ${radius} 0 ${fillLargeArc} 1 ${fX2} ${fY2}`;

  const iconFile = TIER_TO_ICON[tier];
  const isEmpty = tier === 'none';

  return (
    <div className="relative w-full flex flex-col items-center" data-testid="perfect-day-ring">
      <svg viewBox="0 0 220 220" className="w-52 h-52">
        <defs>
          <linearGradient id="pday-grad" x1="0%" y1="100%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#F0B679" />
            <stop offset="50%" stopColor="#E8954E" />
            <stop offset="100%" stopColor="#D9762C" />
          </linearGradient>
        </defs>
        <path d={bgArc} fill="none" stroke="#F0E8DA" strokeWidth={stroke} strokeLinecap="round" />
        {ratio > 0 && (
          <path
            d={fillArc}
            fill="none"
            stroke="url(#pday-grad)"
            strokeWidth={stroke}
            strokeLinecap="round"
          />
        )}
      </svg>

      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
        <img
          src={asset(iconFile)}
          alt={tier}
          className={`w-20 h-20 object-contain ${isEmpty ? 'grayscale opacity-60' : ''}`}
          loading="lazy"
        />
        <p className="mt-1 text-xs text-ink/55 tracking-wide">完美一天</p>
        <p
          className="text-base font-medium leading-tight"
          style={{ color: TIER_COLOR[tier] }}
          data-testid="pday-progress"
        >
          {doneCount} / {total}
          {tier !== 'none' && <span className="ml-1 text-xs">· {TIER_LABEL[tier]}</span>}
        </p>
      </div>
    </div>
  );
}
