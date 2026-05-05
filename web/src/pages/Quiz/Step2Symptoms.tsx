/**
 * 公开 Quiz Step 2 — 7 维度症状方块矩阵(同 Onboarding step2,但写匿名 quiz store)
 */

import { useLocation } from 'wouter';
import {
  SYMPTOM_DIMENSIONS,
  SYMPTOM_FREQUENCY,
  type SymptomDimension,
  type SymptomFrequency
} from '../../services/onboarding';
import { useQuiz } from '../../store/quiz';
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

export function QuizStep2Symptoms() {
  const [, navigate] = useLocation();
  const { symptomsFrequency, setSymptomsFrequency } = useQuiz();

  const onCellTap = (dim: SymptomDimension, freq: SymptomFrequency) => {
    const next = { ...symptomsFrequency };
    if (next[dim] === freq) {
      delete next[dim];
    } else {
      next[dim] = freq;
    }
    setSymptomsFrequency(next);
  };

  return (
    <main className="min-h-screen bg-paper px-7 pt-12 pb-10" data-testid="quiz-step2">
      <header className="mb-3 text-xs text-ink/50">2 / 3</header>
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
          <div key={dim} className="flex items-center py-2 border-b border-paper last:border-b-0">
            <div className="w-32 sm:w-40 text-sm text-ink">{DIM_LABELS[dim]}</div>
            {SYMPTOM_FREQUENCY.map((f) => {
              const selected = symptomsFrequency[dim] === f;
              return (
                <button
                  key={f}
                  type="button"
                  onClick={() => onCellTap(dim, f)}
                  className={`flex-1 mx-1 py-2 text-sm rounded-lg transition-colors ${
                    selected ? 'bg-ink text-white' : 'bg-paper text-ink/40'
                  }`}
                  data-testid={`quiz-cell-${dim}-${f}`}
                >
                  ●
                </button>
              );
            })}
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={() => navigate('/quiz/step3')}
        className="mt-12 w-full rounded-full bg-ink text-white py-3 text-base font-medium"
        data-testid="quiz-step2-next"
      >
        下一步
      </button>
      <button
        type="button"
        onClick={() => {
          setSymptomsFrequency({});
          navigate('/quiz/step3');
        }}
        className="mt-3 w-full text-center text-sm text-ink/40"
      >
        过去一周身体没什么反应,跳过
      </button>
    </main>
  );
}
