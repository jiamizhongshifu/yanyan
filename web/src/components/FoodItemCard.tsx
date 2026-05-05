/**
 * 单个食物条目卡片 — MealResult 页里展示
 *
 * 内容层级:
 *   - 名称 + TCM 标签(发/温和/平)+ 性味(寒/凉/平/温/热)
 *   - 数据胶囊行:DII 方向 + GI 高低(任一为 null 不显示)
 *   - 模板化正向评价(基于 TCM/DII/GI 组合)
 *   - 引用折叠:默认展开 1 条,> 1 条时"展开更多"
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

  const dii = cls ? diiToLabel(cls.diiScore) : null;
  const gi = cls ? giToLabel(cls.gi) : null;
  const commentary = cls ? foodCommentary(cls) : null;

  const visibleCitations = cls
    ? showAllCitations
      ? cls.citations
      : cls.citations.slice(0, 1)
    : [];

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

      {cls && (dii || gi) && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {dii && (
            <span className={`text-[11px] px-2 py-0.5 rounded-full ${TONE_PILL[dii.tone]}`}>
              {dii.text}
            </span>
          )}
          {gi && (
            <span className={`text-[11px] px-2 py-0.5 rounded-full ${TONE_PILL[gi.tone]}`}>
              {gi.text}
            </span>
          )}
        </div>
      )}

      {commentary && (
        <p className="mt-2 text-xs text-ink/70 leading-relaxed" data-testid="food-commentary">
          {commentary}
        </p>
      )}

      {cls && cls.citations.length > 0 && (
        <div className="mt-2 text-[11px] text-ink/55 leading-relaxed">
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
