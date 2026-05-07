/**
 * 橘子图标 — 纯 SVG 绘制(替代 PNG 插画)
 *
 * 5 个变体:
 *   - outline    线稿空心       (未来日)
 *   - gray       灰色填充       (过去/今日 — 还未拿到任何 tier)
 *   - nice       铜色橘子 ★2    (留心)
 *   - great      银色橘子 ★3-4  (美好一天) — 加 1 颗 sparkle
 *   - perfect    金色橘子 ★5    (完美一天)— 头顶光环 + 2 颗星星
 *
 * 设计基线(参考 v2 反馈):
 *   - 三档勋章必须明显区分(色相 + 装饰)
 *   - 颜色饱和度提高,告别"暗淡"
 *   - 三层径向渐变 + 主高光 + 副高光,有明显 3D 玻璃光泽感
 *   - 叶子用饱和绿,与金/银/铜形成强烈对比
 *
 * 使用:
 *   - JSX:`<OrangeIcon variant="perfect" className="w-7 h-7" />`
 *   - matter.js sprite / 任何只能吃 URL 的地方:`orangeIconDataUrl('perfect')`
 */

export type OrangeVariant = 'outline' | 'gray' | 'nice' | 'great' | 'perfect';

interface Props {
  variant: OrangeVariant;
  className?: string;
}

interface PaletteStops {
  /** 三层径向渐变:从最亮(中心)到最深(边缘) */
  hi: string;
  mid: string;
  lo: string;
  stroke: string;
  stem: string;
  leaf: string;
}

const STYLE: Record<OrangeVariant, PaletteStops> = {
  outline: { hi: 'transparent', mid: 'transparent', lo: 'transparent', stroke: '#C7BFA8', stem: 'none', leaf: 'none' },

  gray:    { hi: '#EEEAE0', mid: '#CDC6B5', lo: '#9A927F', stroke: '#857C68', stem: '#6B6358', leaf: '#9AA88A' },

  // 铜 — 暖橙铜,饱和度提升告别"棕"感;近肉色 → 焦糖 → 深铜
  nice:    { hi: '#FFE0B5', mid: '#F0964B', lo: '#A04E14', stroke: '#6E300A', stem: '#5C2A0A', leaf: '#5DB55A' },

  // 银 — 偏冷月白 → 中亮灰 → 钢蓝灰,对比比之前强,不再像褪色
  great:   { hi: '#FBFCFD', mid: '#C8D2DE', lo: '#5E6878', stroke: '#3D4654', stem: '#3D4654', leaf: '#5DB55A' },

  // 金 — 浅奶金 → 鲜亮蜂蜜金 → 深焦金,饱和度推到极致
  perfect: { hi: '#FFF6CC', mid: '#FFCB3D', lo: '#A87504', stroke: '#6B4A04', stem: '#5C4004', leaf: '#5DB55A' }
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
  const id = variant; // 多个 OrangeIcon 同页时,gradient id 必须区分
  return (
    <>
      <defs>
        {/* 三层径向 — 中心高光 → 中调 → 边缘深色 */}
        <radialGradient id={`og-body-${id}`} cx="38%" cy="32%" r="72%">
          <stop offset="0%" stopColor={s.hi} />
          <stop offset="50%" stopColor={s.mid} />
          <stop offset="100%" stopColor={s.lo} />
        </radialGradient>
        {/* 主高光 — 椭圆白光,模拟玻璃球反射 */}
        <radialGradient id={`og-glow-${id}`} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.85" />
          <stop offset="60%" stopColor="#FFFFFF" stopOpacity="0.25" />
          <stop offset="100%" stopColor="#FFFFFF" stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* 完美一天才有的头顶光环 — 在果体之前画,被叶子半遮 */}
      {variant === 'perfect' && (
        <ellipse
          cx="32"
          cy="9"
          rx="11"
          ry="2.6"
          fill="none"
          stroke="#FFD945"
          strokeWidth="1.6"
          opacity="0.95"
        />
      )}

      {/* 果体 */}
      <circle
        cx="32"
        cy="36"
        r="22"
        fill={variant === 'outline' ? 'none' : `url(#og-body-${id})`}
        stroke={s.stroke}
        strokeWidth="2"
      />

      {variant !== 'outline' && (
        <>
          {/* 主高光 — 大椭圆 */}
          <ellipse cx="23" cy="25" rx="8" ry="5.2" fill={`url(#og-glow-${id})`} />
          {/* 副高光 — 小亮点,glossy 感关键 */}
          <ellipse cx="19" cy="31" rx="2.2" ry="1.4" fill="#FFFFFF" opacity="0.55" />
          {/* 脐点 */}
          <circle cx="32" cy="38" r="1.4" fill={s.stroke} opacity="0.45" />
        </>
      )}

      {/* 茎 */}
      <path
        d="M 30 14 Q 32 11 34 14 L 33 18 L 31 18 Z"
        fill={variant === 'outline' ? 'none' : s.stem}
        stroke={s.stroke}
        strokeWidth="1.4"
        strokeLinejoin="round"
      />

      {/* 绿叶 — 加深 + 加 1 条主脉 */}
      <path
        d="M 33 16 Q 45 11 49 18 Q 42 22 33 18 Z"
        fill={variant === 'outline' ? 'none' : s.leaf}
        stroke={s.stroke}
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
      {variant !== 'outline' && variant !== 'gray' && (
        <path
          d="M 35 17.5 Q 41 16 47 18"
          fill="none"
          stroke="#FFFFFF"
          strokeWidth="0.6"
          opacity="0.5"
          strokeLinecap="round"
        />
      )}

      {/* great 加 1 颗小 sparkle 区分于 nice */}
      {variant === 'great' && <Sparkle cx={54} cy={22} size={3} fill="#FFFFFF" />}

      {/* perfect 才有的 2 颗金星 */}
      {variant === 'perfect' && (
        <>
          <Sparkle cx={56} cy={22} size={3.6} fill="#FFD945" />
          <Sparkle cx={10} cy={50} size={3} fill="#FFD945" />
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
 * 必须与上面 JSX 视觉一致;独立字符串拼装,跟随 STYLE 变化。
 */
export function orangeIconDataUrl(variant: OrangeVariant): string {
  const s = STYLE[variant];
  const id = variant;

  if (variant === 'outline') {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="64" height="64">
      <circle cx="32" cy="36" r="22" fill="none" stroke="${s.stroke}" stroke-width="2"/>
      <path d="M 30 14 Q 32 11 34 14 L 33 18 L 31 18 Z" fill="none" stroke="${s.stroke}" stroke-width="1.4" stroke-linejoin="round"/>
      <path d="M 33 16 Q 45 11 49 18 Q 42 22 33 18 Z" fill="none" stroke="${s.stroke}" stroke-width="1.4" stroke-linejoin="round"/>
    </svg>`;
    return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
  }

  const halo = variant === 'perfect'
    ? `<ellipse cx="32" cy="9" rx="11" ry="2.6" fill="none" stroke="#FFD945" stroke-width="1.6" opacity="0.95"/>`
    : '';

  const sparkles = (() => {
    const star = (cx: number, cy: number, sz: number, fill: string) => {
      const path = `M ${cx} ${cy - sz} L ${cx + sz * 0.3} ${cy - sz * 0.3} L ${cx + sz} ${cy} L ${cx + sz * 0.3} ${cy + sz * 0.3} L ${cx} ${cy + sz} L ${cx - sz * 0.3} ${cy + sz * 0.3} L ${cx - sz} ${cy} L ${cx - sz * 0.3} ${cy - sz * 0.3} Z`;
      return `<path d="${path}" fill="${fill}"/>`;
    };
    if (variant === 'great') return star(54, 22, 3, '#FFFFFF');
    if (variant === 'perfect') return star(56, 22, 3.6, '#FFD945') + star(10, 50, 3, '#FFD945');
    return '';
  })();

  const leafVein = variant !== 'gray'
    ? `<path d="M 35 17.5 Q 41 16 47 18" fill="none" stroke="#FFFFFF" stroke-width="0.6" opacity="0.5" stroke-linecap="round"/>`
    : '';

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="64" height="64">
    <defs>
      <radialGradient id="og-body-${id}" cx="38%" cy="32%" r="72%">
        <stop offset="0%" stop-color="${s.hi}"/>
        <stop offset="50%" stop-color="${s.mid}"/>
        <stop offset="100%" stop-color="${s.lo}"/>
      </radialGradient>
      <radialGradient id="og-glow-${id}" cx="50%" cy="50%" r="50%">
        <stop offset="0%" stop-color="#FFFFFF" stop-opacity="0.85"/>
        <stop offset="60%" stop-color="#FFFFFF" stop-opacity="0.25"/>
        <stop offset="100%" stop-color="#FFFFFF" stop-opacity="0"/>
      </radialGradient>
    </defs>
    ${halo}
    <circle cx="32" cy="36" r="22" fill="url(#og-body-${id})" stroke="${s.stroke}" stroke-width="2"/>
    <ellipse cx="23" cy="25" rx="8" ry="5.2" fill="url(#og-glow-${id})"/>
    <ellipse cx="19" cy="31" rx="2.2" ry="1.4" fill="#FFFFFF" opacity="0.55"/>
    <circle cx="32" cy="38" r="1.4" fill="${s.stroke}" opacity="0.45"/>
    <path d="M 30 14 Q 32 11 34 14 L 33 18 L 31 18 Z" fill="${s.stem}" stroke="${s.stroke}" stroke-width="1.4" stroke-linejoin="round"/>
    <path d="M 33 16 Q 45 11 49 18 Q 42 22 33 18 Z" fill="${s.leaf}" stroke="${s.stroke}" stroke-width="1.4" stroke-linejoin="round"/>
    ${leafVein}
    ${sparkles}
  </svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}
