/**
 * Step 1 盲打卡(plan F3 step 1)
 *
 * R12:严格不展示昨日数据 — UI 上不调 fetchYesterdayCompare,只渲染 7 个滑块。
 * R11:维度专属档位,无默认值。
 *
 * 提交后 → POST /symptoms/checkin → 成功跳 Step 2(那时才让 Step 2 拉昨日对照)
 */

import { useState } from 'react';
import { useLocation } from 'wouter';
import { SymptomSlider } from '../../components/SymptomSlider';
import { SYMPTOM_DIMENSIONS, postCheckin } from '../../services/symptoms';
import { useCheckin } from '../../store/checkin';

export function Step1Blind() {
  const [, navigate] = useLocation();
  const { payload, toggle, setSeverity } = useCheckin();
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  // engaged=true 但 severity=null 的视为"勾了没滑" — 默认不进 severity map,但允许提交(后端 effectiveSeverityMap 过滤)
  const onSubmit = async () => {
    if (submitting) return;
    setSubmitting(true);
    setErrorMessage('');
    const ok = await postCheckin(payload);
    setSubmitting(false);
    if (!ok) {
      setErrorMessage('提交失败,请检查网络后重试。');
      return;
    }
    navigate('/check-in/step2');
  };

  return (
    <main className="min-h-screen bg-paper px-7 pt-12 pb-10" data-testid="checkin-step1">
      <header className="mb-3 text-xs text-ink/50">早安 · Step 1</header>
      <h1 className="text-2xl font-semibold text-ink">今早身体感觉怎么样?</h1>
      <p className="mt-3 text-sm text-ink/60 leading-relaxed">
        没反应就跳过,不用每项都选。先勾选,再滑动选程度 — 默认不预填,选错了点同一档可以撤销。
      </p>

      <div className="mt-6 space-y-3">
        {SYMPTOM_DIMENSIONS.map((dim) => {
          const entry = payload[dim];
          return (
            <SymptomSlider
              key={dim}
              dimension={dim}
              engaged={entry?.engaged ?? false}
              severity={entry?.severity ?? null}
              onToggle={toggle}
              onSeverity={setSeverity}
            />
          );
        })}
      </div>

      {errorMessage && (
        <div role="alert" className="mt-6 rounded-xl bg-fire-high/10 px-4 py-3 text-sm text-fire-high">
          {errorMessage}
        </div>
      )}

      <button
        type="button"
        onClick={onSubmit}
        disabled={submitting}
        className="mt-10 w-full rounded-full bg-ink text-white py-3 text-base font-medium disabled:opacity-50"
      >
        {submitting ? '提交中...' : '提交并查看对照'}
      </button>
    </main>
  );
}
