/**
 * 玻璃瓶勋章罐 — Grow App 风格
 *
 * 视觉:gpt-image-2 ponchi-e 插画作背景瓶身,前景叠加当月真实勋章 emoji。
 * 当用户没有勋章时,空瓶插画自然展示;有勋章时叠加 emoji 网格。
 */

import { asset } from '../services/assets';

interface BadgeItem {
  emoji: string;
  label: string;
  count: number;
}

interface Props {
  monthLabel: string;
  perfect: number;
  great: number;
  nice: number;
  /** 糖分等价勋章 — 来自下版 sugar tracker;现阶段空数组 */
  sugarBadges?: BadgeItem[];
}

export function AchievementJar({ monthLabel, perfect, great, nice, sugarBadges = [] }: Props) {
  const total = perfect + great + nice + sugarBadges.reduce((s, b) => s + b.count, 0);

  // 瓶内漂浮的勋章列表(一行最多 6 个,溢出折行)
  const badges: Array<{ emoji: string; key: string }> = [];
  for (let i = 0; i < perfect; i++) badges.push({ emoji: '☀️', key: `p${i}` });
  for (let i = 0; i < great; i++) badges.push({ emoji: '🌤', key: `g${i}` });
  for (let i = 0; i < nice; i++) badges.push({ emoji: '🌥', key: `n${i}` });
  sugarBadges.forEach((b, bi) => {
    for (let i = 0; i < b.count; i++) badges.push({ emoji: b.emoji, key: `s${bi}-${i}` });
  });

  return (
    <section data-testid="achievement-jar">
      <div className="flex items-baseline justify-between mb-3">
        <h2 className="text-base font-medium text-ink">{monthLabel} · 勋章瓶</h2>
        <p className="text-xs text-ink/40">本月 {total} 枚</p>
      </div>

      <div className="relative mx-auto w-64 aspect-square">
        {/* 玻璃瓶 ponchi-e 插画背景 */}
        <img
          src={asset('achievement-jar.png')}
          alt="勋章玻璃瓶"
          className="absolute inset-0 w-full h-full object-contain"
        />
        {/* 真实勋章叠加(底部 1/2 区域,贴着瓶身底部漂) */}
        {badges.length > 0 && (
          <div className="absolute inset-x-6 bottom-6 top-1/2 flex flex-wrap content-end justify-center gap-1 pb-1">
            {badges.slice(0, 30).map((b) => (
              <span key={b.key} className="text-base drop-shadow-sm">{b.emoji}</span>
            ))}
            {badges.length > 30 && (
              <span className="text-[10px] text-ink/55 self-end">+{badges.length - 30}</span>
            )}
          </div>
        )}
        {badges.length === 0 && (
          <p className="absolute inset-x-0 bottom-3 text-center text-[11px] text-ink/45 leading-relaxed">
            完成今日挑战开始集勋章
          </p>
        )}
      </div>

      {/* 三类一天计数 */}
      <div className="mt-5 grid grid-cols-3 gap-2 text-center">
        <div className="rounded-2xl bg-white py-3">
          <p className="text-2xl">☀️</p>
          <p className="mt-1 text-xs text-ink/60">完美一天</p>
          <p className="mt-0.5 text-sm font-medium text-ink">×{perfect}</p>
        </div>
        <div className="rounded-2xl bg-white py-3">
          <p className="text-2xl">🌤</p>
          <p className="mt-1 text-xs text-ink/60">美好一天</p>
          <p className="mt-0.5 text-sm font-medium text-ink">×{great}</p>
        </div>
        <div className="rounded-2xl bg-white py-3">
          <p className="text-2xl">🌥</p>
          <p className="mt-1 text-xs text-ink/60">奈斯一天</p>
          <p className="mt-0.5 text-sm font-medium text-ink">×{nice}</p>
        </div>
      </div>

      {sugarBadges.length > 0 && (
        <div className="mt-4 rounded-2xl bg-white px-5 py-4">
          <p className="text-xs text-ink/50 mb-2">控糖勋章</p>
          <div className="flex flex-wrap gap-3">
            {sugarBadges.map((b, i) => (
              <div key={i} className="flex items-center gap-1.5">
                <span className="text-lg">{b.emoji}</span>
                <span className="text-sm text-ink">{b.label}</span>
                <span className="text-sm text-ink/50">×{b.count}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
