/**
 * 抗炎指数仪表盘 — 半圆彩虹刻度 + 中心 mascot + 大号数值
 *
 * 设计参考(grow app HRV 风格):
 *   - 240° 半圆弧,下方开口,弧带固定显示 红 → 黄 → 绿 全谱(spectrum)
 *   - 沿弧带均匀刻度(60 个 tick)
 *   - 当前抗炎指数对应位置上画一个圆形指示点(顶部蓝/深色 dot)
 *   - 中心:水豚 mascot(按 level 选表情)+ 大号 antiInflam 数字
 *   - 环外:状态标签 + 鼓励文案(由调用方放,本组件不渲染)
 *
 * 数据约定:score 是后端 fireScore(0-100,越小越健康),组件内翻成 100-fireScore。
 */

import type { FireLevel } from '../services/symptoms';
import { LEVEL_TO_LABEL, LEVEL_TO_STARS } from '../services/score-display';
import { palette } from '../theme/palette';
import { asset } from '../services/assets';

interface Props {
  /** 后端 fireScore 0-100(0=最好);组件内部翻成抗炎指数 100-fireScore */
  score: number;
  level: FireLevel;
  caption?: string;
  /** 是否在中心显示 mascot(默认 true) */
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

const LEVEL_MASCOT: Record<FireLevel, string> = {
  平: 'mascot-cheer.png',
  微火: 'mascot-content.png',
  中火: 'mascot-pensive.png',
  大火: 'mascot-caring.png'
};

// 几何参数:240° 弧带,下方开口
const SWEEP = 240;
const START_ANGLE = 270 - SWEEP / 2; // = 150 (左下,SVG 极角)
const VIEW = 300;
const CX = VIEW / 2;
const CY = VIEW / 2 + 8;
const RADIUS = 118;
const TRACK_W = 14;
const TICK_COUNT = 60;
const TICK_INNER = RADIUS - TRACK_W / 2 - 4;
const TICK_OUTER = RADIUS - TRACK_W / 2 - 1;

function polar(deg: number, r: number = RADIUS): [number, number] {
  const rad = (deg * Math.PI) / 180;
  return [CX + r * Math.cos(rad), CY + r * Math.sin(rad)];
}

export function InflammationDial({ score, level, caption = '今日抗炎指数', showLevelIcon = true }: Props) {
  const fireScore = Math.max(0, Math.min(100, score));
  const antiInflam = 100 - fireScore;
  const stars = LEVEL_TO_STARS[level];
  const displayLabel = LEVEL_TO_LABEL[level];

  // 弧路径(全谱彩虹轨,固定显示)
  const [bgX1, bgY1] = polar(START_ANGLE);
  const [bgX2, bgY2] = polar(START_ANGLE + SWEEP);
  const bgArc = `M ${bgX1.toFixed(2)} ${bgY1.toFixed(2)} A ${RADIUS} ${RADIUS} 0 1 1 ${bgX2.toFixed(2)} ${bgY2.toFixed(2)}`;

  // 当前 antiInflam 对应位置(0% 在弧起点 = 红,100% 在终点 = 绿)
  const indicatorAngle = START_ANGLE + (SWEEP * antiInflam) / 100;
  const [indX, indY] = polar(indicatorAngle, RADIUS);

  // 刻度线
  const ticks = Array.from({ length: TICK_COUNT + 1 }, (_, i) => {
    const angle = START_ANGLE + (SWEEP * i) / TICK_COUNT;
    const [x1, y1] = polar(angle, TICK_INNER);
    const [x2, y2] = polar(angle, TICK_OUTER);
    return { x1, y1, x2, y2 };
  });

  return (
    <div className="relative w-full flex flex-col items-center" data-testid="inflammation-dial">
      <svg viewBox={`0 0 ${VIEW} ${VIEW}`} className="w-72 h-72">
        <defs>
          {/* 弧带固定彩虹 — 0% 位置(左下)红,100% 位置(右下)绿 */}
          <linearGradient id="dial-grad" x1="0%" y1="100%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={palette.fireMid} />
            <stop offset="35%" stopColor={palette.fireMild} />
            <stop offset="70%" stopColor={palette.firePingLight} />
            <stop offset="100%" stopColor={palette.firePing} />
          </linearGradient>
        </defs>

        {/* 彩虹弧带(始终显示全谱)*/}
        <path
          d={bgArc}
          fill="none"
          stroke="url(#dial-grad)"
          strokeWidth={TRACK_W}
          strokeLinecap="round"
          opacity="0.55"
        />

        {/* 刻度 */}
        {ticks.map((t, i) => (
          <line
            key={i}
            x1={t.x1.toFixed(2)}
            y1={t.y1.toFixed(2)}
            x2={t.x2.toFixed(2)}
            y2={t.y2.toFixed(2)}
            stroke={palette.inkRing}
            strokeWidth="1.2"
            strokeLinecap="round"
            opacity="0.55"
          />
        ))}

        {/* 当前位置指示点 — 深色实心圆 */}
        <circle cx={indX} cy={indY} r={9} fill={LEVEL_COLOR[level]} />
        <circle cx={indX} cy={indY} r={4} fill="#FFFFFF" opacity="0.9" />
      </svg>

      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
        {showLevelIcon && (
          <img
            src={asset(LEVEL_MASCOT[level])}
            alt=""
            className="w-20 h-20 object-contain mb-1"
            loading="lazy"
          />
        )}
        <p
          className={`text-5xl font-bold leading-none ${LABEL_TEXT_COLOR[level]}`}
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
          <span className="ml-1.5 text-xs font-normal text-ink/50">
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
          className={i < f ? 'text-fire-ping' : 'text-ink/30'}
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
