/**
 * 炎症指数圆弧仪表盘 — Grow / Perfect Day 风格
 *
 * 270° 弧形(从 -135° 到 +135°),按 score / 100 填充,渐变色:绿 → 黄 → 橙 → 红。
 * 中央显示 score + level + 鼓励语;顶部小图标可放当前等级插画。
 */

import type { FireLevel } from '../services/symptoms';
import { asset } from '../services/assets';

interface Props {
  score: number; // 0-100
  level: FireLevel;
  /** 中心副标题(如 "今日炎症" / "当前指数") */
  caption?: string;
  /** 等级插画(平 / 微火 / 中火 / 大火 4 张) */
  levelIcon?: 'level-ping.png' | 'level-weihuo.png' | 'level-zhonghuo.png' | 'level-dahuo.png';
}

const LEVEL_COLOR: Record<FireLevel, string> = {
  平: '#4A8B6F',
  微火: '#C9A227',
  中火: '#D9762C',
  大火: '#B43A30'
};

export function InflammationDial({ score, level, caption = '当前炎症指数', levelIcon }: Props) {
  const clamped = Math.max(0, Math.min(100, score));
  const radius = 120;
  const stroke = 18;
  const cx = 150;
  const cy = 150;

  // 270° arc: -135° (左下) → +135° (右下),12 点钟为顶
  const startAngle = 135; // 左下
  const endAngle = 405; // 右下(+360 已绕过 0/12 点)
  const totalSweep = endAngle - startAngle; // 270

  const polar = (deg: number): [number, number] => {
    const r = ((deg - 90) * Math.PI) / 180; // 12 点钟 = 0°
    return [cx + radius * Math.cos(r), cy + radius * Math.sin(r)];
  };

  const [bgX1, bgY1] = polar(startAngle);
  const [bgX2, bgY2] = polar(endAngle);
  const bgArc = `M ${bgX1} ${bgY1} A ${radius} ${radius} 0 1 1 ${bgX2} ${bgY2}`;

  const fillEnd = startAngle + (totalSweep * clamped) / 100;
  const [fX2, fY2] = polar(fillEnd);
  const fillLargeArc = (totalSweep * clamped) / 100 > 180 ? 1 : 0;
  const fillArc = `M ${bgX1} ${bgY1} A ${radius} ${radius} 0 ${fillLargeArc} 1 ${fX2} ${fY2}`;

  const color = LEVEL_COLOR[level];
  const labelColorMap: Record<FireLevel, string> = {
    平: 'text-fire-ping',
    微火: 'text-fire-mild',
    中火: 'text-fire-mid',
    大火: 'text-fire-high'
  };

  return (
    <div className="relative w-full flex flex-col items-center" data-testid="inflammation-dial">
      <svg viewBox="0 0 300 300" className="w-72 h-72">
        <defs>
          <linearGradient id="dial-grad" x1="0%" y1="100%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#4A8B6F" />
            <stop offset="40%" stopColor="#C9A227" />
            <stop offset="70%" stopColor="#D9762C" />
            <stop offset="100%" stopColor="#B43A30" />
          </linearGradient>
        </defs>
        <path d={bgArc} fill="none" stroke="#E8E3D8" strokeWidth={stroke} strokeLinecap="round" />
        {clamped > 0 && (
          <path
            d={fillArc}
            fill="none"
            stroke="url(#dial-grad)"
            strokeWidth={stroke}
            strokeLinecap="round"
          />
        )}
      </svg>

      {/* 中心叠加 */}
      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
        {levelIcon && (
          <img
            src={asset(levelIcon)}
            alt={level}
            className="w-12 h-12 object-contain mb-1"
            loading="lazy"
          />
        )}
        <p className={`text-6xl font-light leading-none ${labelColorMap[level]}`} data-testid="dial-score">
          {clamped}
        </p>
        <p className="mt-2 text-xs text-ink/50 tracking-wide">{caption}</p>
        <p className={`mt-1 text-base font-medium ${labelColorMap[level]}`} data-testid="dial-level" style={{ color }}>
          {level}
        </p>
      </div>
    </div>
  );
}
