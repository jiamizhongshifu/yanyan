/**
 * 抗炎指数 4 档徽标 — 纯 SVG 绘制(替代 level-{ping,weihuo,zhonghuo,dahuo}.png)
 *
 * 设计:统一火焰形态,色彩 + 大小递增表达"炎症程度":
 *   - 平   → 一片绿叶(清气状态,无火苗)
 *   - 微火 → 小火苗(暖黄)
 *   - 中火 → 中火苗(橙)
 *   - 大火 → 大火苗 + 火星(深橙偏红)
 *
 * 用法:
 *   - JSX: `<LevelIcon level="平" className="w-7 h-7" />`
 *   - matter / image src: `levelIconDataUrl('平')` 同步 dataURL
 */

import type { FireLevel } from '../services/symptoms';

interface Props {
  level: FireLevel;
  className?: string;
}

interface Palette {
  hi: string;
  lo: string;
  edge: string;
}

const PALETTES: Record<FireLevel, Palette> = {
  平: { hi: '#A8D8A0', lo: '#5C9C5A', edge: '#3A6B38' },
  微火: { hi: '#FBE08A', lo: '#E0A93D', edge: '#7C5615' },
  中火: { hi: '#F5B077', lo: '#D9762C', edge: '#8B4D1A' },
  大火: { hi: '#F08960', lo: '#B43A30', edge: '#7C2317' }
};

export function LevelIcon({ level, className = 'w-7 h-7' }: Props) {
  const id = `lvl-${level === '平' ? 'p' : level === '微火' ? 'w' : level === '中火' ? 'z' : 'd'}`;
  const p = PALETTES[level];
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden="true">
      <defs>
        <radialGradient id={`${id}-fill`} cx="40%" cy="60%" r="60%">
          <stop offset="0%" stopColor={p.hi} />
          <stop offset="100%" stopColor={p.lo} />
        </radialGradient>
      </defs>
      {level === '平' ? (
        <LeafShape fillId={id} edge={p.edge} />
      ) : (
        <FlameShape level={level} fillId={id} edge={p.edge} />
      )}
    </svg>
  );
}

/** 平和叶子:正中间一片大叶 + 茎 */
function LeafShape({ fillId, edge }: { fillId: string; edge: string }) {
  return (
    <g>
      {/* 主叶 */}
      <path
        d="M 32 8 Q 18 18 18 36 Q 18 50 32 56 Q 46 50 46 36 Q 46 18 32 8 Z"
        fill={`url(#${fillId}-fill)`}
        stroke={edge}
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      {/* 中脉 */}
      <line x1="32" y1="14" x2="32" y2="52" stroke={edge} strokeWidth="1.2" opacity="0.55" />
      {/* 侧脉 */}
      <path
        d="M 32 22 L 24 28 M 32 30 L 22 36 M 32 38 L 24 44 M 32 22 L 40 28 M 32 30 L 42 36 M 32 38 L 40 44"
        fill="none"
        stroke={edge}
        strokeWidth="0.8"
        opacity="0.45"
        strokeLinecap="round"
      />
      {/* 高光 */}
      <path
        d="M 26 20 Q 22 28 22 38"
        fill="none"
        stroke="#FFFFFF"
        strokeWidth="2"
        opacity="0.5"
        strokeLinecap="round"
      />
    </g>
  );
}

/** 火焰:微火/中火/大火 共用形状,size 递增 */
function FlameShape({
  level,
  fillId,
  edge
}: {
  level: '微火' | '中火' | '大火';
  fillId: string;
  edge: string;
}) {
  // 火焰大小 + 火星
  const config = {
    微火: { topY: 18, sideX: 14, sparks: false },
    中火: { topY: 12, sideX: 17, sparks: false },
    大火: { topY: 6, sideX: 19, sparks: true }
  }[level];

  const path = `
    M 32 ${config.topY}
    C ${32 - config.sideX} ${config.topY + 12} ${32 - config.sideX} 38 ${32 - config.sideX * 0.6} 46
    Q 32 56 ${32 + config.sideX * 0.6} 46
    C ${32 + config.sideX} 38 ${32 + config.sideX} ${config.topY + 12} 32 ${config.topY}
    Z
  `.trim();

  // 内焰(亮黄)
  const innerPath = `
    M 32 ${config.topY + 8}
    C ${32 - config.sideX * 0.55} ${config.topY + 16} ${32 - config.sideX * 0.55} 38 ${32 - config.sideX * 0.35} 44
    Q 32 50 ${32 + config.sideX * 0.35} 44
    C ${32 + config.sideX * 0.55} 38 ${32 + config.sideX * 0.55} ${config.topY + 16} 32 ${config.topY + 8}
    Z
  `.trim();

  return (
    <g>
      <path d={path} fill={`url(#${fillId}-fill)`} stroke={edge} strokeWidth="1.5" strokeLinejoin="round" />
      <path d={innerPath} fill="#FFEFB0" opacity="0.85" />
      {config.sparks && (
        <>
          <circle cx="14" cy="20" r="1.5" fill="#F4C242" />
          <circle cx="50" cy="14" r="1.8" fill="#F4C242" />
          <circle cx="48" cy="32" r="1.2" fill="#F4C242" />
        </>
      )}
    </g>
  );
}

/** 同步生成 dataURL,供任何只能吃 image src 的地方 */
export function levelIconDataUrl(level: FireLevel): string {
  const p = PALETTES[level];

  const inner =
    level === '平'
      ? `<path d="M 32 8 Q 18 18 18 36 Q 18 50 32 56 Q 46 50 46 36 Q 46 18 32 8 Z" fill="url(#g)" stroke="${p.edge}" stroke-width="1.5" stroke-linejoin="round"/>
         <line x1="32" y1="14" x2="32" y2="52" stroke="${p.edge}" stroke-width="1.2" opacity="0.55"/>
         <path d="M 26 20 Q 22 28 22 38" fill="none" stroke="#FFFFFF" stroke-width="2" opacity="0.5" stroke-linecap="round"/>`
      : (() => {
          const cfg = { 微火: { topY: 18, sideX: 14 }, 中火: { topY: 12, sideX: 17 }, 大火: { topY: 6, sideX: 19 } }[level];
          const sx = cfg.sideX;
          const topY = cfg.topY;
          const path = `M 32 ${topY} C ${32 - sx} ${topY + 12} ${32 - sx} 38 ${32 - sx * 0.6} 46 Q 32 56 ${32 + sx * 0.6} 46 C ${32 + sx} 38 ${32 + sx} ${topY + 12} 32 ${topY} Z`;
          const ip = `M 32 ${topY + 8} C ${32 - sx * 0.55} ${topY + 16} ${32 - sx * 0.55} 38 ${32 - sx * 0.35} 44 Q 32 50 ${32 + sx * 0.35} 44 C ${32 + sx * 0.55} 38 ${32 + sx * 0.55} ${topY + 16} 32 ${topY + 8} Z`;
          const sparks =
            level === '大火'
              ? `<circle cx="14" cy="20" r="1.5" fill="#F4C242"/><circle cx="50" cy="14" r="1.8" fill="#F4C242"/><circle cx="48" cy="32" r="1.2" fill="#F4C242"/>`
              : '';
          return `<path d="${path}" fill="url(#g)" stroke="${p.edge}" stroke-width="1.5" stroke-linejoin="round"/>
                  <path d="${ip}" fill="#FFEFB0" opacity="0.85"/>
                  ${sparks}`;
        })();

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="64" height="64">
    <defs><radialGradient id="g" cx="40%" cy="60%" r="60%">
      <stop offset="0%" stop-color="${p.hi}"/>
      <stop offset="100%" stop-color="${p.lo}"/>
    </radialGradient></defs>
    ${inner}
  </svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}
