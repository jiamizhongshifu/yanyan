/**
 * 主屏"身体"分组卡片(Grow App 风格 2 列网格)
 *
 * 4 Part 拆分:饮食(food) / 体感(symptom) / 环境(env) / 活动(activity)
 * 每张卡片显示 part 名 + 当前 part 分(0-100)+ 状态文案。
 * 缺数据 → 显示"待补充" + CTA 引导(去拍照 / 去打卡)。
 */

import { Link } from 'wouter';
import type { YanScoreToday } from '../services/symptoms';
import { BodyPartIcon, type BodyPartVariant } from './BodyPartIcon';

interface Props {
  yanScore: YanScoreToday | null;
}

interface PartConfig {
  key: keyof YanScoreToday['partScores'];
  title: string;
  emptyHint: string;
  ctaLabel: string;
  ctaHref: string;
  variant: BodyPartVariant;
}

const PARTS: PartConfig[] = [
  { key: 'food', title: '饮食', emptyHint: '今日还没拍餐', ctaLabel: '拍一张', ctaHref: '/camera', variant: 'food' },
  { key: 'symptom', title: '体感', emptyHint: '今日还没打卡', ctaLabel: '去打卡', ctaHref: '/check-in/step1', variant: 'symptom' },
  { key: 'env', title: '环境', emptyHint: '环境数据待接入', ctaLabel: '', ctaHref: '', variant: 'env' },
  { key: 'activity', title: '活动', emptyHint: '步数 / 心率待接入', ctaLabel: '', ctaHref: '', variant: 'activity' }
];

function partColor(score: number | null): string {
  if (score === null) return 'text-ink/30';
  if (score < 25) return 'text-fire-ping';
  if (score < 50) return 'text-fire-mild';
  if (score < 75) return 'text-fire-mid';
  return 'text-fire-high';
}

function partLabel(score: number | null): string {
  if (score === null) return '—';
  if (score < 25) return '平';
  if (score < 50) return '偏轻';
  if (score < 75) return '偏中';
  return '偏重';
}

export function HomeBodyCards({ yanScore }: Props) {
  return (
    <section data-testid="home-body-cards">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-base font-medium text-ink">身体</h2>
      </div>
      <div className="grid grid-cols-2 gap-3">
        {PARTS.map((p) => {
          const score = yanScore?.partScores?.[p.key] ?? null;
          return (
            <div key={p.key} className="rounded-2xl bg-white px-5 py-4 min-h-[160px] flex flex-col relative overflow-hidden">
              <BodyPartIcon
                variant={p.variant}
                className="absolute right-3 top-3 w-7 h-7 text-ink/30 pointer-events-none"
              />
              <p className="text-xs text-ink/50 relative z-10">{p.title}</p>
              {score !== null ? (
                <>
                  <p className={`mt-2 text-3xl font-medium ${partColor(score)} relative z-10`}>{Math.round(score)}</p>
                  <p className="mt-auto text-xs text-ink/50">{partLabel(score)}</p>
                </>
              ) : (
                <>
                  <p className="mt-2 text-2xl font-light text-ink/30 relative z-10">—</p>
                  <p className="mt-1 text-xs text-ink/50 leading-relaxed relative z-10">{p.emptyHint}</p>
                  {p.ctaHref && (
                    <Link
                      href={p.ctaHref}
                      className="mt-auto text-xs text-ink underline self-start relative z-10"
                    >
                      {p.ctaLabel}
                    </Link>
                  )}
                </>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
