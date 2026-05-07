/**
 * 玻璃瓶勋章罐 — Grow App 风格
 *
 * 视觉:gpt-image-2 ponchi-e 玻璃瓶背景 + 内部叠加真实勋章(level icon / 糖分 sticker)
 * 完美 / 美好 / 奈斯 三类天用 4 个 level icon(平/微/中/大);
 * 糖分等价勋章用 sticker(棒棒糖 / 可乐 / 奶茶 / 巧克力)
 */

import { asset } from '../services/assets';

interface BadgeItem {
  emoji: string;
  label: string;
  count: number;
  /** ponchi-e sticker 文件名(如 'badge-lollipop.png');未传则 fallback emoji */
  iconFile?: string;
}

interface Props {
  monthLabel: string;
  perfect: number;
  great: number;
  nice: number;
  sugarBadges?: BadgeItem[];
}

const TIER_ICON_FILE = {
  perfect: 'level-ping.png',
  great: 'level-weihuo.png',
  nice: 'level-zhonghuo.png'
} as const;

export function AchievementJar({ monthLabel, perfect, great, nice, sugarBadges = [] }: Props) {
  const total = perfect + great + nice + sugarBadges.reduce((s, b) => s + b.count, 0);

  // 瓶内勋章列表(各种类型混合)
  const badges: Array<{ src: string; alt: string; key: string }> = [];
  for (let i = 0; i < perfect; i++) badges.push({ src: asset(TIER_ICON_FILE.perfect), alt: '完美', key: `p${i}` });
  for (let i = 0; i < great; i++) badges.push({ src: asset(TIER_ICON_FILE.great), alt: '美好', key: `g${i}` });
  for (let i = 0; i < nice; i++) badges.push({ src: asset(TIER_ICON_FILE.nice), alt: '奈斯', key: `n${i}` });
  sugarBadges.forEach((b, bi) => {
    for (let i = 0; i < b.count; i++) {
      const src = b.iconFile ? asset(b.iconFile) : '';
      badges.push({ src, alt: b.label, key: `s${bi}-${i}` });
    }
  });

  return (
    <section data-testid="achievement-jar">
      <div className="flex items-baseline justify-between mb-3">
        <h2 className="text-base font-medium text-ink">{monthLabel} · 勋章瓶</h2>
        <p className="text-xs text-ink/30">本月 {total} 枚</p>
      </div>

      <div className="relative mx-auto w-64 aspect-square">
        <img
          src={asset('achievement-jar.png')}
          alt="勋章玻璃瓶"
          className="absolute inset-0 w-full h-full object-contain"
        />
        {badges.length > 0 && (
          <div className="absolute inset-x-7 bottom-8 top-[55%] flex flex-wrap content-end justify-center gap-1 pb-1">
            {badges.slice(0, 24).map((b) =>
              b.src ? (
                <img
                  key={b.key}
                  src={b.src}
                  alt={b.alt}
                  className="w-5 h-5 object-contain drop-shadow-sm"
                  loading="lazy"
                />
              ) : (
                <span key={b.key} className="text-base">·</span>
              )
            )}
            {badges.length > 24 && (
              <span className="text-[10px] text-ink/50 self-end">+{badges.length - 24}</span>
            )}
          </div>
        )}
        {badges.length === 0 && (
          <p className="absolute inset-x-0 bottom-3 text-center text-[11px] text-ink/50 leading-relaxed">
            完成今日挑战开始集勋章
          </p>
        )}
      </div>

      {/* 三类一天计数 — level icon 替代 emoji */}
      <div className="mt-5 grid grid-cols-3 gap-2 text-center">
        <TierTile iconFile={TIER_ICON_FILE.perfect} label="完美一天" count={perfect} />
        <TierTile iconFile={TIER_ICON_FILE.great} label="美好一天" count={great} />
        <TierTile iconFile={TIER_ICON_FILE.nice} label="奈斯一天" count={nice} />
      </div>

      {sugarBadges.length > 0 && (
        <div className="mt-4 rounded-2xl bg-white px-5 py-4">
          <p className="text-xs text-ink/50 mb-2">控糖勋章</p>
          <div className="grid grid-cols-2 gap-3">
            {sugarBadges.map((b, i) => (
              <div key={i} className="flex items-center gap-2.5">
                {b.iconFile ? (
                  <img src={asset(b.iconFile)} alt={b.label} className="w-9 h-9 object-contain" />
                ) : (
                  <span className="text-2xl">{b.emoji}</span>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-ink leading-tight">{b.label}</p>
                  <p className="text-xs text-fire-ping font-medium">×{b.count}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

function TierTile({ iconFile, label, count }: { iconFile: string; label: string; count: number }) {
  return (
    <div className={`rounded-2xl bg-white py-3 ${count === 0 ? 'opacity-60' : ''}`}>
      <img src={asset(iconFile)} alt={label} className="w-8 h-8 mx-auto object-contain" />
      <p className="mt-1 text-xs text-ink/50">{label}</p>
      <p className="mt-0.5 text-sm font-medium text-ink">×{count}</p>
    </div>
  );
}
