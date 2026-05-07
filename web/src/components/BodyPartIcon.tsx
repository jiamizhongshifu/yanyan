/**
 * 身体 4 Part 图标 — monoline SVG 风格
 *
 * 设计原则(对齐 components/Icon.tsx 的体例):
 *   - 24×24 viewBox,fill=none,stroke=currentColor,stroke-width=1.6
 *   - 圆形端点,统一线条,极简轮廓
 *   - 颜色由父层 className 控制(text-fire-ping / ink/40 等)
 *
 *   - food     饭碗 + 一双筷子
 *   - symptom  人形头肩(冥想感)
 *   - env      云 + 太阳
 *   - activity 一双脚印
 */

export type BodyPartVariant = 'food' | 'symptom' | 'env' | 'activity';

interface Props {
  variant: BodyPartVariant;
  className?: string;
}

const PATHS: Record<BodyPartVariant, JSX.Element> = {
  food: (
    <>
      {/* 碗 */}
      <path d="M 4 13 H 20 A 2 2 0 0 1 18 17 H 6 A 2 2 0 0 1 4 13 Z" />
      {/* 米线 */}
      <path d="M 7 13 H 17" />
      {/* 筷子 */}
      <path d="M 14 4 L 20 11" />
      <path d="M 16 3 L 22 10" />
    </>
  ),
  symptom: (
    <>
      {/* 头 */}
      <circle cx="12" cy="8" r="3" />
      {/* 肩 + 上半身 */}
      <path d="M 5 21 V 18 a 5 5 0 0 1 5 -5 h 4 a 5 5 0 0 1 5 5 V 21" />
    </>
  ),
  env: (
    <>
      {/* 云 */}
      <path d="M 5 16 a 3 3 0 0 1 1 -5 a 4 4 0 0 1 7 1 a 2.5 2.5 0 0 1 0 5 H 5 z" />
      {/* 太阳 */}
      <circle cx="17" cy="7" r="2.5" />
      <path d="M 17 2 v 1.5 M 17 10.5 v 1.5 M 12 7 h 1.5 M 20.5 7 H 22 M 13.6 3.6 l 1.1 1.1 M 19.4 9.4 l 1.1 1.1 M 13.6 10.4 l 1.1 -1.1 M 19.4 4.6 l 1.1 -1.1" />
    </>
  ),
  activity: (
    <>
      {/* 大脚印 */}
      <ellipse cx="8" cy="14" rx="3" ry="4" />
      <circle cx="6" cy="8.5" r="0.8" />
      <circle cx="8" cy="7.5" r="0.8" />
      <circle cx="10" cy="8.5" r="0.8" />
      {/* 小脚印 */}
      <ellipse cx="16" cy="18" rx="2.2" ry="3" />
      <circle cx="14.6" cy="13.8" r="0.6" />
      <circle cx="16" cy="13" r="0.6" />
      <circle cx="17.4" cy="13.8" r="0.6" />
    </>
  )
};

export function BodyPartIcon({ variant, className = 'w-10 h-10 text-ink/50' }: Props) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {PATHS[variant]}
    </svg>
  );
}
