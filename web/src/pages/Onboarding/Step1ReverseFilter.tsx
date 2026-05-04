/**
 * Onboarding Step 1 — 反向定位筛选(5 选 1)
 * R3:不出现"减肥/卡路里"字样
 */

import { useLocation } from 'wouter';
import { REVERSE_FILTER_CHOICES, type ReverseFilterChoice } from '../../services/onboarding';
import { useOnboarding } from '../../store/onboarding';

const CHOICE_LABELS: Record<ReverseFilterChoice, string> = {
  rhinitis: '想改鼻炎',
  blood_sugar: '想改血糖',
  uric_acid: '想改尿酸',
  checkup_abnormal: '想改体检异常',
  curious: '看看而已'
};

export function Step1ReverseFilter() {
  const [, navigate] = useLocation();
  const { reverseFilterChoice, setReverseFilterChoice } = useOnboarding();

  return (
    <main className="min-h-screen bg-paper px-7 pt-12 pb-10">
      <header className="mb-3 text-xs text-ink/50">1 / 4</header>
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
            >
              {CHOICE_LABELS[key]}
            </button>
          );
        })}
      </div>

      <button
        type="button"
        onClick={() => navigate('/onboarding/step2')}
        disabled={!reverseFilterChoice}
        className="mt-12 w-full rounded-full bg-ink text-white py-3 text-base font-medium disabled:opacity-40"
      >
        下一步
      </button>
    </main>
  );
}
