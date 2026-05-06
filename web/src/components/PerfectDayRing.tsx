/**
 * 完美一天进度环
 *
 * 270° 弧形(-135° → +135°),fill = doneCount / total
 *
 * 中心层级(从上到下):
 *   1. 灰色小橘子(装饰锚点)
 *   2. 大号百分比(主视觉,按 tier 着色)
 *   3. 完美一天 + 等级标签(副位)
 *
 * 环外:一行鼓励语,根据已完成项数动态写文案
 */

import type { DayTier } from '../services/challenges';
import { OrangeIcon } from './OrangeIcon';

interface Props {
  doneCount: number; // 0-5
  total?: number;    // 默认 5
  tier: DayTier;
}

const TIER_COLOR: Record<DayTier, string> = {
  perfect: '#D9762C',
  great: '#E8954E',
  nice: '#F0B679',
  none: '#A8A296'
};

export function PerfectDayRing({ doneCount, total = 5, tier }: Props) {
  const ratio = Math.max(0, Math.min(1, doneCount / total));
  const pct = Math.round(ratio * 100);
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

  return (
    <div className="w-full flex flex-col items-center" data-testid="perfect-day-ring">
      <div className="relative">
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

        {/* 中心:灰橘子 + 大号百分比 + 副位标签 */}
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <OrangeIcon variant="outline" className="w-8 h-8 text-ink/25 mb-0.5" />
          <p
            className="text-5xl font-light leading-none"
            style={{ color: TIER_COLOR[tier] }}
            data-testid="pday-pct"
          >
            {pct}
            <span className="text-xl font-light ml-0.5">%</span>
          </p>
          <p className="mt-1.5 text-[11px] text-ink/55 tracking-wide">完美一天</p>
        </div>
      </div>

      {/* 环外鼓励语 */}
      <p className="mt-3 text-xs text-ink/60 leading-relaxed text-center px-4">
        {encouragement(doneCount, total, tier)}
      </p>
    </div>
  );
}

function encouragement(done: number, _total: number, tier: DayTier): string {
  if (done === 0) return '今天还没开始,先拍一餐试试看 ✨';
  if (tier === 'perfect') return '今天完美一天达成 🎉,身体会记住这种节奏。';
  if (tier === 'great') {
    const more = 4 - done;
    return more <= 0 ? '继续保持,身体在向好状态走。' : `再完成 ${more} 项就到完美一天 💪`;
  }
  if (tier === 'nice') {
    const more = 3 - done;
    return more <= 0 ? '已经迈过半程,再来一项就更好。' : `再完成 ${more} 项就到美好一天 🌿`;
  }
  return '继续保持现在的节奏,身体会喜欢。';
}
