/**
 * SymptomSlider — 7 维度专属严重度滑块
 *
 * 关键设计(plan R11 + Round 2 修订):
 *   - 用户先勾选 engaged → 才显示滑块
 *   - 滑块**无默认值**(severity=null)→ 用户必须主动选 1 次才视为有效
 *   - 各维度独立档位数(3-5),非 100 分制
 *   - severity=null 时 UI 提示"请滑动选择"
 */

import type { SymptomDimension } from '../services/symptoms';
import { SYMPTOM_DIMENSION_LABELS, SYMPTOM_DIMENSION_LEVELS, SYMPTOM_LEVEL_LABELS } from '../services/symptoms';

interface Props {
  dimension: SymptomDimension;
  engaged: boolean;
  severity: number | null;
  onToggle: (dim: SymptomDimension) => void;
  onSeverity: (dim: SymptomDimension, severity: number) => void;
}

export function SymptomSlider({ dimension, engaged, severity, onToggle, onSeverity }: Props) {
  const max = SYMPTOM_DIMENSION_LEVELS[dimension];
  const labels = SYMPTOM_LEVEL_LABELS[dimension];

  return (
    <div
      className={`rounded-2xl bg-white px-4 py-3 ${engaged ? 'border-2 border-ink' : 'border-2 border-transparent'}`}
      data-testid={`slider-${dimension}`}
    >
      <label className="flex items-center justify-between cursor-pointer">
        <div className="text-base text-ink font-medium">{SYMPTOM_DIMENSION_LABELS[dimension]}</div>
        <input
          type="checkbox"
          checked={engaged}
          onChange={() => onToggle(dimension)}
          className="h-5 w-5 accent-ink"
          aria-label={`勾选 ${SYMPTOM_DIMENSION_LABELS[dimension]}`}
          data-testid={`engage-${dimension}`}
        />
      </label>

      {engaged && (
        <div className="mt-3">
          <div className="flex justify-between gap-1" role="radiogroup" aria-label={`${SYMPTOM_DIMENSION_LABELS[dimension]} 严重度`}>
            {Array.from({ length: max }, (_, i) => i + 1).map((n) => {
              const active = severity === n;
              return (
                <button
                  key={n}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  onClick={() => onSeverity(dimension, n)}
                  data-testid={`level-${dimension}-${n}`}
                  className={`flex-1 rounded-lg py-2 text-xs ${
                    active ? 'bg-ink text-white' : 'bg-paper text-ink/70 border border-ink/10'
                  }`}
                >
                  {labels[n - 1]}
                </button>
              );
            })}
          </div>
          {severity == null && (
            <p className="mt-2 text-xs text-fire-mid" role="status">
              请选一个程度(默认不预设)
            </p>
          )}
        </div>
      )}
    </div>
  );
}
