/**
 * 玻璃瓶勋章罐 — Grow App 风格
 *
 * v1:展示 perfect/great/nice 三类天数计数,以及"糖分减少累计"占位区。
 *      糖分勋章(棒棒糖 / 可乐 / 奶茶 等)在下个 commit 接 LLM 真实糖分识别后注入。
 *
 * 视觉:渐变玻璃瓶 + 内部漂浮 emoji 表示当月累积的勋章。
 */

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

      <div className="relative mx-auto w-56 h-72">
        {/* 瓶盖 */}
        <div className="absolute top-0 inset-x-4 h-7 rounded-t-md bg-gradient-to-b from-amber-300 to-amber-500" />
        {/* 瓶身 */}
        <div className="absolute top-7 inset-x-0 bottom-0 rounded-b-3xl rounded-t-xl bg-white/80 border border-ink/10 shadow-inner overflow-hidden">
          {/* 瓶口反光 */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-32 h-1 bg-ink/5" />
          {/* 内容 */}
          {badges.length === 0 ? (
            <p className="absolute inset-0 flex items-center justify-center text-center px-4 text-xs text-ink/40 leading-relaxed">
              本月还没收集到勋章哦,
              <br />
              完成今日挑战开始集勋章 :)
            </p>
          ) : (
            <div className="absolute inset-3 flex flex-wrap content-end justify-center gap-1.5 pb-2">
              {badges.slice(0, 60).map((b) => (
                <span key={b.key} className="text-xl">{b.emoji}</span>
              ))}
              {badges.length > 60 && (
                <span className="text-xs text-ink/40 self-end">+{badges.length - 60}</span>
              )}
            </div>
          )}
        </div>
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
