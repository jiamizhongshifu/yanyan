/**
 * 控糖累计成就图标 — 软风格(替代金属奖牌 SugarBadgeIcon 用在控糖卡里)
 *
 * 设计:这是"累计成就"不是"勋章":
 *   - 圆角方形 pastel 底色,无金属描边、无 sparkle
 *   - 食物 SVG 居中(复用 SugarBadgeIcon 里的 CenterIcon)
 *   - 视觉暗示"统计 / 累计",而不是"奖牌"
 *
 * 用法:`<SugarAchievementIcon variant="milktea" className="w-7 h-7" />`
 */

import type { SugarBadgeVariant } from './SugarBadgeIcon';

interface Props {
  variant: SugarBadgeVariant;
  className?: string;
}

const TILE_BG: Record<SugarBadgeVariant, { bg: string; border: string }> = {
  lollipop: { bg: '#FCE7EC', border: '#E8B5C0' },
  cola: { bg: '#F4E4DA', border: '#D9B49A' },
  milktea: { bg: '#F5EBD8', border: '#D9C29A' },
  chocolate: { bg: '#EAE0D5', border: '#C9B89E' }
};

export function SugarAchievementIcon({ variant, className = 'w-7 h-7' }: Props) {
  const tile = TILE_BG[variant];
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden="true">
      {/* 软底圆角方块 */}
      <rect x="6" y="6" width="52" height="52" rx="12" fill={tile.bg} stroke={tile.border} strokeWidth="1" />
      <FoodIcon variant={variant} />
    </svg>
  );
}

/** 复用与 SugarBadgeIcon 一致的食物中心(去掉徽章金属外框,只保留食物本身) */
function FoodIcon({ variant }: { variant: SugarBadgeVariant }) {
  switch (variant) {
    case 'lollipop':
      return (
        <g>
          <circle cx="32" cy="30" r="9" fill="#FFF6E0" stroke="#7B2331" strokeWidth="1.4" />
          <path
            d="M 26 30 A 6 6 0 1 1 32 36 A 4 4 0 1 1 32 28 A 2 2 0 1 0 32 32"
            fill="none"
            stroke="#DA3E5C"
            strokeWidth="1.4"
            strokeLinecap="round"
          />
          <line x1="32" y1="38" x2="32" y2="48" stroke="#7B5320" strokeWidth="2" strokeLinecap="round" />
        </g>
      );
    case 'cola':
      return (
        <g>
          <path
            d="M 26 22 L 26 24 Q 25 25 25 26 L 25 44 Q 25 46 27 46 L 37 46 Q 39 46 39 44 L 39 26 Q 39 25 38 24 L 38 22 Z"
            fill="#3F1E0A"
            stroke="#1A0902"
            strokeWidth="0.8"
          />
          <rect x="26" y="20" width="12" height="3.5" rx="0.6" fill="#E83A3A" stroke="#7B1818" strokeWidth="0.6" />
          <rect x="26" y="33" width="12" height="6" fill="#F5D27A" />
          <text x="32" y="37" fontSize="3.4" textAnchor="middle" fill="#7B2317" fontWeight="bold">cola</text>
        </g>
      );
    case 'milktea':
      return (
        <g>
          <path
            d="M 22 26 L 23.5 46 Q 23.5 47 25 47 L 39 47 Q 40.5 47 40.5 46 L 42 26 Z"
            fill="#D9B889"
            stroke="#5A3A0A"
            strokeWidth="0.8"
          />
          <rect x="21" y="24" width="22" height="3.5" rx="0.6" fill="#5A3A0A" />
          <line x1="35" y1="14" x2="35" y2="44" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round" />
          <circle cx="29" cy="42" r="1.4" fill="#1A0902" />
          <circle cx="32" cy="44" r="1.4" fill="#1A0902" />
          <circle cx="35" cy="42" r="1.4" fill="#1A0902" />
        </g>
      );
    case 'chocolate':
      return (
        <g>
          <rect x="20" y="22" width="24" height="20" rx="1.6" fill="#3F1E0A" stroke="#1A0902" strokeWidth="0.8" />
          <line x1="26" y1="22" x2="26" y2="42" stroke="#1A0902" strokeWidth="0.5" />
          <line x1="32" y1="22" x2="32" y2="42" stroke="#1A0902" strokeWidth="0.5" />
          <line x1="38" y1="22" x2="38" y2="42" stroke="#1A0902" strokeWidth="0.5" />
          <line x1="20" y1="32" x2="44" y2="32" stroke="#1A0902" strokeWidth="0.5" />
          <rect x="20.5" y="22.5" width="23" height="2.5" fill="#FFFFFF" opacity="0.18" />
        </g>
      );
  }
}
