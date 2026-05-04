/**
 * 单个食物条目卡片 — MealResult 页里展示
 *
 * R7:每条目附中医典籍引用 / 现代营养学引用
 * R8:无 AI 人格化主播文案
 * R9:点"我吃了没事"反例 / "误识别"标记
 */

import { useState } from 'react';
import type { MealItem } from '../services/meals';

interface Props {
  item: MealItem;
  onFlagMisrecognized: (name: string) => void;
  onFlagNoReaction: (name: string) => void;
}

const TCM_LABEL_COLOR: Record<'发' | '温和' | '平', string> = {
  发: 'bg-fire-high text-white',
  温和: 'bg-fire-mild text-white',
  平: 'bg-fire-ping text-white'
};

const TCM_LABEL_TEXT: Record<'发' | '温和' | '平', string> = {
  发: '发',
  温和: '温和',
  平: '平'
};

export function FoodItemCard({ item, onFlagMisrecognized, onFlagNoReaction }: Props) {
  const [flagged, setFlagged] = useState<'misrecognized' | 'no_reaction' | null>(null);
  const cls = item.classification;

  return (
    <div className="rounded-xl bg-white px-4 py-4 mb-3" data-testid="food-item-card" data-name={item.name}>
      <div className="flex items-center justify-between">
        <div className="text-base text-ink font-medium">{item.name}</div>
        {cls && (
          <span className={`text-xs px-2 py-0.5 rounded-full ${TCM_LABEL_COLOR[cls.tcmLabel]}`}>
            {TCM_LABEL_TEXT[cls.tcmLabel]} · {cls.tcmProperty}
          </span>
        )}
        {!cls && (
          <span className="text-xs px-2 py-0.5 rounded-full bg-ink/10 text-ink/60">未收录</span>
        )}
      </div>

      {cls && cls.citations.length > 0 && (
        <div className="mt-2 text-xs text-ink/60 leading-relaxed">
          {cls.citations.map((c, i) => (
            <div key={i} className="truncate">
              <span className="text-ink/40">[{c.source === 'canon' ? '典籍' : c.source === 'paper' ? '论文' : '现代营养'}]</span>{' '}
              {c.reference}
            </div>
          ))}
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
            className="text-ink/60 underline"
          >
            识别错误
          </button>
          <button
            type="button"
            onClick={() => {
              onFlagNoReaction(item.name);
              setFlagged('no_reaction');
            }}
            className="text-ink/60 underline"
          >
            我吃了没事
          </button>
        </div>
      )}
    </div>
  );
}
