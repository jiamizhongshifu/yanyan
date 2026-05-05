/**
 * 公开 Quiz Step 1 — 反向定位(与 Onboarding step1 同一交互,但写匿名 quiz store)
 */

import { useLocation } from 'wouter';
import { REVERSE_FILTER_CHOICES, type ReverseFilterChoice } from '../../services/onboarding';
import { useQuiz } from '../../store/quiz';
import { asset } from '../../services/assets';

const CHOICE_LABELS: Record<ReverseFilterChoice, string> = {
  rhinitis: '想改鼻炎',
  blood_sugar: '想改血糖',
  uric_acid: '想改尿酸',
  checkup_abnormal: '想改体检异常',
  curious: '看看而已'
};

export function QuizStep1Goal() {
  const [, navigate] = useLocation();
  const { reverseFilterChoice, setReverseFilterChoice } = useQuiz();

  return (
    <main className="min-h-screen bg-paper px-7 pt-12 pb-10" data-testid="quiz-step1">
      <header className="mb-3 text-xs text-ink/50">1 / 3</header>
      <div className="flex justify-center mb-3">
        <img src={asset('onboarding-path.png')} alt="" className="w-36 h-36 object-contain" loading="lazy" />
      </div>
      <h1 className="text-2xl font-semibold text-ink">你最希望解决什么?</h1>
      <p className="mt-3 text-sm text-ink/60">这一步用来帮你筛对的内容,选错也没关系。</p>

      <div className="mt-8 space-y-3">
        {REVERSE_FILTER_CHOICES.map((key) => {
          const selected = reverseFilterChoice === key;
          return (
            <button
              key={key}
              type="button"
              onClick={() => setReverseFilterChoice(key)}
              className={`w-full rounded-2xl px-5 py-4 text-base text-left border-2 transition-colors ${
                selected ? 'border-ink bg-ink text-white' : 'border-ink/15 bg-white text-ink'
              }`}
              data-testid={`quiz-choice-${key}`}
            >
              {CHOICE_LABELS[key]}
            </button>
          );
        })}
      </div>

      <button
        type="button"
        onClick={() => navigate('/quiz/step2')}
        disabled={!reverseFilterChoice}
        className="mt-12 w-full rounded-full bg-ink text-white py-3 text-base font-medium disabled:opacity-40"
        data-testid="quiz-step1-next"
      >
        下一步
      </button>
    </main>
  );
}
