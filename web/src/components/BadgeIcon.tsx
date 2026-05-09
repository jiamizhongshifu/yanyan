/**
 * 多形状勋章图标库 — 9 个 tier 形状 + 2 个 orange fallback
 *
 * 视觉基线(与 OrangeIcon 同款):
 *   - 4-stop radialGradient body
 *   - 双层高光(大柔光 + 小副高光)
 *   - 无硬描边,靠渐变自然分隔
 *   - viewBox 64×64,与 OrangeIcon 一致(matter.js sprite 复用 scale 逻辑)
 *
 * tier 池:
 *   - nice    candy / lollipop / cookie    糖果池
 *   - great   soda / chocolate / icecream  汽水池
 *   - perfect sun / star / crown            太阳池
 *
 * fallback:
 *   - orange-outline 未来日空心
 *   - orange-gray    过去/今日 + 无 tier
 *
 * 用法:
 *   <BadgeIcon shape="cake" className="w-7 h-7" />
 *   badgeIconDataUrl('cake')  // matter.js sprite
 */

import type { BadgeShape } from '../services/badgePicker';

export type BadgeIconShape = BadgeShape | 'orange-outline' | 'orange-gray';

interface Props {
  shape: BadgeIconShape;
  className?: string;
}

export function BadgeIcon({ shape, className = 'w-6 h-6' }: Props) {
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden="true">
      <BadgeInner shape={shape} />
    </svg>
  );
}

function BadgeInner({ shape }: { shape: BadgeIconShape }) {
  switch (shape) {
    case 'orange-outline':
      return <OrangeOutline />;
    case 'orange-gray':
      return <OrangeGray />;
    case 'candy':
      return <Candy />;
    case 'lollipop':
      return <Lollipop />;
    case 'cookie':
      return <Cookie />;
    case 'soda':
      return <Soda />;
    case 'chocolate':
      return <Chocolate />;
    case 'icecream':
      return <Icecream />;
    case 'cake':
      return <Cake />;
    case 'sushi':
      return <Sushi />;
    case 'pizza':
      return <Pizza />;
  }
}

// ─── 共享:辅助 gradient defs ──────────────────────

function GradientDefs({
  id,
  c0,
  c40,
  c75,
  c100
}: {
  id: string;
  c0: string;
  c40: string;
  c75: string;
  c100: string;
}) {
  return (
    <defs>
      <radialGradient id={`bg-body-${id}`} cx="38%" cy="32%" r="78%">
        <stop offset="0%" stopColor={c0} />
        <stop offset="40%" stopColor={c40} />
        <stop offset="75%" stopColor={c75} />
        <stop offset="100%" stopColor={c100} />
      </radialGradient>
      <radialGradient id={`bg-glow-${id}`} cx="35%" cy="22%" r="55%">
        <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.95" />
        <stop offset="55%" stopColor="#FFFFFF" stopOpacity="0.25" />
        <stop offset="100%" stopColor="#FFFFFF" stopOpacity="0" />
      </radialGradient>
    </defs>
  );
}

function Highlight({ cx = 24, cy = 24, rx = 14, ry = 10, glowId }: { cx?: number; cy?: number; rx?: number; ry?: number; glowId: string }) {
  return (
    <>
      <ellipse cx={cx} cy={cy} rx={rx} ry={ry} fill={`url(#bg-glow-${glowId})`} />
      <ellipse cx={cx - 4} cy={cy + 7} rx={2.4} ry={1.3} fill="#FFFFFF" opacity="0.6" />
    </>
  );
}

// ─── orange fallback ──────────────────────────────

function OrangeOutline() {
  return (
    <>
      <circle cx="32" cy="36" r="22" fill="none" stroke="#C7BFA8" strokeWidth="1.6" />
      <path d="M 30 14 Q 32 11 34 14 L 33 18 L 31 18 Z" fill="none" stroke="#C7BFA8" strokeWidth="1.4" strokeLinejoin="round" />
      <path d="M 33 16 Q 45 11 49 18 Q 42 22 33 18 Z" fill="none" stroke="#C7BFA8" strokeWidth="1.4" strokeLinejoin="round" />
    </>
  );
}

function OrangeGray() {
  return (
    <>
      <GradientDefs id="og" c0="#FBFAF7" c40="#E8E2D4" c75="#C3BBA8" c100="#9A927F" />
      <circle cx="32" cy="36" r="22" fill="url(#bg-body-og)" />
      <Highlight glowId="og" />
      <circle cx="32" cy="40" r="1.4" fill="#9A927F" opacity="0.35" />
      <path d="M 30.5 15 Q 32 12 33.5 15 L 32.8 19 L 31.2 19 Z" fill="#7B746B" />
      <path d="M 33 16 Q 46 12 49 18 Q 42 22 33 18 Z" fill="#9DAA8B" />
    </>
  );
}

// ─── nice 池:糖果 / 棒棒糖 / 饼干 ──────────────────

/** 糖果 — 椭圆糖体 + 两端扭结纸,粉色调 */
function Candy() {
  return (
    <>
      <GradientDefs id="cd" c0="#FFE4EC" c40="#FFA8C2" c75="#E66D8E" c100="#A8385A" />
      {/* 左扭结 */}
      <path d="M 6 32 L 14 24 L 14 40 Z" fill="#FFA8C2" />
      <path d="M 6 32 L 14 28 L 12 32 L 14 36 Z" fill="#E66D8E" opacity="0.6" />
      {/* 右扭结 */}
      <path d="M 58 32 L 50 24 L 50 40 Z" fill="#FFA8C2" />
      <path d="M 58 32 L 50 28 L 52 32 L 50 36 Z" fill="#E66D8E" opacity="0.6" />
      {/* 糖体 椭圆 */}
      <ellipse cx="32" cy="32" rx="20" ry="13" fill="url(#bg-body-cd)" />
      {/* 高光 */}
      <ellipse cx="25" cy="26" rx="8" ry="4.5" fill="url(#bg-glow-cd)" />
      <ellipse cx="22" cy="30" rx="2" ry="1.1" fill="#FFFFFF" opacity="0.6" />
      {/* 螺旋装饰条 */}
      <path d="M 18 32 Q 24 26, 32 32 Q 40 38, 46 32" fill="none" stroke="#FFFFFF" strokeWidth="1.4" opacity="0.55" strokeLinecap="round" />
    </>
  );
}

/** 棒棒糖 — 圆球糖头 + 木棒 */
function Lollipop() {
  return (
    <>
      <GradientDefs id="lp" c0="#FFE0E8" c40="#FF8FB0" c75="#D9446F" c100="#8B1F3D" />
      {/* 木棒 */}
      <rect x="30.5" y="36" width="3" height="22" rx="1.3" fill="#C8A572" />
      <rect x="30.5" y="36" width="1" height="22" fill="#FFFFFF" opacity="0.45" />
      {/* 糖球 */}
      <circle cx="32" cy="24" r="18" fill="url(#bg-body-lp)" />
      {/* 螺旋糖纹 */}
      <path
        d="M 32 24 m -10 0 a 10 10 0 1 1 10 10 a 6 6 0 1 1 -6 -6 a 3 3 0 1 1 3 3"
        fill="none"
        stroke="#FFFFFF"
        strokeWidth="1.6"
        opacity="0.7"
        strokeLinecap="round"
      />
      {/* 高光 */}
      <ellipse cx="25" cy="18" rx="7" ry="4" fill="url(#bg-glow-lp)" />
      <ellipse cx="22" cy="22" rx="1.8" ry="1" fill="#FFFFFF" opacity="0.7" />
    </>
  );
}

/** 饼干 — 圆形 + 巧克力豆 */
function Cookie() {
  return (
    <>
      <GradientDefs id="ck" c0="#FFE9C4" c40="#E8B97A" c75="#B6803D" c100="#6E4818" />
      <circle cx="32" cy="32" r="24" fill="url(#bg-body-ck)" />
      {/* 边缘咬痕(轻微凹) */}
      <circle cx="32" cy="32" r="24" fill="none" stroke="#6E4818" strokeWidth="0.5" opacity="0.3" strokeDasharray="2 4" />
      {/* 巧克力豆 */}
      <circle cx="22" cy="24" r="2.6" fill="#3D1E0A" />
      <circle cx="40" cy="22" r="2.2" fill="#3D1E0A" />
      <circle cx="28" cy="38" r="2.4" fill="#3D1E0A" />
      <circle cx="42" cy="40" r="2.6" fill="#3D1E0A" />
      <circle cx="20" cy="40" r="1.8" fill="#3D1E0A" />
      {/* 高光 */}
      <Highlight glowId="ck" />
    </>
  );
}

// ─── great 池:汽水 / 巧克力 / 雪糕 ─────────────────

/** 汽水 — 玻璃瓶 + 气泡 */
function Soda() {
  return (
    <>
      <GradientDefs id="sd" c0="#D4F0FF" c40="#7CC8F2" c75="#3286C0" c100="#0F4A7A" />
      {/* 瓶身 */}
      <path
        d="M 24 14 L 24 18 Q 22 20 22 24 L 22 54 Q 22 58 26 58 L 38 58 Q 42 58 42 54 L 42 24 Q 42 20 40 18 L 40 14 Z"
        fill="url(#bg-body-sd)"
      />
      {/* 瓶盖 */}
      <rect x="24" y="10" width="16" height="6" rx="1.5" fill="#C0392B" />
      <rect x="24" y="10" width="16" height="2" fill="#FFFFFF" opacity="0.4" />
      {/* 标签 */}
      <rect x="24" y="34" width="16" height="10" fill="#FFD66B" />
      <text x="32" y="41.5" fontSize="6" textAnchor="middle" fill="#A14B0F" fontWeight="bold">SODA</text>
      {/* 气泡 */}
      <circle cx="28" cy="48" r="1.5" fill="#FFFFFF" opacity="0.7" />
      <circle cx="36" cy="50" r="1.2" fill="#FFFFFF" opacity="0.6" />
      <circle cx="32" cy="46" r="1" fill="#FFFFFF" opacity="0.7" />
      {/* 玻璃高光 */}
      <rect x="25" y="22" width="2.5" height="28" rx="1.2" fill="#FFFFFF" opacity="0.4" />
    </>
  );
}

/** 巧克力 — 4×4 格 */
function Chocolate() {
  return (
    <>
      <GradientDefs id="ch" c0="#A1693E" c40="#6B3E18" c75="#3D2008" c100="#1F1004" />
      {/* 巧克力块主体 */}
      <rect x="8" y="14" width="48" height="36" rx="3" fill="url(#bg-body-ch)" />
      {/* 网格凹痕 */}
      <line x1="20" y1="14" x2="20" y2="50" stroke="#1F1004" strokeWidth="1.2" />
      <line x1="32" y1="14" x2="32" y2="50" stroke="#1F1004" strokeWidth="1.2" />
      <line x1="44" y1="14" x2="44" y2="50" stroke="#1F1004" strokeWidth="1.2" />
      <line x1="8" y1="32" x2="56" y2="32" stroke="#1F1004" strokeWidth="1.2" />
      {/* 上端高光 */}
      <rect x="8" y="14" width="48" height="3" rx="3" fill="#FFFFFF" opacity="0.18" />
      <ellipse cx="20" cy="22" rx="6" ry="3" fill="#FFFFFF" opacity="0.18" />
    </>
  );
}

/** 雪糕 — 三角锥 + 圆球冰激凌 */
function Icecream() {
  return (
    <>
      <GradientDefs id="ic" c0="#FFF1F5" c40="#FFB7C9" c75="#E875A0" c100="#9D2D55" />
      {/* 蛋筒 */}
      <path d="M 18 32 L 32 60 L 46 32 Z" fill="#D69552" />
      <path d="M 22 36 L 26 38 M 28 40 L 32 42 M 34 44 L 38 46 M 40 48 L 44 36" stroke="#9C5F2A" strokeWidth="0.8" strokeLinecap="round" />
      {/* 冰激凌球 */}
      <circle cx="32" cy="26" r="14" fill="url(#bg-body-ic)" />
      {/* 雪糕顶部小尖 */}
      <circle cx="32" cy="14" r="3" fill="#FFB7C9" />
      {/* 顶部巧克力豆 */}
      <circle cx="28" cy="20" r="1.4" fill="#3D1E0A" />
      <circle cx="36" cy="22" r="1.2" fill="#3D1E0A" />
      <circle cx="32" cy="26" r="1.3" fill="#3D1E0A" />
      {/* 高光 */}
      <Highlight cx={26} cy={20} rx={6} ry={3.5} glowId="ic" />
    </>
  );
}

// ─── perfect 池:蛋糕 / 寿司 / 披萨 ─────────────────

/** 蛋糕 — 双层奶油 + 蜡烛火焰 + 顶部草莓 */
function Cake() {
  return (
    <>
      <GradientDefs id="cake" c0="#FFF1F5" c40="#FFC4D2" c75="#E48AA8" c100="#9D2D55" />
      {/* 蜡烛火焰 */}
      <path d="M 32 6 Q 28 10 32 14 Q 36 10 32 6 Z" fill="#FFB347" />
      <ellipse cx="32" cy="10" rx="1.4" ry="2" fill="#FFEC99" opacity="0.85" />
      {/* 蜡烛 */}
      <rect x="31" y="14" width="2" height="6" fill="#3D6EB0" />
      <rect x="31" y="14" width="0.8" height="6" fill="#FFFFFF" opacity="0.5" />
      {/* 上层蛋糕(小)— 奶油渐变 */}
      <rect x="22" y="20" width="20" height="10" rx="2" fill="url(#bg-body-cake)" />
      {/* 上层奶油挤花(波浪)*/}
      <path d="M 22 20 Q 24 17 26 20 T 30 20 T 34 20 T 38 20 T 42 20" fill="none" stroke="#FFFFFF" strokeWidth="1.4" opacity="0.6" />
      {/* 下层蛋糕(大)*/}
      <rect x="14" y="30" width="36" height="20" rx="2.5" fill="url(#bg-body-cake)" />
      {/* 下层奶油波浪 */}
      <path d="M 14 30 Q 16 27 18 30 T 22 30 T 26 30 T 30 30 T 34 30 T 38 30 T 42 30 T 46 30 T 50 30" fill="none" stroke="#FFFFFF" strokeWidth="1.4" opacity="0.6" />
      {/* 草莓装饰(中部条带)*/}
      <circle cx="20" cy="40" r="2.4" fill="#E63946" />
      <circle cx="32" cy="40" r="2.4" fill="#E63946" />
      <circle cx="44" cy="40" r="2.4" fill="#E63946" />
      {/* 高光 */}
      <ellipse cx="22" cy="34" rx="6" ry="3" fill="#FFFFFF" opacity="0.35" />
    </>
  );
}

/** 寿司 — 椭圆米饭 + 三文鱼鱼片 + 海苔条 */
function Sushi() {
  return (
    <>
      <GradientDefs id="sushi" c0="#FFFFFF" c40="#FAF6EE" c75="#D8CFB8" c100="#8E8169" />
      {/* 米饭基底(椭圆) */}
      <ellipse cx="32" cy="38" rx="22" ry="14" fill="url(#bg-body-sushi)" />
      {/* 米粒纹理(白点点)*/}
      <circle cx="22" cy="38" r="0.9" fill="#FFFFFF" opacity="0.85" />
      <circle cx="28" cy="34" r="0.8" fill="#FFFFFF" opacity="0.85" />
      <circle cx="36" cy="36" r="0.9" fill="#FFFFFF" opacity="0.85" />
      <circle cx="42" cy="34" r="0.8" fill="#FFFFFF" opacity="0.85" />
      <circle cx="32" cy="42" r="0.9" fill="#FFFFFF" opacity="0.85" />
      {/* 海苔条(底部黑色条带)*/}
      <rect x="10" y="44" width="44" height="6" rx="0.5" fill="#1A1A1A" />
      <rect x="10" y="44" width="44" height="1.5" fill="#FFFFFF" opacity="0.15" />
      {/* 三文鱼片(顶部橙色椭圆)*/}
      <ellipse cx="32" cy="22" rx="20" ry="9" fill="#F8895C" />
      {/* 三文鱼白色筋纹 */}
      <path d="M 14 22 Q 22 19 32 22 Q 42 25 50 22" fill="none" stroke="#FFFFFF" strokeWidth="1.6" opacity="0.7" strokeLinecap="round" />
      <path d="M 14 24 Q 22 22 32 24 Q 42 26 50 24" fill="none" stroke="#FFFFFF" strokeWidth="1" opacity="0.55" strokeLinecap="round" />
      {/* 高光 */}
      <ellipse cx="24" cy="20" rx="6" ry="2.5" fill="#FFFFFF" opacity="0.4" />
    </>
  );
}

/** 披萨 — 三角扇形切片 + 奶酪 + 红肠 */
function Pizza() {
  return (
    <>
      <GradientDefs id="pizza" c0="#FFE9B5" c40="#FFC066" c75="#D9842A" c100="#8B4D0F" />
      {/* 披萨三角形(尖端朝下)*/}
      <path d="M 32 58 L 8 18 Q 32 8 56 18 Z" fill="url(#bg-body-pizza)" />
      {/* 边缘面饼厚边(深一点)*/}
      <path d="M 8 18 Q 32 8 56 18 L 54 22 Q 32 13 10 22 Z" fill="#A66220" />
      {/* 奶酪滴(顶部黄色椭圆 / 不规则)*/}
      <ellipse cx="20" cy="28" rx="6" ry="3" fill="#FFD66B" opacity="0.85" />
      <ellipse cx="40" cy="26" rx="7" ry="3.5" fill="#FFD66B" opacity="0.85" />
      <ellipse cx="32" cy="40" rx="5" ry="2.5" fill="#FFD66B" opacity="0.85" />
      {/* 红肠片 */}
      <circle cx="22" cy="32" r="3.5" fill="#C0392B" />
      <circle cx="22" cy="32" r="1" fill="#7A1818" opacity="0.6" />
      <circle cx="40" cy="32" r="3.5" fill="#C0392B" />
      <circle cx="40" cy="32" r="1" fill="#7A1818" opacity="0.6" />
      <circle cx="30" cy="46" r="3" fill="#C0392B" />
      <circle cx="30" cy="46" r="0.8" fill="#7A1818" opacity="0.6" />
      {/* 绿色蔬菜小点 */}
      <circle cx="14" cy="22" r="1.2" fill="#5DB55A" />
      <circle cx="48" cy="24" r="1.4" fill="#5DB55A" />
      <circle cx="34" cy="34" r="1.2" fill="#5DB55A" />
      {/* 高光 */}
      <ellipse cx="22" cy="20" rx="6" ry="2.5" fill="#FFFFFF" opacity="0.35" />
    </>
  );
}

// ─── dataURL helper(给 matter.js sprite)─────────────

/**
 * SVG → data URL,与 JSX 渲染视觉一致。
 * 内部用与 JSX 同样的几何 + 颜色,但所有 def id 加 _du 后缀防冲突。
 *
 * 简化策略:为了避免重复维护 11 套字符串,这里先用 ReactDOMServer.renderToStaticMarkup 思路
 * 是更稳的做法,但避免引入 ReactDOMServer 的体积代价,改用预先序列化的 SVG 字符串集合。
 *
 * 维护 note:每次改 BadgeIcon 视觉,也要同步改下面的 SVG_STRINGS。
 */
const SVG_STRINGS: Record<BadgeIconShape, string> = {
  'orange-outline': `<circle cx="32" cy="36" r="22" fill="none" stroke="#C7BFA8" stroke-width="1.6"/><path d="M 30 14 Q 32 11 34 14 L 33 18 L 31 18 Z" fill="none" stroke="#C7BFA8" stroke-width="1.4" stroke-linejoin="round"/><path d="M 33 16 Q 45 11 49 18 Q 42 22 33 18 Z" fill="none" stroke="#C7BFA8" stroke-width="1.4" stroke-linejoin="round"/>`,
  'orange-gray': `<defs><radialGradient id="b" cx="38%" cy="32%" r="78%"><stop offset="0%" stop-color="#FBFAF7"/><stop offset="40%" stop-color="#E8E2D4"/><stop offset="75%" stop-color="#C3BBA8"/><stop offset="100%" stop-color="#9A927F"/></radialGradient><radialGradient id="g" cx="35%" cy="22%" r="55%"><stop offset="0%" stop-color="#fff" stop-opacity="0.95"/><stop offset="55%" stop-color="#fff" stop-opacity="0.25"/><stop offset="100%" stop-color="#fff" stop-opacity="0"/></radialGradient></defs><circle cx="32" cy="36" r="22" fill="url(#b)"/><ellipse cx="24" cy="24" rx="14" ry="10" fill="url(#g)"/><ellipse cx="20" cy="31" rx="2.4" ry="1.3" fill="#fff" opacity="0.6"/><circle cx="32" cy="40" r="1.4" fill="#9A927F" opacity="0.35"/><path d="M 30.5 15 Q 32 12 33.5 15 L 32.8 19 L 31.2 19 Z" fill="#7B746B"/><path d="M 33 16 Q 46 12 49 18 Q 42 22 33 18 Z" fill="#9DAA8B"/>`,
  candy: `<defs><radialGradient id="b" cx="38%" cy="32%" r="78%"><stop offset="0%" stop-color="#FFE4EC"/><stop offset="40%" stop-color="#FFA8C2"/><stop offset="75%" stop-color="#E66D8E"/><stop offset="100%" stop-color="#A8385A"/></radialGradient><radialGradient id="g" cx="35%" cy="22%" r="55%"><stop offset="0%" stop-color="#fff" stop-opacity="0.95"/><stop offset="55%" stop-color="#fff" stop-opacity="0.25"/><stop offset="100%" stop-color="#fff" stop-opacity="0"/></radialGradient></defs><path d="M 6 32 L 14 24 L 14 40 Z" fill="#FFA8C2"/><path d="M 58 32 L 50 24 L 50 40 Z" fill="#FFA8C2"/><ellipse cx="32" cy="32" rx="20" ry="13" fill="url(#b)"/><ellipse cx="25" cy="26" rx="8" ry="4.5" fill="url(#g)"/><path d="M 18 32 Q 24 26, 32 32 Q 40 38, 46 32" fill="none" stroke="#fff" stroke-width="1.4" opacity="0.55" stroke-linecap="round"/>`,
  lollipop: `<defs><radialGradient id="b" cx="38%" cy="32%" r="78%"><stop offset="0%" stop-color="#FFE0E8"/><stop offset="40%" stop-color="#FF8FB0"/><stop offset="75%" stop-color="#D9446F"/><stop offset="100%" stop-color="#8B1F3D"/></radialGradient><radialGradient id="g" cx="35%" cy="22%" r="55%"><stop offset="0%" stop-color="#fff" stop-opacity="0.95"/><stop offset="55%" stop-color="#fff" stop-opacity="0.25"/><stop offset="100%" stop-color="#fff" stop-opacity="0"/></radialGradient></defs><rect x="30.5" y="36" width="3" height="22" rx="1.3" fill="#C8A572"/><circle cx="32" cy="24" r="18" fill="url(#b)"/><path d="M 32 24 m -10 0 a 10 10 0 1 1 10 10 a 6 6 0 1 1 -6 -6 a 3 3 0 1 1 3 3" fill="none" stroke="#fff" stroke-width="1.6" opacity="0.7" stroke-linecap="round"/><ellipse cx="25" cy="18" rx="7" ry="4" fill="url(#g)"/>`,
  cookie: `<defs><radialGradient id="b" cx="38%" cy="32%" r="78%"><stop offset="0%" stop-color="#FFE9C4"/><stop offset="40%" stop-color="#E8B97A"/><stop offset="75%" stop-color="#B6803D"/><stop offset="100%" stop-color="#6E4818"/></radialGradient><radialGradient id="g" cx="35%" cy="22%" r="55%"><stop offset="0%" stop-color="#fff" stop-opacity="0.95"/><stop offset="55%" stop-color="#fff" stop-opacity="0.25"/><stop offset="100%" stop-color="#fff" stop-opacity="0"/></radialGradient></defs><circle cx="32" cy="32" r="24" fill="url(#b)"/><circle cx="22" cy="24" r="2.6" fill="#3D1E0A"/><circle cx="40" cy="22" r="2.2" fill="#3D1E0A"/><circle cx="28" cy="38" r="2.4" fill="#3D1E0A"/><circle cx="42" cy="40" r="2.6" fill="#3D1E0A"/><circle cx="20" cy="40" r="1.8" fill="#3D1E0A"/><ellipse cx="24" cy="24" rx="14" ry="10" fill="url(#g)"/>`,
  soda: `<defs><radialGradient id="b" cx="38%" cy="32%" r="78%"><stop offset="0%" stop-color="#D4F0FF"/><stop offset="40%" stop-color="#7CC8F2"/><stop offset="75%" stop-color="#3286C0"/><stop offset="100%" stop-color="#0F4A7A"/></radialGradient></defs><path d="M 24 14 L 24 18 Q 22 20 22 24 L 22 54 Q 22 58 26 58 L 38 58 Q 42 58 42 54 L 42 24 Q 42 20 40 18 L 40 14 Z" fill="url(#b)"/><rect x="24" y="10" width="16" height="6" rx="1.5" fill="#C0392B"/><rect x="24" y="34" width="16" height="10" fill="#FFD66B"/><circle cx="28" cy="48" r="1.5" fill="#fff" opacity="0.7"/><circle cx="36" cy="50" r="1.2" fill="#fff" opacity="0.6"/><rect x="25" y="22" width="2.5" height="28" rx="1.2" fill="#fff" opacity="0.4"/>`,
  chocolate: `<defs><radialGradient id="b" cx="38%" cy="32%" r="78%"><stop offset="0%" stop-color="#A1693E"/><stop offset="40%" stop-color="#6B3E18"/><stop offset="75%" stop-color="#3D2008"/><stop offset="100%" stop-color="#1F1004"/></radialGradient></defs><rect x="8" y="14" width="48" height="36" rx="3" fill="url(#b)"/><line x1="20" y1="14" x2="20" y2="50" stroke="#1F1004" stroke-width="1.2"/><line x1="32" y1="14" x2="32" y2="50" stroke="#1F1004" stroke-width="1.2"/><line x1="44" y1="14" x2="44" y2="50" stroke="#1F1004" stroke-width="1.2"/><line x1="8" y1="32" x2="56" y2="32" stroke="#1F1004" stroke-width="1.2"/><rect x="8" y="14" width="48" height="3" rx="3" fill="#fff" opacity="0.18"/><ellipse cx="20" cy="22" rx="6" ry="3" fill="#fff" opacity="0.18"/>`,
  icecream: `<defs><radialGradient id="b" cx="38%" cy="32%" r="78%"><stop offset="0%" stop-color="#FFF1F5"/><stop offset="40%" stop-color="#FFB7C9"/><stop offset="75%" stop-color="#E875A0"/><stop offset="100%" stop-color="#9D2D55"/></radialGradient><radialGradient id="g" cx="35%" cy="22%" r="55%"><stop offset="0%" stop-color="#fff" stop-opacity="0.95"/><stop offset="55%" stop-color="#fff" stop-opacity="0.25"/><stop offset="100%" stop-color="#fff" stop-opacity="0"/></radialGradient></defs><path d="M 18 32 L 32 60 L 46 32 Z" fill="#D69552"/><circle cx="32" cy="26" r="14" fill="url(#b)"/><circle cx="32" cy="14" r="3" fill="#FFB7C9"/><circle cx="28" cy="20" r="1.4" fill="#3D1E0A"/><circle cx="36" cy="22" r="1.2" fill="#3D1E0A"/><circle cx="32" cy="26" r="1.3" fill="#3D1E0A"/><ellipse cx="26" cy="20" rx="6" ry="3.5" fill="url(#g)"/>`,
  cake: `<defs><radialGradient id="b" cx="38%" cy="32%" r="78%"><stop offset="0%" stop-color="#FFF1F5"/><stop offset="40%" stop-color="#FFC4D2"/><stop offset="75%" stop-color="#E48AA8"/><stop offset="100%" stop-color="#9D2D55"/></radialGradient></defs><path d="M 32 6 Q 28 10 32 14 Q 36 10 32 6 Z" fill="#FFB347"/><ellipse cx="32" cy="10" rx="1.4" ry="2" fill="#FFEC99" opacity="0.85"/><rect x="31" y="14" width="2" height="6" fill="#3D6EB0"/><rect x="22" y="20" width="20" height="10" rx="2" fill="url(#b)"/><path d="M 22 20 Q 24 17 26 20 T 30 20 T 34 20 T 38 20 T 42 20" fill="none" stroke="#fff" stroke-width="1.4" opacity="0.6"/><rect x="14" y="30" width="36" height="20" rx="2.5" fill="url(#b)"/><path d="M 14 30 Q 16 27 18 30 T 22 30 T 26 30 T 30 30 T 34 30 T 38 30 T 42 30 T 46 30 T 50 30" fill="none" stroke="#fff" stroke-width="1.4" opacity="0.6"/><circle cx="20" cy="40" r="2.4" fill="#E63946"/><circle cx="32" cy="40" r="2.4" fill="#E63946"/><circle cx="44" cy="40" r="2.4" fill="#E63946"/><ellipse cx="22" cy="34" rx="6" ry="3" fill="#fff" opacity="0.35"/>`,
  sushi: `<defs><radialGradient id="b" cx="38%" cy="32%" r="78%"><stop offset="0%" stop-color="#FFFFFF"/><stop offset="40%" stop-color="#FAF6EE"/><stop offset="75%" stop-color="#D8CFB8"/><stop offset="100%" stop-color="#8E8169"/></radialGradient></defs><ellipse cx="32" cy="38" rx="22" ry="14" fill="url(#b)"/><circle cx="22" cy="38" r="0.9" fill="#fff" opacity="0.85"/><circle cx="28" cy="34" r="0.8" fill="#fff" opacity="0.85"/><circle cx="36" cy="36" r="0.9" fill="#fff" opacity="0.85"/><circle cx="42" cy="34" r="0.8" fill="#fff" opacity="0.85"/><rect x="10" y="44" width="44" height="6" rx="0.5" fill="#1A1A1A"/><ellipse cx="32" cy="22" rx="20" ry="9" fill="#F8895C"/><path d="M 14 22 Q 22 19 32 22 Q 42 25 50 22" fill="none" stroke="#fff" stroke-width="1.6" opacity="0.7" stroke-linecap="round"/><path d="M 14 24 Q 22 22 32 24 Q 42 26 50 24" fill="none" stroke="#fff" stroke-width="1" opacity="0.55" stroke-linecap="round"/><ellipse cx="24" cy="20" rx="6" ry="2.5" fill="#fff" opacity="0.4"/>`,
  pizza: `<defs><radialGradient id="b" cx="38%" cy="32%" r="78%"><stop offset="0%" stop-color="#FFE9B5"/><stop offset="40%" stop-color="#FFC066"/><stop offset="75%" stop-color="#D9842A"/><stop offset="100%" stop-color="#8B4D0F"/></radialGradient></defs><path d="M 32 58 L 8 18 Q 32 8 56 18 Z" fill="url(#b)"/><path d="M 8 18 Q 32 8 56 18 L 54 22 Q 32 13 10 22 Z" fill="#A66220"/><ellipse cx="20" cy="28" rx="6" ry="3" fill="#FFD66B" opacity="0.85"/><ellipse cx="40" cy="26" rx="7" ry="3.5" fill="#FFD66B" opacity="0.85"/><ellipse cx="32" cy="40" rx="5" ry="2.5" fill="#FFD66B" opacity="0.85"/><circle cx="22" cy="32" r="3.5" fill="#C0392B"/><circle cx="40" cy="32" r="3.5" fill="#C0392B"/><circle cx="30" cy="46" r="3" fill="#C0392B"/><circle cx="14" cy="22" r="1.2" fill="#5DB55A"/><circle cx="48" cy="24" r="1.4" fill="#5DB55A"/><circle cx="34" cy="34" r="1.2" fill="#5DB55A"/><ellipse cx="22" cy="20" rx="6" ry="2.5" fill="#fff" opacity="0.35"/>`
};

export function badgeIconDataUrl(shape: BadgeIconShape): string {
  const inner = SVG_STRINGS[shape];
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="64" height="64">${inner}</svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}
