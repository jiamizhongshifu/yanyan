/**
 * 今日推荐卡 (plan U13a)
 *
 * 用在主屏火分卡片下方 + Step3 火分揭晓后。
 * 模式:fa_heavy → 显示 avoid + 3 餐;其它模式 → 鼓励 + 3 餐(无 avoid)。
 */

import { useEffect, useState } from 'react';
import { fetchTodayRecommendation, SLOT_LABELS, type TodayRecommendation } from '../services/recommend';

/**
 * 推荐卡上只显示"现代营养 / 论文"来源,典籍(canon=本草纲目等)的引用
 * 在卡片层面隐藏,避免给到用户脱离现代饮食习惯的暗示。
 *
 * 食物详情卡仍可看到典籍引用作为深度参考(MealResult/FoodItemCard)。
 */
function preferModernCitation<T extends { source: string; reference: string }>(
  citations: T[]
): T | undefined {
  const modern = citations.find((c) => c.source === 'modern_nutrition');
  if (modern) return modern;
  const paper = citations.find((c) => c.source === 'paper');
  if (paper) return paper;
  return undefined; // 只有 canon 时不渲染来源行
}

export function TodaySuggestionCard() {
  const [rec, setRec] = useState<TodayRecommendation | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    void fetchTodayRecommendation().then((r) => {
      if (!mounted) return;
      setRec(r);
      setLoading(false);
    });
    return () => {
      mounted = false;
    };
  }, []);

  if (loading) {
    return (
      <section className="rounded-2xl bg-white px-5 py-4" data-testid="suggestion-loading">
        <span className="text-xs text-ink/40">加载推荐…</span>
      </section>
    );
  }
  if (!rec) return null;

  return (
    <section className="rounded-2xl bg-white px-5 py-5 space-y-4" data-testid="suggestion-card">
      <header>
        <h3 className="text-base font-medium text-ink" data-testid="suggestion-headline">
          {rec.headline}
        </h3>
        <p className="mt-1 text-xs text-ink/60 leading-relaxed" data-testid="suggestion-tagline">
          {rec.tagline}
        </p>
      </header>

      {rec.avoid.length > 0 && (
        <div data-testid="suggestion-avoid">
          <p className="text-xs text-ink/50 mb-2">今日避开</p>
          <div className="flex flex-wrap gap-2">
            {rec.avoid.map((a) => (
              <span
                key={a.name}
                className="px-3 py-1 rounded-full text-xs bg-fire-mid/10 text-fire-mid"
              >
                {a.name}
              </span>
            ))}
          </div>
        </div>
      )}

      <div data-testid="suggestion-meals">
        <p className="text-xs text-ink/50 mb-2">推荐 3 餐</p>
        <ul className="space-y-2">
          {rec.meals.map((m) => {
            const cite = preferModernCitation(m.citations);
            // 第一项是菜名(server 端 recipes/v1.json 约定),后面是主料预览
            const [dishName, ...ingredients] = m.items;
            return (
              <li key={m.slot} className="flex items-start gap-3 text-sm text-ink">
                <span className="shrink-0 text-ink/50 w-12">{SLOT_LABELS[m.slot]}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-ink font-medium">{dishName ?? '—'}</p>
                  {ingredients.length > 0 && (
                    <p className="mt-0.5 text-xs text-ink/55">
                      {ingredients.join(' · ')}
                    </p>
                  )}
                  {cite && (
                    <p className="mt-0.5 text-[11px] text-ink/40">
                      <span className="text-ink/30">[现代营养] </span>
                      {cite.reference}
                    </p>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
