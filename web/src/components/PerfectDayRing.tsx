/**
 * 完美一天进度环
 *
 * 半圆刻度仪表盘(参考 grow app):
 *   - 240° 弧形(下方开口),底色刻度环 + 比例填充弧
 *   - 圆周散布 60 个 tick(每 4° 一刻),fill 比例下加深、未填浅灰
 *   - 中心:tier 橘子(头像位)+ 大号百分比 + Perfect Day 副标
 *   - 两侧浮起 ⓘ / ↑ 小图标(占位,先非交互)
 *
 * 环外:一行鼓励语,根据已完成项数动态写文案
 */

import type { DayTier } from '../services/challenges';
import { BadgeIcon, type BadgeIconShape } from './BadgeIcon';
import { pickShape } from '../services/badgePicker';

interface Props {
  doneCount: number; // 0-5
  total?: number;    // 默认 5
  tier: DayTier;
}

const TIER_COLOR: Record<DayTier, string> = {
  perfect: '#D9762C',
  great: '#E8954E',
  nice: '#F0B679',
  none: '#A8A296'
};

// 弧形参数:开口在下方,从左下绕过顶部到右下
const SWEEP = 240;
const START_ANGLE = 270 - SWEEP / 2; // = 150
const END_ANGLE = 270 + SWEEP / 2; // = 390 (相对 cx,cy 的极角,12 点 = 270°)

const VIEW = 220;
const CX = VIEW / 2;
const CY = VIEW / 2 + 6; // 略下移让顶部空出一点
const RADIUS = 86;
const TRACK_W = 10;

const TICK_COUNT = 60;
const TICK_INNER = RADIUS - TRACK_W / 2 - 4;
const TICK_OUTER = RADIUS - TRACK_W / 2 - 1;

function polar(deg: number, r: number = RADIUS): [number, number] {
  // SVG 极角:0° = 右(3 点),90° = 下(6 点),180° = 左(9 点),270° = 上(12 点)
  const rad = (deg * Math.PI) / 180;
  return [CX + r * Math.cos(rad), CY + r * Math.sin(rad)];
}

export function PerfectDayRing({ doneCount, total = 5, tier }: Props) {
  const ratio = Math.max(0, Math.min(1, doneCount / total));
  const pct = Math.round(ratio * 100);
  const tierColor = TIER_COLOR[tier];

  // 背景轨迹弧(浅灰)
  const [bgX1, bgY1] = polar(START_ANGLE);
  const [bgX2, bgY2] = polar(END_ANGLE);
  const bgArc = `M ${bgX1.toFixed(2)} ${bgY1.toFixed(2)} A ${RADIUS} ${RADIUS} 0 1 1 ${bgX2.toFixed(2)} ${bgY2.toFixed(2)}`;

  // 填充弧
  const fillEndAngle = START_ANGLE + SWEEP * ratio;
  const [fX2, fY2] = polar(fillEndAngle);
  const fillLargeArc = SWEEP * ratio > 180 ? 1 : 0;
  const fillArc = `M ${bgX1.toFixed(2)} ${bgY1.toFixed(2)} A ${RADIUS} ${RADIUS} 0 ${fillLargeArc} 1 ${fX2.toFixed(2)} ${fY2.toFixed(2)}`;

  // 刻度线 — 沿 SWEEP 均匀分布
  const ticks = Array.from({ length: TICK_COUNT + 1 }, (_, i) => {
    const angle = START_ANGLE + (SWEEP * i) / TICK_COUNT;
    const passed = i / TICK_COUNT <= ratio;
    const [x1, y1] = polar(angle, TICK_INNER);
    const [x2, y2] = polar(angle, TICK_OUTER);
    return { x1, y1, x2, y2, passed };
  });

  return (
    <div className="w-full flex flex-col items-center" data-testid="perfect-day-ring">
      <div className="relative w-56">
        <svg viewBox={`0 0 ${VIEW} ${VIEW}`} className="w-full h-auto">
          <defs>
            <linearGradient id="pday-grad" x1="0%" y1="100%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#FFE588" />
              <stop offset="50%" stopColor="#FFB565" />
              <stop offset="100%" stopColor="#F0964B" />
            </linearGradient>
          </defs>

          {/* 底色弧(浅灰) */}
          <path
            d={bgArc}
            fill="none"
            stroke="#F0E8DA"
            strokeWidth={TRACK_W}
            strokeLinecap="round"
          />

          {/* 比例填充弧 */}
          {ratio > 0 && (
            <path
              d={fillArc}
              fill="none"
              stroke="url(#pday-grad)"
              strokeWidth={TRACK_W}
              strokeLinecap="round"
            />
          )}

          {/* 刻度线(在轨迹内圈) */}
          {ticks.map((t, i) => (
            <line
              key={i}
              x1={t.x1.toFixed(2)}
              y1={t.y1.toFixed(2)}
              x2={t.x2.toFixed(2)}
              y2={t.y2.toFixed(2)}
              stroke={t.passed ? tierColor : '#D9D2C2'}
              strokeWidth="1.5"
              strokeLinecap="round"
              opacity={t.passed ? 0.85 : 0.55}
            />
          ))}
        </svg>

        {/* 中心:tier 形状池橘子 + 大号百分比 + Perfect Day 副标 */}
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <BadgeIcon
            shape={
              ((): BadgeIconShape => {
                if (tier === 'none') return 'orange-gray';
                // 用今日日期作为 seed,跨天会换形状
                const today = new Date();
                const dateISO = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
                return pickShape(dateISO, tier);
              })()
            }
            className="w-9 h-9 mb-1"
          />
          <p
            className="text-5xl font-bold leading-none tracking-tight"
            style={{ color: tierColor }}
            data-testid="pday-pct"
          >
            {pct}
            <span className="text-2xl font-bold ml-0.5">%</span>
          </p>
          <p className="mt-1.5 text-[11px] text-ink/50 tracking-wide">Perfect Day</p>
        </div>
      </div>

      {/* 环外鼓励语 */}
      <p className="mt-4 text-xs text-ink/50 leading-relaxed text-center px-6">
        {encouragement(doneCount, total, tier)}
      </p>
    </div>
  );
}

function encouragement(done: number, _total: number, tier: DayTier): string {
  if (done === 0) return '今天还没开始,先拍一餐试试看 ✨';
  if (tier === 'perfect') return '今天完美一天达成 🎉,身体会记住这种节奏。';
  if (tier === 'great') {
    const more = 4 - done;
    return more <= 0 ? '继续保持,身体在向好状态走。' : `再完成 ${more} 项就到完美一天 💪`;
  }
  if (tier === 'nice') {
    const more = 3 - done;
    return more <= 0 ? '已经迈过半程,再来一项就更好。' : `再完成 ${more} 项就到美好一天 🌿`;
  }
  return '继续保持现在的节奏,身体会喜欢。';
}
