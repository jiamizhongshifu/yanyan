/**
 * 单个食物条目卡片 — MealResult 页里展示
 *
 * 内容层级:
 *   - 名称 + TCM 标签徽章
 *   - 主料明细行(可加 / 可删,本地 draft → 点"重新计算"提交)
 *   - 数据胶囊行:DII / GI / AGEs / 添加糖
 *   - 评价 + 引用
 *   - 反馈行:👍 / 👎(👎 弹文本框收集详细反馈)
 */

import { useEffect, useState } from 'react';
import type { MealItem, MealFeedbackKind } from '../services/meals';
import { diiToLabel, foodCommentary, giToLabel } from '../services/score-display';

interface Props {
  item: MealItem;
  onSendFeedback: (name: string, kind: MealFeedbackKind, note?: string) => void;
  /** 用户提交编辑后的主料完整列表;父组件负责 server 重算 */
  onSubmitIngredients?: (newIngredients: string[]) => void;
  /** 父在 server 调用进行中时锁定按钮 */
  isSaving?: boolean;
}

const TCM_LABEL_COLOR: Record<'发' | '温和' | '平', string> = {
  发: 'bg-fire-mild/15 text-fire-mild',
  温和: 'bg-fire-ping/15 text-fire-ping',
  平: 'bg-fire-ping/15 text-fire-ping'
};

const TONE_PILL: Record<'good' | 'mild' | 'neutral', string> = {
  good: 'bg-fire-ping/12 text-fire-ping',
  neutral: 'bg-ink/8 text-ink/50',
  mild: 'bg-fire-mild/12 text-fire-mild'
};

export function FoodItemCard({ item, onSendFeedback, onSubmitIngredients, isSaving = false }: Props) {
  const cls = item.classification;
  const savedIngredients = item.ingredients ?? [];

  const [draft, setDraft] = useState<string[]>(savedIngredients);
  const [showAllCitations, setShowAllCitations] = useState(false);
  const [adding, setAdding] = useState(false);
  const [newIngredient, setNewIngredient] = useState('');

  // 反馈状态
  const [feedbackSent, setFeedbackSent] = useState<'thumbs_up' | 'thumbs_down' | null>(null);
  const [thumbsDownOpen, setThumbsDownOpen] = useState(false);
  const [feedbackNote, setFeedbackNote] = useState('');

  // 当 server 返回新数据(savedIngredients 变了)→ 同步 draft
  // 仅在不处于添加输入态时同步,避免覆盖用户正在输入的内容
  const savedKey = savedIngredients.join('|');
  useEffect(() => {
    if (!adding) setDraft(savedIngredients);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [savedKey]);

  const dii = cls ? diiToLabel(cls.diiScore) : null;
  const gi = cls ? giToLabel(cls.gi) : null;
  const commentary = cls ? foodCommentary(cls) : null;
  const visibleCitations = cls
    ? showAllCitations
      ? cls.citations
      : cls.citations.slice(0, 1)
    : [];

  const showIngredients =
    draft.length > 0 && !(draft.length === 1 && draft[0] === item.name);

  const dirty = JSON.stringify(draft) !== JSON.stringify(savedIngredients);

  const submitAdd = () => {
    const trimmed = newIngredient.trim();
    if (!trimmed) return;
    if (draft.includes(trimmed)) {
      setNewIngredient('');
      setAdding(false);
      return;
    }
    setDraft([...draft, trimmed]);
    setNewIngredient('');
    setAdding(false);
  };

  const removeFromDraft = (name: string) => {
    setDraft(draft.filter((x) => x !== name));
  };

  const submitDraft = () => {
    if (!onSubmitIngredients || !dirty) return;
    onSubmitIngredients(draft);
  };

  const handleThumbsUp = () => {
    if (feedbackSent) return;
    onSendFeedback(item.name, 'thumbs_up');
    setFeedbackSent('thumbs_up');
  };

  const submitThumbsDown = () => {
    onSendFeedback(item.name, 'thumbs_down', feedbackNote.trim() || undefined);
    setFeedbackSent('thumbs_down');
    setThumbsDownOpen(false);
  };

  return (
    <div className="rounded-xl bg-white px-4 py-4 mb-3" data-testid="food-item-card" data-name={item.name}>
      <div className="flex items-center justify-between gap-3">
        <div className="text-base text-ink font-medium truncate">{item.name}</div>
        {cls ? (
          <span className={`flex-shrink-0 text-[11px] px-2 py-0.5 rounded-full ${TCM_LABEL_COLOR[cls.tcmLabel]}`}>
            {cls.tcmLabel} · {cls.tcmProperty}
          </span>
        ) : (
          <span className="flex-shrink-0 text-[11px] px-2 py-0.5 rounded-full bg-ink/8 text-ink/50">未收录</span>
        )}
      </div>

      {/* 主料明细 */}
      {(showIngredients || onSubmitIngredients) && (
        <div className="mt-3">
          <p className="text-[11px] text-ink/50 mb-1.5">食材成分</p>
          <div className="space-y-1">
            {draft.map((ing) => {
              const detail = item.ingredientDetails?.find((d) => d.name === ing);
              const c = detail?.classification ?? null;
              return (
                <div
                  key={ing}
                  className="flex items-baseline justify-between gap-2 py-1 border-b border-paper last:border-0"
                >
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <span className="text-xs text-ink/70">{ing}</span>
                    {onSubmitIngredients && (
                      <button
                        type="button"
                        onClick={() => removeFromDraft(ing)}
                        disabled={isSaving}
                        className="text-ink/30 active:text-fire-mild text-xs disabled:opacity-40"
                        aria-label={`删除主料 ${ing}`}
                      >
                        ✕
                      </button>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center justify-end gap-1 text-[10px]">
                    {c ? (
                      <>
                        <span className="text-ink/50">
                          {c.tcmLabel} · {c.tcmProperty}
                        </span>
                        {c.diiScore !== null && (
                          <span
                            className={`px-1.5 py-0.5 rounded ${
                              c.diiScore < -0.5
                                ? 'bg-fire-ping/12 text-fire-ping'
                                : c.diiScore > 0.5
                                ? 'bg-fire-mild/12 text-fire-mild'
                                : 'bg-ink/8 text-ink/50'
                            }`}
                          >
                            DII {c.diiScore.toFixed(1)}
                          </span>
                        )}
                        {c.gi !== null && (
                          <span className="px-1.5 py-0.5 rounded bg-ink/8 text-ink/50">
                            GI {Math.round(c.gi)}
                          </span>
                        )}
                        {c.addedSugarG !== null && c.addedSugarG > 0 && (
                          <span className="px-1.5 py-0.5 rounded bg-ink/8 text-ink/50">
                            糖 {c.addedSugarG}g
                          </span>
                        )}
                        {c.carbsG !== null && (
                          <span className="px-1.5 py-0.5 rounded bg-ink/8 text-ink/50">
                            碳水 {c.carbsG}g
                          </span>
                        )}
                      </>
                    ) : (
                      <span className="text-ink/30">数据待补录</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {onSubmitIngredients && (
            <div className="mt-2 flex flex-wrap items-center gap-2">
              {adding ? (
                <>
                  <input
                    type="text"
                    autoFocus
                    value={newIngredient}
                    onChange={(e) => setNewIngredient(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') submitAdd();
                      else if (e.key === 'Escape') {
                        setAdding(false);
                        setNewIngredient('');
                      }
                    }}
                    placeholder="食材名(如：牛肉)"
                    className="flex-1 min-w-[120px] rounded-lg border border-ink/15 bg-paper px-3 py-1.5 text-xs focus:border-ink focus:outline-none"
                    maxLength={32}
                  />
                  <button
                    type="button"
                    onClick={submitAdd}
                    disabled={!newIngredient.trim()}
                    className="px-3 py-1.5 rounded-lg bg-paper border border-ink/15 text-ink text-xs disabled:opacity-40"
                  >
                    加入
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={() => setAdding(true)}
                  disabled={isSaving}
                  className="text-xs text-ink/50 active:text-ink underline disabled:opacity-40"
                >
                  + 添加食材
                </button>
              )}
              {dirty && !adding && (
                <button
                  type="button"
                  onClick={submitDraft}
                  disabled={isSaving}
                  className="ml-auto px-3.5 py-1.5 rounded-lg bg-ink text-paper text-xs font-medium disabled:opacity-40"
                >
                  {isSaving ? '重新计算中…' : '重新计算'}
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* 数据胶囊 */}
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

      {commentary && (
        <p className="mt-2.5 text-xs text-ink/70 leading-relaxed" data-testid="food-commentary">
          {commentary}
        </p>
      )}

      {cls && cls.citations.length > 0 && (
        <div className="mt-2 text-[11px] text-ink/50 leading-relaxed">
          {visibleCitations.map((c, i) => (
            <div key={i} className="truncate">
              <span className="text-ink/30">
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

      {/* 识别反馈行 */}
      <div className="mt-3 pt-3 border-t border-paper">
        {feedbackSent ? (
          <p className="text-xs text-ink/50" role="status">
            {feedbackSent === 'thumbs_up' ? '感谢反馈,已收到 👍' : '感谢反馈,已记录 👎'}
          </p>
        ) : thumbsDownOpen ? (
          <div>
            <p className="text-xs text-ink/50 mb-1.5">告诉我们哪里识别得不准:</p>
            <div className="flex items-center gap-2">
              <input
                type="text"
                autoFocus
                value={feedbackNote}
                onChange={(e) => setFeedbackNote(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && feedbackNote.trim()) submitThumbsDown();
                  else if (e.key === 'Escape') {
                    setThumbsDownOpen(false);
                    setFeedbackNote('');
                  }
                }}
                placeholder="例如：这盘菜其实是 XX，主料应该是 YY"
                maxLength={200}
                className="flex-1 rounded-lg border border-ink/15 bg-paper px-3 py-1.5 text-xs focus:border-ink focus:outline-none"
              />
              <button
                type="button"
                onClick={submitThumbsDown}
                disabled={!feedbackNote.trim()}
                className="px-3 py-1.5 rounded-lg bg-ink text-paper text-xs disabled:opacity-40"
              >
                提交
              </button>
              <button
                type="button"
                onClick={() => {
                  setThumbsDownOpen(false);
                  setFeedbackNote('');
                }}
                className="px-2 py-1.5 text-xs text-ink/50"
              >
                取消
              </button>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-3 text-xs">
            <span className="text-ink/50">识别准确吗?</span>
            <button
              type="button"
              onClick={handleThumbsUp}
              className="px-2.5 py-1 rounded-lg bg-paper text-ink/70 active:bg-fire-ping/12 active:text-fire-ping"
              aria-label="识别正确"
              data-testid="thumbs-up"
            >
              👍
            </button>
            <button
              type="button"
              onClick={() => setThumbsDownOpen(true)}
              className="px-2.5 py-1 rounded-lg bg-paper text-ink/70 active:bg-fire-mild/12 active:text-fire-mild"
              aria-label="识别有误"
              data-testid="thumbs-down"
            >
              👎
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

