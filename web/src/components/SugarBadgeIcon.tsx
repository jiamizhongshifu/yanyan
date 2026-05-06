/**
 * 控糖勋章 — 六边形金属盾牌风格(参考游戏成就 badge)
 *
 * 结构:
 *   - 外层金属六边形(银/金渐变描边)
 *   - 内层彩色径向渐变(按食物种类)
 *   - 中央食物 SVG
 *   - 4 角小高光 + 1-2 颗白色 sparkle 微闪
 *
 * 用法:
 *   - JSX:`<SugarBadgeIcon variant="milktea" className="w-9 h-9" />`
 *   - matter sprite:`sugarBadgeDataUrl('milktea')` 同步 data URL
 */

export type SugarBadgeVariant = 'lollipop' | 'cola' | 'milktea' | 'chocolate';

interface Props {
  variant: SugarBadgeVariant;
  className?: string;
}

interface Palette {
  inner1: string;
  inner2: string;
  border: string;
}

const PALETTES: Record<SugarBadgeVariant, Palette> = {
  lollipop: { inner1: '#F8C5D0', inner2: '#DA6E8E', border: '#A03A52' },
  cola: { inner1: '#E27A4A', inner2: '#A0392B', border: '#5C1A14' },
  milktea: { inner1: '#E8C896', inner2: '#A47840', border: '#6B4915' },
  chocolate: { inner1: '#A47451', inner2: '#5C2E0E', border: '#2A1404' }
};

/** 平顶六边形 path,viewBox 0..64 */
const HEX_PATH = 'M 32 4 L 56 18 L 56 46 L 32 60 L 8 46 L 8 18 Z';
/** 内层稍小六边形 */
const HEX_INNER = 'M 32 10 L 51 21 L 51 43 L 32 54 L 13 43 L 13 21 Z';

export function SugarBadgeIcon({ variant, className = 'w-9 h-9' }: Props) {
  const p = PALETTES[variant];
  const id = `sb-${variant}`;
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden="true">
      <defs>
        {/* 外层金属边渐变 */}
        <linearGradient id={`${id}-rim`} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#FAEAA0" />
          <stop offset="50%" stopColor="#D9A642" />
          <stop offset="100%" stopColor="#7C5615" />
        </linearGradient>
        {/* 内层彩色径向 */}
        <radialGradient id={`${id}-inner`} cx="40%" cy="35%" r="65%">
          <stop offset="0%" stopColor={p.inner1} />
          <stop offset="100%" stopColor={p.inner2} />
        </radialGradient>
      </defs>

      {/* 外六边形:金属边 */}
      <path d={HEX_PATH} fill={`url(#${id}-rim)`} stroke="#5A3A0A" strokeWidth="1.2" strokeLinejoin="round" />
      {/* 内六边形:彩色 */}
      <path d={HEX_INNER} fill={`url(#${id}-inner)`} stroke={p.border} strokeWidth="0.8" strokeLinejoin="round" />
      {/* 顶部高光弧 */}
      <path d="M 16 17 Q 32 11 48 17" fill="none" stroke="#FFFFFF" strokeWidth="1.2" opacity="0.5" strokeLinecap="round" />

      {/* 中央食物图标 */}
      <CenterIcon variant={variant} />

      {/* sparkles */}
      <Spark cx={54} cy={14} size={1.6} />
      <Spark cx={11} cy={50} size={1.3} />
    </svg>
  );
}

function Spark({ cx, cy, size }: { cx: number; cy: number; size: number }) {
  const s = size;
  return (
    <path
      d={`M ${cx} ${cy - s * 1.6} L ${cx + s * 0.4} ${cy - s * 0.4} L ${cx + s * 1.6} ${cy} L ${cx + s * 0.4} ${cy + s * 0.4} L ${cx} ${cy + s * 1.6} L ${cx - s * 0.4} ${cy + s * 0.4} L ${cx - s * 1.6} ${cy} L ${cx - s * 0.4} ${cy - s * 0.4} Z`}
      fill="#FFFFFF"
      opacity="0.85"
    />
  );
}

function CenterIcon({ variant }: { variant: SugarBadgeVariant }) {
  switch (variant) {
    case 'lollipop':
      return (
        <g>
          <circle cx="32" cy="32" r="7" fill="#FFF6E0" stroke="#7B2331" strokeWidth="1.2" />
          {/* 螺旋 */}
          <path d="M 27 32 A 5 5 0 1 1 32 37 A 3 3 0 1 1 32 31 A 1.5 1.5 0 1 0 32 33" fill="none" stroke="#DA3E5C" strokeWidth="1.2" strokeLinecap="round" />
          {/* 木棒 */}
          <line x1="32" y1="39" x2="32" y2="46" stroke="#7B5320" strokeWidth="1.6" strokeLinecap="round" />
        </g>
      );
    case 'cola':
      return (
        <g>
          {/* 瓶身 */}
          <path
            d="M 28 22 L 28 24 Q 27 25 27 26 L 27 42 Q 27 44 29 44 L 35 44 Q 37 44 37 42 L 37 26 Q 37 25 36 24 L 36 22 Z"
            fill="#3F1E0A"
            stroke="#1A0902"
            strokeWidth="0.6"
          />
          {/* 瓶盖 */}
          <rect x="28" y="20" width="8" height="3" rx="0.5" fill="#E83A3A" stroke="#7B1818" strokeWidth="0.5" />
          {/* 标签 */}
          <rect x="28" y="32" width="8" height="5" fill="#F5D27A" />
          <text x="32" y="35.5" fontSize="3" textAnchor="middle" fill="#7B2317" fontWeight="bold">cola</text>
        </g>
      );
    case 'milktea':
      return (
        <g>
          {/* 杯身 */}
          <path
            d="M 24 26 L 25.5 44 Q 25.5 45 27 45 L 37 45 Q 38.5 45 38.5 44 L 40 26 Z"
            fill="#D9B889"
            stroke="#5A3A0A"
            strokeWidth="0.6"
          />
          {/* 杯盖 */}
          <rect x="23" y="24" width="18" height="3" rx="0.5" fill="#5A3A0A" />
          {/* 吸管 */}
          <line x1="34" y1="14" x2="34" y2="42" stroke="#FFFFFF" strokeWidth="1.6" strokeLinecap="round" />
          {/* 珍珠 */}
          <circle cx="29" cy="40" r="1.1" fill="#1A0902" />
          <circle cx="32" cy="42" r="1.1" fill="#1A0902" />
          <circle cx="35" cy="40" r="1.1" fill="#1A0902" />
        </g>
      );
    case 'chocolate':
      return (
        <g>
          {/* 巧克力块 */}
          <rect x="22" y="24" width="20" height="16" rx="1.2" fill="#3F1E0A" stroke="#1A0902" strokeWidth="0.6" />
          {/* 网格 */}
          <line x1="27" y1="24" x2="27" y2="40" stroke="#1A0902" strokeWidth="0.4" />
          <line x1="32" y1="24" x2="32" y2="40" stroke="#1A0902" strokeWidth="0.4" />
          <line x1="37" y1="24" x2="37" y2="40" stroke="#1A0902" strokeWidth="0.4" />
          <line x1="22" y1="32" x2="42" y2="32" stroke="#1A0902" strokeWidth="0.4" />
          {/* 高光 */}
          <rect x="22.5" y="24.5" width="19" height="2" fill="#FFFFFF" opacity="0.18" />
        </g>
      );
  }
}

/** SVG → data URL,供 matter.js sprite */
export function sugarBadgeDataUrl(variant: SugarBadgeVariant): string {
  const p = PALETTES[variant];
  const center = (() => {
    switch (variant) {
      case 'lollipop':
        return `<circle cx="32" cy="32" r="7" fill="#FFF6E0" stroke="#7B2331" stroke-width="1.2"/>
                <path d="M 27 32 A 5 5 0 1 1 32 37 A 3 3 0 1 1 32 31 A 1.5 1.5 0 1 0 32 33" fill="none" stroke="#DA3E5C" stroke-width="1.2" stroke-linecap="round"/>
                <line x1="32" y1="39" x2="32" y2="46" stroke="#7B5320" stroke-width="1.6" stroke-linecap="round"/>`;
      case 'cola':
        return `<path d="M 28 22 L 28 24 Q 27 25 27 26 L 27 42 Q 27 44 29 44 L 35 44 Q 37 44 37 42 L 37 26 Q 37 25 36 24 L 36 22 Z" fill="#3F1E0A" stroke="#1A0902" stroke-width="0.6"/>
                <rect x="28" y="20" width="8" height="3" rx="0.5" fill="#E83A3A" stroke="#7B1818" stroke-width="0.5"/>
                <rect x="28" y="32" width="8" height="5" fill="#F5D27A"/>`;
      case 'milktea':
        return `<path d="M 24 26 L 25.5 44 Q 25.5 45 27 45 L 37 45 Q 38.5 45 38.5 44 L 40 26 Z" fill="#D9B889" stroke="#5A3A0A" stroke-width="0.6"/>
                <rect x="23" y="24" width="18" height="3" rx="0.5" fill="#5A3A0A"/>
                <line x1="34" y1="14" x2="34" y2="42" stroke="#FFFFFF" stroke-width="1.6" stroke-linecap="round"/>
                <circle cx="29" cy="40" r="1.1" fill="#1A0902"/>
                <circle cx="32" cy="42" r="1.1" fill="#1A0902"/>
                <circle cx="35" cy="40" r="1.1" fill="#1A0902"/>`;
      case 'chocolate':
        return `<rect x="22" y="24" width="20" height="16" rx="1.2" fill="#3F1E0A" stroke="#1A0902" stroke-width="0.6"/>
                <line x1="27" y1="24" x2="27" y2="40" stroke="#1A0902" stroke-width="0.4"/>
                <line x1="32" y1="24" x2="32" y2="40" stroke="#1A0902" stroke-width="0.4"/>
                <line x1="37" y1="24" x2="37" y2="40" stroke="#1A0902" stroke-width="0.4"/>
                <line x1="22" y1="32" x2="42" y2="32" stroke="#1A0902" stroke-width="0.4"/>
                <rect x="22.5" y="24.5" width="19" height="2" fill="#FFFFFF" opacity="0.18"/>`;
    }
  })();

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="64" height="64">
    <defs>
      <linearGradient id="rim" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stop-color="#FAEAA0"/>
        <stop offset="50%" stop-color="#D9A642"/>
        <stop offset="100%" stop-color="#7C5615"/>
      </linearGradient>
      <radialGradient id="inner" cx="40%" cy="35%" r="65%">
        <stop offset="0%" stop-color="${p.inner1}"/>
        <stop offset="100%" stop-color="${p.inner2}"/>
      </radialGradient>
    </defs>
    <path d="${HEX_PATH}" fill="url(#rim)" stroke="#5A3A0A" stroke-width="1.2" stroke-linejoin="round"/>
    <path d="${HEX_INNER}" fill="url(#inner)" stroke="${p.border}" stroke-width="0.8" stroke-linejoin="round"/>
    <path d="M 16 17 Q 32 11 48 17" fill="none" stroke="#FFFFFF" stroke-width="1.2" opacity="0.5" stroke-linecap="round"/>
    ${center}
    <path d="M 54 11 L 54.6 13.4 L 57 14 L 54.6 14.6 L 54 17 L 53.4 14.6 L 51 14 L 53.4 13.4 Z" fill="#FFFFFF" opacity="0.85"/>
    <path d="M 11 48 L 11.5 49.9 L 13.4 50.4 L 11.5 50.9 L 11 52.8 L 10.5 50.9 L 8.6 50.4 L 10.5 49.9 Z" fill="#FFFFFF" opacity="0.85"/>
  </svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}
