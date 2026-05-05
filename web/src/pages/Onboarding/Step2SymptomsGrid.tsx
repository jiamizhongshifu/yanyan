/**
 * Onboarding Step 2 — 7 维度症状频次方块矩阵
 *
 * 7 行 × 3 列(几乎没 / 偶尔 / 经常),纯打勾,无文字输入
 */

import { useLocation } from 'wouter';
import { SYMPTOM_DIMENSIONS, SYMPTOM_FREQUENCY, type SymptomDimension, type SymptomFrequency } from '../../services/onboarding';
import { useOnboarding } from '../../store/onboarding';
import { asset } from '../../services/assets';

const DIM_LABELS: Record<SymptomDimension, string> = {
  nasal_congestion: '鼻塞',
  acne: '起痘',
  dry_mouth: '口干',
  bowel: '大便异常',
  fatigue: '精神差 / 困倦',
  edema: '浮肿',
  throat_itch: '喉咙痒'
};

const FREQ_LABELS: Record<SymptomFrequency, string> = {
  rare: '几乎没',
  sometimes: '偶尔',
  often: '经常'
};

export function Step2SymptomsGrid() {
  const [, navigate] = useLocation();
  const { symptomsFrequency, setSymptomsFrequency } = useOnboarding();

  const onCellTap = (dim: SymptomDimension, freq: SymptomFrequency) => {
    const next = { ...symptomsFrequency };
    if (next[dim] === freq) {
      delete next[dim];
    } else {
      next[dim] = freq;
    }
    setSymptomsFrequency(next);
  };

  const onSkipAll = () => {
    setSymptomsFrequency({});
    navigate('/onboarding/step3');
  };

  return (
    <main className="min-h-screen bg-paper px-7 pt-12 pb-10">
      <header className="mb-3 text-xs text-ink/50">2 / 4</header>
      <div className="flex justify-center mb-3">
        <img src={asset('onboarding-mirror.png')} alt="" className="w-32 h-32 object-contain" loading="lazy" />
      </div>
      <h1 className="text-2xl font-semibold text-ink">过去一周,身体偶尔有过这些反应吗?</h1>
      <p className="mt-3 text-sm text-ink/60">没有就跳过这一行,不用每行都选。</p>

      <div className="mt-6 rounded-2xl bg-white px-3 py-2">
        <div className="flex items-center pb-2 border-b border-paper">
          <div className="w-32 sm:w-40" />
          {SYMPTOM_FREQUENCY.map((f) => (
            <div key={f} className="flex-1 text-center text-xs text-ink/50">
              {FREQ_LABELS[f]}
            </div>
          ))}
        </div>

        {SYMPTOM_DIMENSIONS.map((dim) => (
          <div key={dim} className="flex items-center py-3 border-b border-paper last:border-b-0">
            <div className="w-32 sm:w-40 text-sm text-ink pl-1">{DIM_LABELS[dim]}</div>
            {SYMPTOM_FREQUENCY.map((freq) => {
              const active = symptomsFrequency[dim] === freq;
              return (
                <button
                  key={freq}
                  type="button"
                  onClick={() => onCellTap(dim, freq)}
                  aria-label={`${DIM_LABELS[dim]} ${FREQ_LABELS[freq]}`}
                  aria-pressed={active}
                  data-cell={`${dim}:${freq}`}
                  className={`flex-1 mx-1 h-8 rounded-md border-2 transition-colors ${
                    active ? 'border-ink bg-ink' : 'border-ink/15 bg-paper'
                  }`}
                />
              );
            })}
          </div>
        ))}
      </div>

      <div className="mt-8 flex gap-3">
        <button
          type="button"
          onClick={onSkipAll}
          className="flex-1 rounded-full border-2 border-ink/15 text-ink py-3 text-sm"
        >
          都没有 / 跳过
        </button>
        <button
          type="button"
          onClick={() => navigate('/onboarding/step3')}
          className="flex-[2] rounded-full bg-ink text-white py-3 text-base font-medium"
        >
          下一步
        </button>
      </div>
    </main>
  );
}
