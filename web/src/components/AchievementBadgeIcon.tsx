/**
 * 成就徽标 — 纯 SVG 绘制(替代 achievement-*.png)
 *
 * 4 个变体(对应 Insights 页面的 4 个解锁条件):
 *   - week-streak  累计 7 天     (蓝紫色,数字 7 + 火苗)
 *   - trend-unlock 趋势线解锁    (绿色,折线箭头)
 *   - month-archive 30 天档案    (深紫色,数字 30 + 书脊)
 *   - sugar-master 减糖小达人    (粉色,糖块 ✗)
 *
 * 风格沿用 SugarBadgeIcon:平顶六边形外框 + 彩色内胆 + 中央 SVG 图标。
 */

export type AchievementVariant = 'week-streak' | 'trend-unlock' | 'month-archive' | 'sugar-master';

interface Props {
  variant: AchievementVariant;
  className?: string;
  /** 未解锁 — 显示灰度版本(SVG 内部不渲染颜色,父层加 grayscale 也行) */
  locked?: boolean;
}

interface Palette {
  inner1: string;
  inner2: string;
  border: string;
  rim1: string;
  rim2: string;
  rim3: string;
}

const PALETTES: Record<AchievementVariant, Palette> = {
  'week-streak': {
    inner1: '#A0C4F4',
    inner2: '#3B6FBF',
    border: '#1F3D74',
    rim1: '#F4F4F4',
    rim2: '#A8B4C0',
    rim3: '#5A6470'
  },
  'trend-unlock': {
    inner1: '#A8DDB0',
    inner2: '#4A8B5C',
    border: '#234D2C',
    rim1: '#FAEAA0',
    rim2: '#D9A642',
    rim3: '#7C5615'
  },
  'month-archive': {
    inner1: '#C4A8E6',
    inner2: '#6F4FA8',
    border: '#3F2570',
    rim1: '#E5C68A',
    rim2: '#B08840',
    rim3: '#5A4015'
  },
  'sugar-master': {
    inner1: '#F8B4C4',
    inner2: '#D85878',
    border: '#7A2840',
    rim1: '#FAEAA0',
    rim2: '#E0A642',
    rim3: '#7C4015'
  }
};

const HEX_PATH = 'M 32 4 L 56 18 L 56 46 L 32 60 L 8 46 L 8 18 Z';
const HEX_INNER = 'M 32 10 L 51 21 L 51 43 L 32 54 L 13 43 L 13 21 Z';

export function AchievementBadgeIcon({ variant, className = 'w-12 h-12', locked = false }: Props) {
  const p = PALETTES[variant];
  const id = `ab-${variant}`;
  return (
    <svg viewBox="0 0 64 64" className={`${className} ${locked ? 'grayscale opacity-40' : ''}`} aria-hidden="true">
      <defs>
        <linearGradient id={`${id}-rim`} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor={p.rim1} />
          <stop offset="50%" stopColor={p.rim2} />
          <stop offset="100%" stopColor={p.rim3} />
        </linearGradient>
        <radialGradient id={`${id}-inner`} cx="40%" cy="35%" r="65%">
          <stop offset="0%" stopColor={p.inner1} />
          <stop offset="100%" stopColor={p.inner2} />
        </radialGradient>
      </defs>

      <path d={HEX_PATH} fill={`url(#${id}-rim)`} stroke="#3A2A0A" strokeWidth="1.2" strokeLinejoin="round" />
      <path d={HEX_INNER} fill={`url(#${id}-inner)`} stroke={p.border} strokeWidth="0.8" strokeLinejoin="round" />
      {/* 顶部高光弧 */}
      <path d="M 16 17 Q 32 11 48 17" fill="none" stroke="#FFFFFF" strokeWidth="1.2" opacity="0.5" strokeLinecap="round" />

      <CenterIcon variant={variant} />

      {/* 2 颗小 sparkle */}
      <path d="M 54 11 L 54.6 13.4 L 57 14 L 54.6 14.6 L 54 17 L 53.4 14.6 L 51 14 L 53.4 13.4 Z" fill="#FFFFFF" opacity="0.85" />
      <path d="M 11 48 L 11.5 49.9 L 13.4 50.4 L 11.5 50.9 L 11 52.8 L 10.5 50.9 L 8.6 50.4 L 10.5 49.9 Z" fill="#FFFFFF" opacity="0.85" />
    </svg>
  );
}

function CenterIcon({ variant }: { variant: AchievementVariant }) {
  switch (variant) {
    case 'week-streak':
      return (
        <g>
          {/* 数字 7 */}
          <text
            x="32"
            y="40"
            fontSize="20"
            fontWeight="700"
            textAnchor="middle"
            fill="#FFFFFF"
            fontFamily="ui-sans-serif, system-ui"
          >
            7
          </text>
          {/* 小日历框,作为底纹 */}
          <rect x="22" y="22" width="20" height="20" rx="2" fill="none" stroke="#FFFFFF" strokeWidth="0.6" opacity="0.45" />
          <line x1="22" y1="27" x2="42" y2="27" stroke="#FFFFFF" strokeWidth="0.6" opacity="0.45" />
        </g>
      );
    case 'trend-unlock':
      return (
        <g>
          {/* 折线 */}
          <path
            d="M 18 42 L 24 35 L 30 38 L 36 28 L 44 22"
            fill="none"
            stroke="#FFFFFF"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          {/* 箭头 */}
          <path d="M 44 22 L 40 22 M 44 22 L 44 26" stroke="#FFFFFF" strokeWidth="2.2" strokeLinecap="round" />
          {/* 折线节点 */}
          <circle cx="24" cy="35" r="1.6" fill="#FFFFFF" />
          <circle cx="30" cy="38" r="1.6" fill="#FFFFFF" />
          <circle cx="36" cy="28" r="1.6" fill="#FFFFFF" />
        </g>
      );
    case 'month-archive':
      return (
        <g>
          {/* 数字 30 */}
          <text
            x="32"
            y="38"
            fontSize="14"
            fontWeight="700"
            textAnchor="middle"
            fill="#FFFFFF"
            fontFamily="ui-sans-serif, system-ui"
          >
            30
          </text>
          {/* 书形 */}
          <rect x="22" y="42" width="20" height="2" fill="#FFFFFF" opacity="0.7" />
          <rect x="22" y="40" width="20" height="2" fill="#FFFFFF" opacity="0.5" />
          <rect x="22" y="44" width="20" height="3" rx="0.5" fill="#FFFFFF" opacity="0.85" />
          <text
            x="32"
            y="22"
            fontSize="6"
            textAnchor="middle"
            fill="#FFFFFF"
            opacity="0.7"
            fontFamily="ui-sans-serif, system-ui"
          >
            DAYS
          </text>
        </g>
      );
    case 'sugar-master':
      return (
        <g>
          {/* 糖块(立方体) */}
          <rect x="24" y="26" width="16" height="14" rx="1.5" fill="#FFFFFF" stroke="#7A2840" strokeWidth="0.6" />
          {/* 顶面斜投影 */}
          <path d="M 26 23 L 28 26 L 42 26 L 40 23 Z" fill="#FFE0E8" stroke="#7A2840" strokeWidth="0.6" strokeLinejoin="round" />
          <path d="M 40 23 L 42 26 L 42 39 L 40 36 Z" fill="#F8B4C4" stroke="#7A2840" strokeWidth="0.6" strokeLinejoin="round" />
          {/* 大叉 */}
          <line x1="20" y1="24" x2="44" y2="44" stroke="#A03048" strokeWidth="3" strokeLinecap="round" />
        </g>
      );
  }
}
