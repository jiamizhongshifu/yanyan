/**
 * 单个食物条目卡片 — MealResult 页里展示
 *
 * 内容层级:
 *   - 名称 + TCM 标签徽章
 *   - 主料行(LLM 识别到的食材清单)
 *   - 数据胶囊行:DII / GI / AGEs / 添加糖
 *   - 模板化评价(性味 + 营养 + 发物提示,1-3 句)
 *   - 引用折叠
 *   - 反例 / 误识别按钮
 */

import { useState } from 'react';
import type { MealItem } from '../services/meals';
import { diiToLabel, foodCommentary, giToLabel } from '../services/score-display';

interface Props {
  item: MealItem;
  onFlagMisrecognized: (name: string) => void;
  onFlagNoReaction: (name: string) => void;
}

const TCM_LABEL_COLOR: Record<'发' | '温和' | '平', string> = {
  发: 'bg-fire-mild/15 text-fire-mild',
  温和: 'bg-fire-ping/15 text-fire-ping',
  平: 'bg-fire-ping/15 text-fire-ping'
};

const TONE_PILL: Record<'good' | 'mild' | 'neutral', string> = {
  good: 'bg-fire-ping/12 text-fire-ping',
  neutral: 'bg-ink/8 text-ink/60',
  mild: 'bg-fire-mild/12 text-fire-mild'
};

export function FoodItemCard({ item, onFlagMisrecognized, onFlagNoReaction }: Props) {
  const [flagged, setFlagged] = useState<'misrecognized' | 'no_reaction' | null>(null);
  const [showAllCitations, setShowAllCitations] = useState(false);
  const cls = item.classification;
  const ingredients = item.ingredients ?? [];

  const dii = cls ? diiToLabel(cls.diiScore) : null;
  const gi = cls ? giToLabel(cls.gi) : null;
  const commentary = cls ? foodCommentary(cls) : null;

  const visibleCitations = cls
    ? showAllCitations
      ? cls.citations
      : cls.citations.slice(0, 1)
    : [];

  // 主料行只在和食物名不同时显示(避免单一食材重复)
  const showIngredients =
    ingredients.length > 0 &&
    !(ingredients.length === 1 && ingredients[0] === item.name);

  return (
    <div className="rounded-xl bg-white px-4 py-4 mb-3" data-testid="food-item-card" data-name={item.name}>
      <div className="flex items-center justify-between gap-3">
        <div className="text-base text-ink font-medium truncate">{item.name}</div>
        {cls ? (
          <span className={`flex-shrink-0 text-[11px] px-2 py-0.5 rounded-full ${TCM_LABEL_COLOR[cls.tcmLabel]}`}>
            {cls.tcmLabel} · {cls.tcmProperty}
          </span>
        ) : (
          <span className="flex-shrink-0 text-[11px] px-2 py-0.5 rounded-full bg-ink/8 text-ink/55">未收录</span>
        )}
      </div>

      {/* 主料行 */}
      {showIngredients && (
        <div className="mt-2 flex items-start gap-2 text-[11px] text-ink/55">
          <span className="text-ink/35 flex-shrink-0">主料</span>
          <div className="flex flex-wrap gap-1">
            {ingredients.map((ing) => (
              <span
                key={ing}
                className="px-2 py-0.5 rounded-full bg-paper text-ink/65"
              >
                {ing}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* 数据胶囊:DII / GI / AGEs / 添加糖 */}
      {cls && (
        <div className="mt-2 flex flex-wrap gap-1.5 text-[11px]">
          {dii && (
            <span className={`px-2 py-0.5 rounded-full ${TONE_PILL[dii.tone]}`}>
              DII · {dii.text}
            </span>
          )}
          {gi && (
            <span className={`px-2 py-0.5 rounded-full ${TONE_PILL[gi.tone]}`}>
              {gi.text}
            </span>
          )}
          {cls.addedSugarG !== null && cls.addedSugarG > 0 && (
            <span
              className={`px-2 py-0.5 rounded-full ${
                cls.addedSugarG <= 5
                  ? TONE_PILL.good
                  : cls.addedSugarG <= 15
                  ? TONE_PILL.neutral
                  : TONE_PILL.mild
              }`}
            >
              添加糖 ~{cls.addedSugarG} g
            </span>
          )}
          {cls.agesScore !== null && cls.agesScore >= 5000 && (
            <span className={`px-2 py-0.5 rounded-full ${TONE_PILL.mild}`}>
              AGEs 偏高
            </span>
          )}
        </div>
      )}

      {/* 评价 */}
      {commentary && (
        <p className="mt-2.5 text-xs text-ink/70 leading-relaxed" data-testid="food-commentary">
          {commentary}
        </p>
      )}

      {/* 引用 */}
      {cls && cls.citations.length > 0 && (
        <div className="mt-2 text-[11px] text-ink/50 leading-relaxed">
          {visibleCitations.map((c, i) => (
            <div key={i} className="truncate">
              <span className="text-ink/35">
                [{c.source === 'canon' ? '典籍' : c.source === 'paper' ? '论文' : '现代营养'}]
              </span>{' '}
              {c.reference}
            </div>
          ))}
          {cls.citations.length > 1 && !showAllCitations && (
            <button
              type="button"
              onClick={() => setShowAllCitations(true)}
              className="mt-0.5 text-ink/50 underline"
            >
              展开更多 ({cls.citations.length - 1})
            </button>
          )}
        </div>
      )}

      {flagged ? (
        <div className="mt-3 text-xs text-fire-ping" role="status">
          已记录:{flagged === 'misrecognized' ? '识别错误' : '我吃了没事'}
        </div>
      ) : (
        <div className="mt-3 flex gap-3 text-xs">
          <button
            type="button"
            onClick={() => {
              onFlagMisrecognized(item.name);
              setFlagged('misrecognized');
            }}
            className="text-ink/55 underline"
          >
            识别错误
          </button>
          <button
            type="button"
            onClick={() => {
              onFlagNoReaction(item.name);
              setFlagged('no_reaction');
            }}
            className="text-ink/55 underline"
          >
            我吃了没事
          </button>
        </div>
      )}
    </div>
  );
}
