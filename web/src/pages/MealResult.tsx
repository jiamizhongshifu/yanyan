/**
 * 餐食结果页 — 识别卡(食物名 + 抗炎指数)+ 食物分析与评价
 *
 * Hero 区:
 *   - SVG 装饰底纹(草本叶子 + 圆点)
 *   - 食物名大标题(单餐 1 项时显示具体名;2+ 时 顿号连接)
 *   - 5 颗星 + 等级标签
 *   - 抗炎指数 0-100 大数字
 *   - mascot + 陪伴语
 *
 * 下方:每条食物的 FoodItemCard(成分分析 + 评价)
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
  scoreToAntiInflam
} from '../services/score-display';

const LEVEL_COLOR: Record<FireLevel, string> = {
  平: 'text-fire-ping',
  微火: 'text-fire-ping',
  中火: 'text-fire-mild',
  大火: 'text-fire-mid'
};

const LEVEL_DECOR_COLOR: Record<FireLevel, string> = {
  平: 'text-fire-ping/15',
  微火: 'text-fire-ping/15',
  中火: 'text-fire-mild/15',
  大火: 'text-fire-mid/15'
};

export function MealResult() {
  const [, navigate] = useLocation();
  const result = useLastMeal((s) => s.result);

  useEffect(() => {
    if (!result) {
      navigate('/camera');
    }
  }, [result, navigate]);

  if (!result) return null;

  const antiInflam = scoreToAntiInflam(result.fireScore);
  const titleText =
    result.items.length === 0
      ? '这一餐'
      : result.items.length === 1
      ? result.items[0].name
      : result.items.map((i) => i.name).join('、');

  const handleFlag = async (itemName: string, kind: 'misrecognized' | 'no_reaction') => {
    await postMealFeedback(result.mealId, itemName, kind);
  };

  return (
    <main className="min-h-screen bg-paper px-6 pt-10 pb-10 max-w-md mx-auto">
      {/* 识别结果 Hero 卡 */}
      <section
        className="relative rounded-3xl bg-white px-6 pt-9 pb-7 mb-4 overflow-hidden"
        data-testid="meal-hero"
      >
        <TitleDecor className={`absolute inset-0 w-full h-full pointer-events-none ${LEVEL_DECOR_COLOR[result.level]}`} />
        <div className="relative">
          <p className="text-[11px] text-ink/45 text-center tracking-[0.25em]">这 一 餐</p>
          <h1
            className="mt-4 text-2xl font-medium text-center text-ink leading-snug px-2 break-words"
            data-testid="meal-title"
          >
            {titleText}
          </h1>
          <div className="mt-4 flex items-center justify-center gap-2 text-sm">
            <Stars filled={LEVEL_TO_STARS[result.level]} className="text-base" testId="fire-stars" />
            <span
              className={`font-medium ${LEVEL_COLOR[result.level]}`}
              data-testid="fire-level"
            >
              {LEVEL_TO_LABEL[result.level]}
            </span>
          </div>
          <p className="mt-3 text-center leading-none">
            <span className="text-[11px] text-ink/45 mr-1.5">抗炎指数</span>
            <span
              className={`text-5xl font-light ${LEVEL_COLOR[result.level]}`}
              data-testid="fire-score"
            >
              {antiInflam}
            </span>
            <span className="text-xs text-ink/40 ml-1">/ 100</span>
          </p>
        </div>
      </section>

      {/* mascot + 陪伴语 */}
      <section className="mb-5 px-2 flex items-center gap-3">
        <img
          src={asset('mascot-happy.png')}
          alt=""
          className="w-14 h-14 object-contain flex-shrink-0"
          loading="lazy"
        />
        <p className="text-sm text-ink/70 leading-relaxed">
          {LEVEL_TO_ENCOURAGEMENT[result.level]}
        </p>
      </section>

      {/* 食物分析与评价 */}
      <section>
        <h2 className="text-sm font-medium text-ink/70 mb-3">
          食物分析 · {result.items.length} 项
        </h2>
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
        <section className="mt-4 rounded-xl bg-ink/5 px-4 py-3">
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

/**
 * 标题装饰底纹 — 4 片叶子 + 5 个圆点 + 2 圈空心圆,
 * 全 currentColor,父层用 text-fire-xxx/15 控制透明度。
 */
function TitleDecor({ className = '' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 400 240"
      preserveAspectRatio="xMidYMid slice"
      className={className}
      aria-hidden="true"
    >
      {/* 左上叶子 */}
      <path
        d="M30 38 Q40 20 60 26 Q66 44 48 56 Q32 56 30 38 Z"
        fill="currentColor"
      />
      {/* 右上叶子 */}
      <path
        d="M340 30 Q360 14 372 32 Q364 50 348 50 Q336 44 340 30 Z"
        fill="currentColor"
      />
      {/* 左下叶子 */}
      <path
        d="M16 198 Q34 188 46 204 Q42 222 24 220 Q12 214 16 198 Z"
        fill="currentColor"
      />
      {/* 右下叶子 */}
      <path
        d="M348 196 Q368 186 378 204 Q372 222 354 222 Q344 214 348 196 Z"
        fill="currentColor"
      />
      {/* 圆点散落 */}
      <circle cx="90" cy="22" r="3" fill="currentColor" />
      <circle cx="310" cy="78" r="2.5" fill="currentColor" />
      <circle cx="76" cy="172" r="2.5" fill="currentColor" />
      <circle cx="318" cy="184" r="3" fill="currentColor" />
      <circle cx="200" cy="14" r="1.8" fill="currentColor" />
      {/* 空心圆 */}
      <circle cx="380" cy="120" r="14" fill="none" stroke="currentColor" strokeWidth="1" />
      <circle cx="20" cy="118" r="10" fill="none" stroke="currentColor" strokeWidth="1" />
    </svg>
  );
}
