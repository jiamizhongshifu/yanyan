/**
 * 抗炎指数圆弧仪表盘
 *
 * 270° 弧形(-135° → +135°),填充比例 = 抗炎指数 / 100(高 = 健康)。
 * 渐变 0%→100% 对应 红→绿,即"分数越高填得越满,颜色越往绿走"。
 * 中心显示 5 颗星 + 等级中文标签(平 / 轻盈 / 微暖 / 留心)。
 */

import type { FireLevel } from '../services/symptoms';
import { LEVEL_TO_LABEL, LEVEL_TO_STARS } from '../services/score-display';
import { LevelIcon } from './LevelIcon';

interface Props {
  /** 后端 fireScore 0-100(0=最好);组件内部翻成抗炎指数 100-fireScore */
  score: number;
  level: FireLevel;
  caption?: string;
  /** 是否在中心显示等级 SVG 图标(默认 true) */
  showLevelIcon?: boolean;
}

const LEVEL_COLOR: Record<FireLevel, string> = {
  平: '#4A8B6F',
  微火: '#7BA56A',
  中火: '#C9A227',
  大火: '#D9762C'
};

const LABEL_TEXT_COLOR: Record<FireLevel, string> = {
  平: 'text-fire-ping',
  微火: 'text-fire-ping',
  中火: 'text-fire-mild',
  大火: 'text-fire-mid'
};

export function InflammationDial({ score, level, caption = '今日抗炎指数', showLevelIcon = true }: Props) {
  const fireScore = Math.max(0, Math.min(100, score));
  const antiInflam = 100 - fireScore; // 0-100,高 = 健康
  const stars = LEVEL_TO_STARS[level];
  const displayLabel = LEVEL_TO_LABEL[level];

  const radius = 120;
  const stroke = 18;
  const cx = 150;
  const cy = 150;

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

  const fillEnd = startAngle + (totalSweep * antiInflam) / 100;
  const [fX2, fY2] = polar(fillEnd);
  const fillLargeArc = (totalSweep * antiInflam) / 100 > 180 ? 1 : 0;
  const fillArc = `M ${bgX1} ${bgY1} A ${radius} ${radius} 0 ${fillLargeArc} 1 ${fX2} ${fY2}`;

  return (
    <div className="relative w-full flex flex-col items-center" data-testid="inflammation-dial">
      <svg viewBox="0 0 300 300" className="w-72 h-72">
        <defs>
          {/* 沿弧扫描方向 0%→100%:红 → 黄 → 绿 */}
          <linearGradient id="dial-grad" x1="0%" y1="100%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#D9762C" />
            <stop offset="35%" stopColor="#C9A227" />
            <stop offset="70%" stopColor="#7BA56A" />
            <stop offset="100%" stopColor="#4A8B6F" />
          </linearGradient>
        </defs>
        <path d={bgArc} fill="none" stroke="#E8E3D8" strokeWidth={stroke} strokeLinecap="round" />
        {antiInflam > 0 && (
          <path
            d={fillArc}
            fill="none"
            stroke="url(#dial-grad)"
            strokeWidth={stroke}
            strokeLinecap="round"
          />
        )}
      </svg>

      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
        {showLevelIcon && <LevelIcon level={level} className="w-10 h-10 mb-1" />}
        <p
          className={`text-5xl font-light leading-none ${LABEL_TEXT_COLOR[level]}`}
          data-testid="dial-anti-inflam"
          style={{ color: LEVEL_COLOR[level] }}
        >
          {antiInflam}
        </p>
        <p className="mt-1 text-xs text-ink/50 tracking-wide">{caption}</p>
        <p
          className={`mt-0.5 text-sm font-medium ${LABEL_TEXT_COLOR[level]}`}
          data-testid="dial-level"
          style={{ color: LEVEL_COLOR[level] }}
        >
          {displayLabel}
          <span className="ml-1.5 text-xs font-normal text-ink/45">
            {/* 副位:小号星级供视觉提示 */}
            {'★'.repeat(stars)}
          </span>
        </p>
      </div>
    </div>
  );
}

interface StarsProps {
  /** 1-5 */
  filled: number;
  total?: number;
  className?: string;
  testId?: string;
}

/** 5 颗星显示 — 实心 + 空心,filled 之外用 ink/15 弱化 */
export function Stars({ filled, total = 5, className = '', testId }: StarsProps) {
  const f = Math.max(0, Math.min(total, Math.round(filled)));
  return (
    <span className={`inline-flex items-center gap-0.5 leading-none ${className}`} data-testid={testId}>
      {Array.from({ length: total }).map((_, i) => (
        <span
          key={i}
          className={i < f ? 'text-fire-ping' : 'text-ink/15'}
          aria-hidden="true"
        >
          ★
        </span>
      ))}
      <span className="sr-only">
        {f} / {total} stars
      </span>
    </span>
  );
}
