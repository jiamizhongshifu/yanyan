/**
 * 橘子图标 — 纯 SVG 绘制(替代以前的 PNG 插画)
 *
 * 5 个变体:
 *   - outline    线稿空心        (未来日)
 *   - gray       灰色填充        (过去日 / 今日 — 但还未拿到任何勋章等级)
 *   - nice       铜色金属橘子    (★2 留心 / nice 等级)
 *   - great      银色金属橘子    (★3-4 / great 等级)
 *   - perfect    金色金属 + 2 颗小星星(★5 / perfect 等级 — 完美一天)
 *
 * 设计语言:三档勋章用金/银/铜暗示等级层次,与现实奖牌一致。
 *
 * 使用:
 *   - JSX:`<OrangeIcon variant="perfect" className="w-7 h-7" />`
 *   - matter.js 精灵 / 任意需要 image URL 的地方:`orangeIconDataUrl('perfect')`
 */

export type OrangeVariant = 'outline' | 'gray' | 'nice' | 'great' | 'perfect';

interface Props {
  variant: OrangeVariant;
  className?: string;
}

export function OrangeIcon({ variant, className = 'w-6 h-6' }: Props) {
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden="true">
      <OrangeSvgInner variant={variant} />
    </svg>
  );
}

/** 共享内部 SVG 内容 — 也供 dataURL 拼装复用 */
function OrangeSvgInner({ variant }: { variant: OrangeVariant }) {
  const styles = STYLE[variant];
  return (
    <>
      <defs>
        <radialGradient id={`orange-grad-${variant}`} cx="40%" cy="35%" r="65%">
          <stop offset="0%" stopColor={styles.bodyHi} />
          <stop offset="100%" stopColor={styles.bodyLo} />
        </radialGradient>
      </defs>

      {/* 果体 */}
      <circle
        cx="32"
        cy="36"
        r="22"
        fill={variant === 'outline' ? 'none' : `url(#orange-grad-${variant})`}
        stroke={styles.stroke}
        strokeWidth="2"
      />

      {variant !== 'outline' && (
        <>
          {/* 高光 */}
          <ellipse cx="22" cy="26" rx="6" ry="4" fill="#FFFFFF" opacity="0.55" />
          {/* 脐点 */}
          <circle cx="32" cy="36" r="1.5" fill={styles.stroke} opacity="0.4" />
        </>
      )}

      {/* 茎 */}
      <path
        d={`M 30 14 Q 32 11 34 14 L 33 18 L 31 18 Z`}
        fill={variant === 'outline' ? 'none' : styles.stem}
        stroke={styles.stroke}
        strokeWidth="1.5"
        strokeLinejoin="round"
      />

      {/* 绿叶 */}
      <path
        d={`M 33 16 Q 44 12 48 18 Q 42 22 33 18 Z`}
        fill={variant === 'outline' ? 'none' : styles.leaf}
        stroke={styles.stroke}
        strokeWidth="1.5"
        strokeLinejoin="round"
      />

      {/* perfect 才有的星星 */}
      {variant === 'perfect' && (
        <>
          <Star cx={56} cy={20} size={3.5} />
          <Star cx={10} cy={48} size={2.8} />
        </>
      )}
    </>
  );
}

function Star({ cx, cy, size }: { cx: number; cy: number; size: number }) {
  const s = size;
  const path = `M ${cx} ${cy - s}
                L ${cx + s * 0.3} ${cy - s * 0.3}
                L ${cx + s} ${cy}
                L ${cx + s * 0.3} ${cy + s * 0.3}
                L ${cx} ${cy + s}
                L ${cx - s * 0.3} ${cy + s * 0.3}
                L ${cx - s} ${cy}
                L ${cx - s * 0.3} ${cy - s * 0.3} Z`;
  return <path d={path} fill="#F4C242" />;
}

/**
 * 调色:
 *   - gray:中性灰填充,无金属感(过去 / 今日未达成)
 *   - nice / 铜:暖咖啡橙 → 深棕铜
 *   - great / 银:冷月白 → 中灰银
 *   - perfect / 金:亮浅金 → 暖深金 + 星星
 */
const STYLE: Record<OrangeVariant, { bodyHi: string; bodyLo: string; stroke: string; stem: string; leaf: string }> = {
  outline: { bodyHi: 'transparent', bodyLo: 'transparent', stroke: '#C7BFA8', stem: 'none', leaf: 'none' },
  gray:    { bodyHi: '#E5E1D6', bodyLo: '#B5AE9D', stroke: '#9A927F', stem: '#7B746B', leaf: '#9DAA8B' },
  nice:    { bodyHi: '#E8B97A', bodyLo: '#A8662C', stroke: '#7A4313', stem: '#6B3A14', leaf: '#7BA56A' },
  great:   { bodyHi: '#F2F4F7', bodyLo: '#A8B0BC', stroke: '#6F7886', stem: '#5C6573', leaf: '#7BA56A' },
  perfect: { bodyHi: '#FFE588', bodyLo: '#C9970A', stroke: '#8B6508', stem: '#7A5A0A', leaf: '#7BA56A' }
};

/**
 * 把 OrangeIcon 渲染成 base64 data URL,用于 matter.js sprite / 任何只能吃 URL 的地方。
 * dataURL 是同步生成的字符串,不发起网络请求。
 */
export function orangeIconDataUrl(variant: OrangeVariant): string {
  const styles = STYLE[variant];
  const sparkles =
    variant === 'perfect'
      ? `<path d="M 56 20 m -3.5 0 l 1.05 -1.05 l 3.5 -3.5 l 1.05 1.05 l -3.5 3.5 z" fill="#F4C242"/>` +
        `<path d="M 10 48 m -2.8 0 l 0.84 -0.84 l 2.8 -2.8 l 0.84 0.84 l -2.8 2.8 z" fill="#F4C242"/>`
      : '';
  const fillBody =
    variant === 'outline'
      ? 'none'
      : `url(#g)`;
  const gradDef =
    variant === 'outline'
      ? ''
      : `<defs><radialGradient id="g" cx="40%" cy="35%" r="65%">
          <stop offset="0%" stop-color="${styles.bodyHi}"/>
          <stop offset="100%" stop-color="${styles.bodyLo}"/>
        </radialGradient></defs>`;
  const detail =
    variant === 'outline'
      ? ''
      : `<ellipse cx="22" cy="26" rx="6" ry="4" fill="#FFFFFF" opacity="0.55"/>
         <circle cx="32" cy="36" r="1.5" fill="${styles.stroke}" opacity="0.4"/>`;

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="64" height="64">
    ${gradDef}
    <circle cx="32" cy="36" r="22" fill="${fillBody}" stroke="${styles.stroke}" stroke-width="2"/>
    ${detail}
    <path d="M 30 14 Q 32 11 34 14 L 33 18 L 31 18 Z" fill="${variant === 'outline' ? 'none' : styles.stem}" stroke="${styles.stroke}" stroke-width="1.5" stroke-linejoin="round"/>
    <path d="M 33 16 Q 44 12 48 18 Q 42 22 33 18 Z" fill="${variant === 'outline' ? 'none' : styles.leaf}" stroke="${styles.stroke}" stroke-width="1.5" stroke-linejoin="round"/>
    ${sparkles}
  </svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}
