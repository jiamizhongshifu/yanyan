/**
 * 公开 Quiz Step 3 — 生活方式 2 题(饮食 + 睡眠)
 */

import { useLocation } from 'wouter';
import {
  RECENT_DIET_OPTIONS,
  RECENT_DIET_LABELS,
  SLEEP_OPTIONS,
  SLEEP_LABELS,
  type RecentDiet,
  type SleepPattern
} from '../../services/quiz';
import { useQuiz } from '../../store/quiz';

export function QuizStep3Lifestyle() {
  const [, navigate] = useLocation();
  const { recentDiet, sleepPattern, setRecentDiet, setSleepPattern, markCompleted } = useQuiz();

  const canSubmit = recentDiet !== null && sleepPattern !== null;

  const onSubmit = () => {
    markCompleted();
    navigate('/quiz/result');
  };

  return (
    <main className="min-h-screen bg-paper px-7 pt-12 pb-10" data-testid="quiz-step3">
      <header className="mb-3 text-xs text-ink/50">3 / 3</header>
      <h1 className="text-2xl font-semibold text-ink">最后两题,关于你的近期状态</h1>

      <section className="mt-8">
        <p className="text-sm text-ink mb-3">过去一周的饮食大致是?</p>
        <div className="space-y-2">
          {RECENT_DIET_OPTIONS.map((opt) => {
            const selected = recentDiet === opt;
            return (
              <button
                key={opt}
                type="button"
                onClick={() => setRecentDiet(opt as RecentDiet)}
                className={`w-full rounded-2xl px-5 py-3 text-sm text-left border-2 transition-colors ${
                  selected ? 'border-ink bg-ink text-white' : 'border-ink/15 bg-white text-ink'
                }`}
                data-testid={`quiz-diet-${opt}`}
              >
                {RECENT_DIET_LABELS[opt as RecentDiet]}
              </button>
            );
          })}
        </div>
      </section>

      <section className="mt-8">
        <p className="text-sm text-ink mb-3">最近睡眠?</p>
        <div className="space-y-2">
          {SLEEP_OPTIONS.map((opt) => {
            const selected = sleepPattern === opt;
            return (
              <button
                key={opt}
                type="button"
                onClick={() => setSleepPattern(opt as SleepPattern)}
                className={`w-full rounded-2xl px-5 py-3 text-sm text-left border-2 transition-colors ${
                  selected ? 'border-ink bg-ink text-white' : 'border-ink/15 bg-white text-ink'
                }`}
                data-testid={`quiz-sleep-${opt}`}
              >
                {SLEEP_LABELS[opt as SleepPattern]}
              </button>
            );
          })}
        </div>
      </section>

      <button
        type="button"
        onClick={onSubmit}
        disabled={!canSubmit}
        className="mt-12 w-full rounded-full bg-ink text-white py-3 text-base font-medium disabled:opacity-40"
        data-testid="quiz-submit"
      >
        看我的炎症指数
      </button>
    </main>
  );
}
