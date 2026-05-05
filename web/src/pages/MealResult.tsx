/**
 * 餐食结果页 — 红/黄/绿火分 + 食物条目 + 误识别 / 反例 反馈
 *
 * R8: 无 AI 人格化主播 — 用典籍引用 + 数据简语
 * R7: 食物条目附引用
 * R9: 用户可标记误识别(per item)
 */

import { useEffect } from 'react';
import { useLocation } from 'wouter';
import { FoodItemCard } from '../components/FoodItemCard';
import { Stars } from '../components/InflammationDial';
import { postMealFeedback, type FireLevel } from '../services/meals';
import { useLastMeal } from '../store/lastMeal';
import { asset } from '../services/assets';
import {
  LEVEL_TO_ENCOURAGEMENT,
  LEVEL_TO_LABEL,
  LEVEL_TO_STARS,
  SCORE_LABEL
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

  useEffect(() => {
    if (!result) {
      // 没结果直接跳回拍照页(刷新页面 / 直链场景)
      navigate('/camera');
    }
  }, [result, navigate]);

  if (!result) return null;

  const handleFlag = async (itemName: string, kind: 'misrecognized' | 'no_reaction') => {
    await postMealFeedback(result.mealId, itemName, kind);
  };

  return (
    <main className="min-h-screen bg-paper px-7 pt-12 pb-10 max-w-md mx-auto">
      {/* 餐盘分析 hero */}
      <div className="flex justify-center mb-4">
        <img
          src={asset('meal-analysis.png')}
          alt=""
          className="w-40 h-40 object-contain"
          loading="lazy"
        />
      </div>
      <header className="mb-8 text-center">
        <p className="text-sm text-ink/60">这一餐</p>
        <div className="mt-3 flex justify-center" data-testid="fire-stars">
          <Stars filled={LEVEL_TO_STARS[result.level]} className="text-5xl" />
        </div>
        <p
          className={`mt-2 text-2xl font-medium ${LEVEL_COLOR[result.level]}`}
          data-testid="fire-level"
        >
          {LEVEL_TO_LABEL[result.level]}
        </p>
        <p className="mt-0.5 text-xs text-ink/40">
          {SCORE_LABEL} ★<span data-testid="fire-score">{LEVEL_TO_STARS[result.level]}</span> / 5
        </p>
        {/* 全部用 happy mascot — 不再用 worried 给用户造成焦虑 */}
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
