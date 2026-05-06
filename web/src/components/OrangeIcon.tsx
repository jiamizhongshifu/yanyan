/**
 * 橘子图标 — 纯 SVG 绘制(替代以前的 PNG 插画)
 *
 * 4 个变体:
 *   - outline    线稿空心(过去未拿勋章 / 未来日)
 *   - nice       浅橘色填充     (★2 留心 / nice 等级)
 *   - great      中橘色填充     (★3-4 / great 等级)
 *   - perfect    亮橘色 + 高光 + 2 颗小星星(★5 / perfect 等级)
 *
 * 使用:
 *   - JSX:`<OrangeIcon variant="perfect" className="w-7 h-7" />`
 *   - matter.js 精灵 / 任意需要 image URL 的地方:`orangeIconDataUrl('perfect')`
 */

export type OrangeVariant = 'outline' | 'nice' | 'great' | 'perfect';

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
        fill={variant === 'outline' ? 'none' : '#7B5A2A'}
        stroke={styles.stroke}
        strokeWidth="1.5"
        strokeLinejoin="round"
      />

      {/* 绿叶 */}
      <path
        d={`M 33 16 Q 44 12 48 18 Q 42 22 33 18 Z`}
        fill={variant === 'outline' ? 'none' : '#7BA56A'}
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

const STYLE: Record<OrangeVariant, { bodyHi: string; bodyLo: string; stroke: string }> = {
  outline: { bodyHi: 'transparent', bodyLo: 'transparent', stroke: '#C7BFA8' },
  nice: { bodyHi: '#FAD2A1', bodyLo: '#F0B679', stroke: '#B8763F' },
  great: { bodyHi: '#F4B377', bodyLo: '#E8954E', stroke: '#A06228' },
  perfect: { bodyHi: '#FBC079', bodyLo: '#D9762C', stroke: '#8B4D1A' }
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
    <path d="M 30 14 Q 32 11 34 14 L 33 18 L 31 18 Z" fill="${variant === 'outline' ? 'none' : '#7B5A2A'}" stroke="${styles.stroke}" stroke-width="1.5" stroke-linejoin="round"/>
    <path d="M 33 16 Q 44 12 48 18 Q 42 22 33 18 Z" fill="${variant === 'outline' ? 'none' : '#7BA56A'}" stroke="${styles.stroke}" stroke-width="1.5" stroke-linejoin="round"/>
    ${sparkles}
  </svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}
