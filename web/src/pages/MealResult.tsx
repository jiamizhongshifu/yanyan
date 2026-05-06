/**
 * 餐食结果页 — 抗炎指数 + AI 蜡笔插画 + 食物条目 + 反馈
 *
 * Hero 区结构(从上到下):
 *   1. AI 生成的蜡笔插画(异步加载;loading 时显示骨架屏 + mascot)
 *   2. "这一餐"
 *   3. 大号 抗炎指数 数字(0-100)
 *   4. 副位:5 颗星 + 等级标签(平/轻盈/微暖/留心)
 *   5. mascot + 陪伴语
 */

import { useEffect, useState } from 'react';
import { useLocation } from 'wouter';
import { FoodItemCard } from '../components/FoodItemCard';
import { Stars } from '../components/InflammationDial';
import {
  fetchMealIllustration,
  postMealFeedback,
  type FireLevel
} from '../services/meals';
import { useLastMeal } from '../store/lastMeal';
import { asset } from '../services/assets';
import {
  LEVEL_TO_ENCOURAGEMENT,
  LEVEL_TO_LABEL,
  LEVEL_TO_STARS,
  SCORE_LABEL,
  scoreToAntiInflam
} from '../services/score-display';

const LEVEL_COLOR: Record<FireLevel, string> = {
  平: 'text-fire-ping',
  微火: 'text-fire-ping',
  中火: 'text-fire-mild',
  大火: 'text-fire-mid'
};

export function MealResult() {
  const [, navigate] = useLocation();
  const result = useLastMeal((s) => s.result);
  const [illustrationUrl, setIllustrationUrl] = useState<string | null>(null);
  const [illustrationLoading, setIllustrationLoading] = useState(false);

  useEffect(() => {
    if (!result) {
      navigate('/camera');
    }
  }, [result, navigate]);

  // 进入页面就请求插画(server 端命中缓存秒返回,miss 时触发生成 ~10-30s)
  useEffect(() => {
    if (!result) return;
    let cancelled = false;
    setIllustrationLoading(true);
    const foodNames = result.items.map((it) => it.name);
    void fetchMealIllustration(result.mealId, foodNames).then((url) => {
      if (cancelled) return;
      setIllustrationUrl(url);
      setIllustrationLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [result]);

  if (!result) return null;

  const antiInflam = scoreToAntiInflam(result.fireScore);

  const handleFlag = async (itemName: string, kind: 'misrecognized' | 'no_reaction') => {
    await postMealFeedback(result.mealId, itemName, kind);
  };

  return (
    <main className="min-h-screen bg-paper px-7 pt-12 pb-10 max-w-md mx-auto">
      {/* AI 蜡笔插画 hero — 加载中骨架,加载完成后渐显 */}
      <div className="flex justify-center mb-5">
        {illustrationUrl ? (
          <img
            src={illustrationUrl}
            alt="这一餐的蜡笔插画"
            className="w-56 h-56 object-contain rounded-3xl animate-fadein"
            loading="eager"
          />
        ) : (
          <div className="w-56 h-56 rounded-3xl bg-white/60 flex items-center justify-center relative overflow-hidden">
            <img
              src={asset('mascot-happy.png')}
              alt=""
              className="w-24 h-24 object-contain opacity-90"
              loading="eager"
            />
            {illustrationLoading && (
              <div className="absolute inset-x-0 bottom-3 text-center">
                <p className="text-[11px] text-ink/45">水豚正在画这一餐…</p>
              </div>
            )}
          </div>
        )}
      </div>

      <header className="mb-8 text-center">
        <p className="text-sm text-ink/60">这一餐</p>
        <p
          className={`mt-2 text-7xl font-light leading-none ${LEVEL_COLOR[result.level]}`}
          data-testid="fire-score"
        >
          {antiInflam}
        </p>
        <p className="mt-2 flex items-center justify-center gap-2 text-sm text-ink/55">
          <span>{SCORE_LABEL}</span>
          <Stars filled={LEVEL_TO_STARS[result.level]} className="text-base" testId="fire-stars" />
          <span
            className={`font-medium ${LEVEL_COLOR[result.level]}`}
            data-testid="fire-level"
          >
            {LEVEL_TO_LABEL[result.level]}
          </span>
        </p>

        <div className="mt-5 flex items-center justify-center gap-3 px-2">
          <img
            src={asset('mascot-happy.png')}
            alt=""
            className="w-16 h-16 object-contain flex-shrink-0"
            loading="lazy"
          />
          <p className="text-sm text-ink/70 leading-relaxed text-left">
            {LEVEL_TO_ENCOURAGEMENT[result.level]}
          </p>
        </div>
      </header>

      <section>
        <h2 className="text-sm font-medium text-ink/70 mb-3">食物条目 · {result.items.length} 项</h2>
        {result.items.map((item) => (
          <FoodItemCard
            key={item.name}
            item={item}
            onFlagMisrecognized={(name) => void handleFlag(name, 'misrecognized')}
            onFlagNoReaction={(name) => void handleFlag(name, 'no_reaction')}
          />
        ))}
      </section>

      {result.unrecognizedNames.length > 0 && (
        <section className="mt-6 rounded-xl bg-ink/5 px-4 py-3">
          <h3 className="text-xs text-ink/60 mb-1">未收录食物(已加入回填队列)</h3>
          <p className="text-sm text-ink/70">{result.unrecognizedNames.join('、')}</p>
        </section>
      )}

      <footer className="mt-10 flex gap-3">
        <button
          type="button"
          onClick={() => navigate('/camera')}
          className="flex-1 rounded-full border-2 border-ink/15 text-ink py-3 text-sm"
        >
          再拍一张
        </button>
        <button
          type="button"
          onClick={() => navigate('/')}
          className="flex-1 rounded-full bg-ink text-white py-3 text-sm font-medium"
        >
          回主页
        </button>
      </footer>
    </main>
  );
}
