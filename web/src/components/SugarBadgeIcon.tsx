/**
 * 控糖勋章图标 — 纯 SVG 绘制(替代 PNG 插画)
 *
 * 通用框架:金色奖牌 + 红丝带 + 中央对应小食物图标
 *
 * 4 种食物 variant:
 *   - lollipop  棒棒糖
 *   - cola      可乐瓶
 *   - milktea   奶茶杯
 *   - chocolate 巧克力块
 *
 * 用法:
 *   - JSX:`<SugarBadgeIcon variant="milktea" className="w-9 h-9" />`
 *   - matter sprite:`sugarBadgeDataUrl('milktea')` 同步生成 data URL
 */

export type SugarBadgeVariant = 'lollipop' | 'cola' | 'milktea' | 'chocolate';

interface Props {
  variant: SugarBadgeVariant;
  className?: string;
}

export function SugarBadgeIcon({ variant, className = 'w-9 h-9' }: Props) {
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden="true">
      <defs>
        <radialGradient id={`medal-${variant}`} cx="40%" cy="35%" r="65%">
          <stop offset="0%" stopColor="#F5D27A" />
          <stop offset="60%" stopColor="#E0A93D" />
          <stop offset="100%" stopColor="#A87432" />
        </radialGradient>
      </defs>

      {/* 红丝带:左右两条三角飘带 */}
      <path d="M 22 6 L 28 32 L 18 28 L 14 14 Z" fill="#C0392B" stroke="#7C2317" strokeWidth="1" strokeLinejoin="round" />
      <path d="M 42 6 L 36 32 L 46 28 L 50 14 Z" fill="#C0392B" stroke="#7C2317" strokeWidth="1" strokeLinejoin="round" />
      {/* 丝带顶折(深一点) */}
      <path d="M 22 6 L 26 16 L 14 14 Z" fill="#922416" />
      <path d="M 42 6 L 38 16 L 50 14 Z" fill="#922416" />

      {/* 金色奖牌主体 */}
      <circle cx="32" cy="38" r="20" fill={`url(#medal-${variant})`} stroke="#7B5320" strokeWidth="1.5" />
      {/* 内圈凹槽 */}
      <circle cx="32" cy="38" r="16" fill="none" stroke="#9D6F2A" strokeWidth="0.8" opacity="0.6" />
      {/* 顶部高光弧 */}
      <path d="M 18 30 Q 32 22 46 30" fill="none" stroke="#FFFFFF" strokeWidth="1.5" opacity="0.5" strokeLinecap="round" />

      {/* 中央食物图标 */}
      <CenterIcon variant={variant} />
    </svg>
  );
}

function CenterIcon({ variant }: { variant: SugarBadgeVariant }) {
  switch (variant) {
    case 'lollipop':
      return (
        <g>
          {/* 棒棒糖头 */}
          <circle cx="32" cy="36" r="5.5" fill="#F4B6C2" stroke="#7B5320" strokeWidth="1" />
          <path d="M 28 36 Q 30 32 34 33 Q 36 35 33 38 Q 30 39 29 36" fill="#FFFFFF" opacity="0.7" />
          {/* 木棒 */}
          <line x1="32" y1="41" x2="32" y2="48" stroke="#7B5320" strokeWidth="1.5" />
        </g>
      );
    case 'cola':
      return (
        <g>
          {/* 瓶身 */}
          <path
            d="M 27 30 L 27 32 Q 27 33 28 33 L 28 46 Q 28 48 30 48 L 34 48 Q 36 48 36 46 L 36 33 Q 37 33 37 32 L 37 30 Z"
            fill="#5C2E0E"
            stroke="#3A1B05"
            strokeWidth="0.8"
          />
          {/* 瓶盖 */}
          <rect x="29" y="28" width="6" height="2.5" fill="#C0392B" stroke="#7C2317" strokeWidth="0.5" />
          {/* 标签 */}
          <rect x="28.5" y="38" width="7" height="3.5" fill="#F5D27A" />
        </g>
      );
    case 'milktea':
      return (
        <g>
          {/* 杯身 */}
          <path
            d="M 26 32 L 27 47 Q 27 48 28 48 L 36 48 Q 37 48 37 47 L 38 32 Z"
            fill="#C9A077"
            stroke="#7B5320"
            strokeWidth="0.8"
          />
          {/* 杯盖 */}
          <rect x="25" y="30" width="14" height="2.5" rx="1" fill="#7B5320" />
          {/* 吸管 */}
          <line x1="34" y1="22" x2="34" y2="45" stroke="#FFFFFF" strokeWidth="1.5" />
          {/* 珍珠 */}
          <circle cx="29" cy="44" r="0.9" fill="#3A1B05" />
          <circle cx="32" cy="46" r="0.9" fill="#3A1B05" />
          <circle cx="35" cy="44" r="0.9" fill="#3A1B05" />
        </g>
      );
    case 'chocolate':
      return (
        <g>
          {/* 巧克力块 */}
          <rect x="24" y="32" width="16" height="12" rx="1" fill="#5C2E0E" stroke="#3A1B05" strokeWidth="0.8" />
          {/* 网格 */}
          <line x1="28" y1="32" x2="28" y2="44" stroke="#3A1B05" strokeWidth="0.5" />
          <line x1="32" y1="32" x2="32" y2="44" stroke="#3A1B05" strokeWidth="0.5" />
          <line x1="36" y1="32" x2="36" y2="44" stroke="#3A1B05" strokeWidth="0.5" />
          <line x1="24" y1="38" x2="40" y2="38" stroke="#3A1B05" strokeWidth="0.5" />
          {/* 高光 */}
          <rect x="24.5" y="32.5" width="15" height="2" fill="#FFFFFF" opacity="0.2" />
        </g>
      );
  }
}

/** 奶茶 / 巧克力 / 棒棒糖 / 可乐 → SVG dataURL,供 matter.js sprite */
export function sugarBadgeDataUrl(variant: SugarBadgeVariant): string {
  const center = (() => {
    switch (variant) {
      case 'lollipop':
        return `<circle cx="32" cy="36" r="5.5" fill="#F4B6C2" stroke="#7B5320" stroke-width="1"/>
                <path d="M 28 36 Q 30 32 34 33 Q 36 35 33 38 Q 30 39 29 36" fill="#FFFFFF" opacity="0.7"/>
                <line x1="32" y1="41" x2="32" y2="48" stroke="#7B5320" stroke-width="1.5"/>`;
      case 'cola':
        return `<path d="M 27 30 L 27 32 Q 27 33 28 33 L 28 46 Q 28 48 30 48 L 34 48 Q 36 48 36 46 L 36 33 Q 37 33 37 32 L 37 30 Z" fill="#5C2E0E" stroke="#3A1B05" stroke-width="0.8"/>
                <rect x="29" y="28" width="6" height="2.5" fill="#C0392B" stroke="#7C2317" stroke-width="0.5"/>
                <rect x="28.5" y="38" width="7" height="3.5" fill="#F5D27A"/>`;
      case 'milktea':
        return `<path d="M 26 32 L 27 47 Q 27 48 28 48 L 36 48 Q 37 48 37 47 L 38 32 Z" fill="#C9A077" stroke="#7B5320" stroke-width="0.8"/>
                <rect x="25" y="30" width="14" height="2.5" rx="1" fill="#7B5320"/>
                <line x1="34" y1="22" x2="34" y2="45" stroke="#FFFFFF" stroke-width="1.5"/>
                <circle cx="29" cy="44" r="0.9" fill="#3A1B05"/>
                <circle cx="32" cy="46" r="0.9" fill="#3A1B05"/>
                <circle cx="35" cy="44" r="0.9" fill="#3A1B05"/>`;
      case 'chocolate':
        return `<rect x="24" y="32" width="16" height="12" rx="1" fill="#5C2E0E" stroke="#3A1B05" stroke-width="0.8"/>
                <line x1="28" y1="32" x2="28" y2="44" stroke="#3A1B05" stroke-width="0.5"/>
                <line x1="32" y1="32" x2="32" y2="44" stroke="#3A1B05" stroke-width="0.5"/>
                <line x1="36" y1="32" x2="36" y2="44" stroke="#3A1B05" stroke-width="0.5"/>
                <line x1="24" y1="38" x2="40" y2="38" stroke="#3A1B05" stroke-width="0.5"/>
                <rect x="24.5" y="32.5" width="15" height="2" fill="#FFFFFF" opacity="0.2"/>`;
    }
  })();
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="64" height="64">
    <defs><radialGradient id="g" cx="40%" cy="35%" r="65%">
      <stop offset="0%" stop-color="#F5D27A"/>
      <stop offset="60%" stop-color="#E0A93D"/>
      <stop offset="100%" stop-color="#A87432"/>
    </radialGradient></defs>
    <path d="M 22 6 L 28 32 L 18 28 L 14 14 Z" fill="#C0392B" stroke="#7C2317" stroke-width="1" stroke-linejoin="round"/>
    <path d="M 42 6 L 36 32 L 46 28 L 50 14 Z" fill="#C0392B" stroke="#7C2317" stroke-width="1" stroke-linejoin="round"/>
    <path d="M 22 6 L 26 16 L 14 14 Z" fill="#922416"/>
    <path d="M 42 6 L 38 16 L 50 14 Z" fill="#922416"/>
    <circle cx="32" cy="38" r="20" fill="url(#g)" stroke="#7B5320" stroke-width="1.5"/>
    <circle cx="32" cy="38" r="16" fill="none" stroke="#9D6F2A" stroke-width="0.8" opacity="0.6"/>
    <path d="M 18 30 Q 32 22 46 30" fill="none" stroke="#FFFFFF" stroke-width="1.5" opacity="0.5" stroke-linecap="round"/>
    ${center}
  </svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}
