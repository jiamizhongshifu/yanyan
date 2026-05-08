/**
 * 橘子图标 — 软 3D 贴纸风(参考 emoji-icon set 风格)
 *
 * 5 个变体:
 *   - outline    线稿空心(未来日)
 *   - gray       灰色填充(过去 / 今日未达成)
 *   - nice       铜色金属橘子(★2 / 留心)
 *   - great      银色金属橘子(★3-4 / 美好)
 *   - perfect    金色金属 + 双星(★5 / 完美一天)
 *
 * 视觉基线(2026-05-08 升级):
 *   - 4-5 stop 多色 radialGradient,色彩从中心高光过渡到边缘饱和
 *   - 大面积柔光高光(radialGradient 替代单一椭圆),3D 贴纸感
 *   - 取消硬描边,改用渐变 + 底部柔阴影自然分隔
 *   - 沿用 gold/silver/bronze tier 隐喻,但配色更亮、更润、更"贴纸"
 *
 * 用法:
 *   - JSX:`<OrangeIcon variant="perfect" className="w-7 h-7" />`
 *   - matter.js 精灵 / data URL:`orangeIconDataUrl('perfect')`
 */

export type OrangeVariant = 'outline' | 'gray' | 'nice' | 'great' | 'perfect';

interface Props {
  variant: OrangeVariant;
  className?: string;
}

interface PaletteStops {
  /** body radial gradient 4 stops:中心 → 中亮 → 中深 → 边缘 */
  c0: string; // 0% center hi
  c40: string; // 40%
  c75: string; // 75%
  c100: string; // 100% edge
  stem: string;
  leaf1: string; // leaf gradient hi
  leaf2: string; // leaf gradient lo
  shadow: string;
  /** 装饰强调色(perfect 光环、great 单 sparkle) */
  accent?: string;
}

const STYLE: Record<OrangeVariant, PaletteStops> = {
  outline: {
    c0: 'transparent', c40: 'transparent', c75: 'transparent', c100: 'transparent',
    stem: 'none', leaf1: 'none', leaf2: 'none',
    shadow: 'transparent'
  },
  // 灰 — 中性奶米,无金属感
  gray: {
    c0: '#FBFAF7', c40: '#E8E2D4', c75: '#C3BBA8', c100: '#9A927F',
    stem: '#7B746B', leaf1: '#C5CFB8', leaf2: '#8FA284',
    shadow: 'rgba(0,0,0,0.08)'
  },
  // 铜 — 暖蜜桃 → 焦糖 → 深铜,饱和度高
  nice: {
    c0: '#FFF1DC', c40: '#FFC79A', c75: '#F09567', c100: '#B66A2C',
    stem: '#7A4313', leaf1: '#A6D69E', leaf2: '#5DB55A',
    shadow: 'rgba(166,75,15,0.18)'
  },
  // 银 — 月白 → 冰蓝 → 钢蓝,带轻微冷调彩虹
  great: {
    c0: '#FFFFFF', c40: '#E5EFF6', c75: '#A8C2D7', c100: '#5E7991',
    stem: '#3D4654', leaf1: '#B6D9B0', leaf2: '#5DB55A',
    shadow: 'rgba(80,90,110,0.18)'
  },
  // 金 — 奶油黄 → 蜂蜜金 → 焦金,最亮最饱和
  perfect: {
    c0: '#FFFAD6', c40: '#FFDA66', c75: '#FFA928', c100: '#B36A05',
    stem: '#7A5A0A', leaf1: '#C2E5A8', leaf2: '#5DB55A',
    shadow: 'rgba(180,110,5,0.22)',
    accent: '#FFD945'
  }
};

export function OrangeIcon({ variant, className = 'w-6 h-6' }: Props) {
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden="true">
      <OrangeSvgInner variant={variant} />
    </svg>
  );
}

function OrangeSvgInner({ variant }: { variant: OrangeVariant }) {
  const s = STYLE[variant];
  const id = variant;

  if (variant === 'outline') {
    // 未来日:仅淡描边,无填充,保持轻盈
    return (
      <>
        <circle cx="32" cy="36" r="22" fill="none" stroke="#C7BFA8" strokeWidth="1.6" />
        <path
          d="M 30 14 Q 32 11 34 14 L 33 18 L 31 18 Z"
          fill="none"
          stroke="#C7BFA8"
          strokeWidth="1.4"
          strokeLinejoin="round"
        />
        <path
          d="M 33 16 Q 45 11 49 18 Q 42 22 33 18 Z"
          fill="none"
          stroke="#C7BFA8"
          strokeWidth="1.4"
          strokeLinejoin="round"
        />
      </>
    );
  }

  return (
    <>
      <defs>
        {/* 4-stop body 渐变 — 多色软过渡 */}
        <radialGradient id={`og-body-${id}`} cx="38%" cy="32%" r="78%">
          <stop offset="0%" stopColor={s.c0} />
          <stop offset="40%" stopColor={s.c40} />
          <stop offset="75%" stopColor={s.c75} />
          <stop offset="100%" stopColor={s.c100} />
        </radialGradient>
        {/* 大面积柔光 — 上半部白雾,模拟 3D 贴纸光泽 */}
        <radialGradient id={`og-glow-${id}`} cx="35%" cy="22%" r="55%">
          <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.95" />
          <stop offset="55%" stopColor="#FFFFFF" stopOpacity="0.25" />
          <stop offset="100%" stopColor="#FFFFFF" stopOpacity="0" />
        </radialGradient>
        {/* 叶子渐变 */}
        <linearGradient id={`og-leaf-${id}`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor={s.leaf1} />
          <stop offset="100%" stopColor={s.leaf2} />
        </linearGradient>
      </defs>

      {/* perfect:头顶柔光环 */}
      {variant === 'perfect' && (
        <ellipse
          cx="32"
          cy="9"
          rx="11"
          ry="2.4"
          fill="none"
          stroke={s.accent}
          strokeWidth="1.5"
          opacity="0.9"
        />
      )}

      {/* 底部柔阴影 — 椭圆,与果体分离感 */}
      <ellipse cx="32" cy="60" rx="18" ry="2.5" fill={s.shadow} />

      {/* 果体 — 多色软渐变,无硬描边 */}
      <circle cx="32" cy="36" r="22" fill={`url(#og-body-${id})`} />

      {/* 大柔光高光 */}
      <ellipse cx="24" cy="24" rx="14" ry="10" fill={`url(#og-glow-${id})`} />

      {/* 副高光小亮点 */}
      <ellipse cx="20" cy="32" rx="2.4" ry="1.3" fill="#FFFFFF" opacity="0.65" />

      {/* 脐点(不要硬黑点,改成 deeper tone 小阴影) */}
      <circle cx="32" cy="40" r="1.4" fill={s.c100} opacity="0.35" />

      {/* 茎 — 简化,无描边 */}
      <path
        d="M 30.5 15 Q 32 12 33.5 15 L 32.8 19 L 31.2 19 Z"
        fill={s.stem}
      />

      {/* 绿叶 — 带渐变 */}
      <path
        d="M 33 16 Q 46 12 49 18 Q 42 22 33 18 Z"
        fill={`url(#og-leaf-${id})`}
      />
      <path
        d="M 35 17 Q 41 16 47 18"
        fill="none"
        stroke="#FFFFFF"
        strokeWidth="0.7"
        opacity="0.55"
        strokeLinecap="round"
      />

      {/* great:1 颗白 sparkle */}
      {variant === 'great' && <Sparkle cx={54} cy={22} size={3} fill="#FFFFFF" />}

      {/* perfect:2 颗金 sparkle */}
      {variant === 'perfect' && (
        <>
          <Sparkle cx={56} cy={22} size={3.6} fill={s.accent!} />
          <Sparkle cx={10} cy={50} size={3} fill={s.accent!} />
        </>
      )}
    </>
  );
}

/** 4 角星 sparkle */
function Sparkle({ cx, cy, size, fill }: { cx: number; cy: number; size: number; fill: string }) {
  const s = size;
  const path = `M ${cx} ${cy - s}
                L ${cx + s * 0.3} ${cy - s * 0.3}
                L ${cx + s} ${cy}
                L ${cx + s * 0.3} ${cy + s * 0.3}
                L ${cx} ${cy + s}
                L ${cx - s * 0.3} ${cy + s * 0.3}
                L ${cx - s} ${cy}
                L ${cx - s * 0.3} ${cy - s * 0.3} Z`;
  return <path d={path} fill={fill} />;
}

/**
 * SVG → data URL — 给 matter.js sprite / 任何只能吃 URL 的地方。
 * 必须与 JSX 视觉一致。
 */
export function orangeIconDataUrl(variant: OrangeVariant): string {
  const s = STYLE[variant];
  const id = variant;

  if (variant === 'outline') {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="64" height="64">
      <circle cx="32" cy="36" r="22" fill="none" stroke="#C7BFA8" stroke-width="1.6"/>
      <path d="M 30 14 Q 32 11 34 14 L 33 18 L 31 18 Z" fill="none" stroke="#C7BFA8" stroke-width="1.4" stroke-linejoin="round"/>
      <path d="M 33 16 Q 45 11 49 18 Q 42 22 33 18 Z" fill="none" stroke="#C7BFA8" stroke-width="1.4" stroke-linejoin="round"/>
    </svg>`;
    return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
  }

  const halo = variant === 'perfect' && s.accent
    ? `<ellipse cx="32" cy="9" rx="11" ry="2.4" fill="none" stroke="${s.accent}" stroke-width="1.5" opacity="0.9"/>`
    : '';

  const sparkles = (() => {
    const star = (cx: number, cy: number, sz: number, fill: string) => {
      const path = `M ${cx} ${cy - sz} L ${cx + sz * 0.3} ${cy - sz * 0.3} L ${cx + sz} ${cy} L ${cx + sz * 0.3} ${cy + sz * 0.3} L ${cx} ${cy + sz} L ${cx - sz * 0.3} ${cy + sz * 0.3} L ${cx - sz} ${cy} L ${cx - sz * 0.3} ${cy - sz * 0.3} Z`;
      return `<path d="${path}" fill="${fill}"/>`;
    };
    if (variant === 'great') return star(54, 22, 3, '#FFFFFF');
    if (variant === 'perfect' && s.accent) return star(56, 22, 3.6, s.accent) + star(10, 50, 3, s.accent);
    return '';
  })();

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="64" height="64">
    <defs>
      <radialGradient id="og-body-${id}" cx="38%" cy="32%" r="78%">
        <stop offset="0%" stop-color="${s.c0}"/>
        <stop offset="40%" stop-color="${s.c40}"/>
        <stop offset="75%" stop-color="${s.c75}"/>
        <stop offset="100%" stop-color="${s.c100}"/>
      </radialGradient>
      <radialGradient id="og-glow-${id}" cx="35%" cy="22%" r="55%">
        <stop offset="0%" stop-color="#FFFFFF" stop-opacity="0.95"/>
        <stop offset="55%" stop-color="#FFFFFF" stop-opacity="0.25"/>
        <stop offset="100%" stop-color="#FFFFFF" stop-opacity="0"/>
      </radialGradient>
      <linearGradient id="og-leaf-${id}" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="${s.leaf1}"/>
        <stop offset="100%" stop-color="${s.leaf2}"/>
      </linearGradient>
    </defs>
    ${halo}
    <ellipse cx="32" cy="60" rx="18" ry="2.5" fill="${s.shadow}"/>
    <circle cx="32" cy="36" r="22" fill="url(#og-body-${id})"/>
    <ellipse cx="24" cy="24" rx="14" ry="10" fill="url(#og-glow-${id})"/>
    <ellipse cx="20" cy="32" rx="2.4" ry="1.3" fill="#FFFFFF" opacity="0.65"/>
    <circle cx="32" cy="40" r="1.4" fill="${s.c100}" opacity="0.35"/>
    <path d="M 30.5 15 Q 32 12 33.5 15 L 32.8 19 L 31.2 19 Z" fill="${s.stem}"/>
    <path d="M 33 16 Q 46 12 49 18 Q 42 22 33 18 Z" fill="url(#og-leaf-${id})"/>
    <path d="M 35 17 Q 41 16 47 18" fill="none" stroke="#FFFFFF" stroke-width="0.7" opacity="0.55" stroke-linecap="round"/>
    ${sparkles}
  </svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}
