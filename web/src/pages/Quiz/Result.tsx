/**
 * 公开 Quiz Result — 抗炎指数 + 等级 + 建议 + 锁定功能预览 + 登录 CTA
 *
 * 漏斗底部:用户看到自己的初步指数后,展示登录后能解锁什么(每餐抗炎指数 / 30 天档案 / 个体易诱炎食物清单)
 */

import { useEffect, useMemo } from 'react';
import { useLocation } from 'wouter';
import { computeInflammationIndex, LEVEL_HINT, type InflammationIndex } from '../../services/quiz';
import { useQuiz } from '../../store/quiz';
import { Icon } from '../../components/Icon';
import { LevelIcon } from '../../components/LevelIcon';
import type { FireLevel } from '../../services/onboarding';
import { LEVEL_TO_LABEL, LEVEL_TO_STARS } from '../../services/score-display';

const LEVEL_COLOR: Record<FireLevel, string> = {
  平: 'text-fire-ping',
  微火: 'text-fire-ping',
  中火: 'text-fire-mild',
  大火: 'text-fire-mid'
};

const UNLOCKED_FEATURES = [
  {
    title: '每餐拍照即时抗炎指数',
    body: 'AI 识别食物 + 当餐抗炎指数(★1-5),饭桌上 5 秒看清这一餐对身体友不友好。'
  },
  {
    title: '次晨 30 秒打卡',
    body: '今天吃的 vs 明天身体反应,自动建立"哪些食物对你这个体质有反应"的回归。'
  },
  {
    title: '14 天起渐进易诱炎食物清单',
    body: '当数据足够,系统给出"你这个体质常见反应的食物" top-3 → top-7,可分享给妈妈或医生。'
  },
  {
    title: '30 天体质档案 PDF',
    body: '完整 30 天抗炎指数趋势 + 个体易诱炎食物 + 体检对照(若上传)+ 引用,可下载 / 分享。'
  }
];

export function QuizResult() {
  const [, navigate] = useLocation();
  const quiz = useQuiz();

  const index: InflammationIndex = useMemo(
    () =>
      computeInflammationIndex({
        reverseFilterChoice: quiz.reverseFilterChoice,
        symptomsFrequency: quiz.symptomsFrequency,
        recentDiet: quiz.recentDiet,
        sleepPattern: quiz.sleepPattern
      }),
    [quiz.reverseFilterChoice, quiz.symptomsFrequency, quiz.recentDiet, quiz.sleepPattern]
  );

  // 没完成 quiz 的用户直接进 result → 引回 step1
  useEffect(() => {
    if (!quiz.completedAt) {
      navigate('/quiz/step1', { replace: true });
    }
  }, [quiz.completedAt, navigate]);

  if (!quiz.completedAt) return null;

  const hint = LEVEL_HINT[index.level];

  return (
    <main className="min-h-screen bg-paper px-6 pt-12 pb-20 max-w-md mx-auto" data-testid="quiz-result">
      <header className="text-xs text-ink/40 tracking-widest">Soak · 初步评估</header>

      <section className="mt-6 rounded-3xl bg-white px-6 py-10 text-center">
        <div className="mx-auto w-32 h-32" data-testid="level-illustration">
          <LevelIcon level={index.level} className="w-32 h-32" />
        </div>
        <p className="mt-5 text-xs text-ink/50 tracking-wide">你当前的抗炎指数</p>
        <p className={`mt-3 text-5xl leading-none ${LEVEL_COLOR[index.level]}`} data-testid="result-score">
          {'★'.repeat(LEVEL_TO_STARS[index.level])}
          <span className="text-ink/15">{'★'.repeat(5 - LEVEL_TO_STARS[index.level])}</span>
        </p>
        <p className={`mt-3 text-2xl font-medium ${LEVEL_COLOR[index.level]}`} data-testid="result-level">
          {LEVEL_TO_LABEL[index.level]}
        </p>
        <p className="mt-3 text-xs text-ink/40">基于 {Math.round(index.completeness * 100)}% 数据完整度</p>
      </section>

      <section className="mt-5 rounded-2xl bg-white px-6 py-5">
        <h2 className="text-base font-medium text-ink">{hint.headline}</h2>
        <p className="mt-2 text-sm text-ink/70 leading-relaxed">{hint.body}</p>

        <div className="mt-5 grid grid-cols-2 gap-3 text-xs">
          <div className="rounded-xl bg-paper px-3 py-2">
            <p className="text-ink/40">症状部分</p>
            <p className="mt-1 text-ink font-medium">{index.breakdown.symptomPart}</p>
          </div>
          <div className="rounded-xl bg-paper px-3 py-2">
            <p className="text-ink/40">生活方式部分</p>
            <p className="mt-1 text-ink font-medium">{index.breakdown.lifestylePart}</p>
          </div>
        </div>
      </section>

      <section className="mt-5 rounded-2xl bg-white px-4 py-4" data-testid="result-scale-img">
        <p className="text-xs text-ink/50 mb-3 px-2">抗炎指数 4 档分级参考</p>
        <div className="grid grid-cols-4 gap-2">
          {(['平', '微火', '中火', '大火'] as const).map((lvl) => (
            <div key={lvl} className="flex flex-col items-center">
              <LevelIcon level={lvl} className="w-12 h-12" />
              <p className="mt-2 text-xs text-ink/65">{LEVEL_TO_LABEL[lvl]}</p>
              <p className="text-[10px] text-ink/40">{'★'.repeat(LEVEL_TO_STARS[lvl])}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-8">
        <h2 className="text-base font-medium text-ink mb-4">登录后解锁这些</h2>
        <div className="space-y-3">
          {UNLOCKED_FEATURES.map((f, i) => (
            <div key={i} className="rounded-2xl bg-white px-5 py-4 relative">
              <div className="absolute top-4 right-4 text-ink/30">
                <Icon name="lock" className="w-3.5 h-3.5" />
              </div>
              <h3 className="text-sm font-medium text-ink pr-8">{f.title}</h3>
              <p className="mt-1 text-xs text-ink/60 leading-relaxed">{f.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-10 sticky bottom-4 z-30">
        <button
          type="button"
          onClick={() => navigate('/login')}
          className="block w-full text-center rounded-full bg-ink text-white py-4 text-base font-medium shadow-lg active:opacity-80"
          data-testid="cta-login"
        >
          登录解锁完整体验 →
        </button>
        <p className="mt-3 text-xs text-ink/40 text-center">
          登录后,你刚才的回答会自动作为 baseline,无需重答。
        </p>
      </section>

      <section className="mt-12 text-center">
        <button
          type="button"
          onClick={() => navigate('/quiz/step1')}
          className="text-xs text-ink/40 underline"
        >
          重新测一次
        </button>
      </section>

      <p className="mt-8 text-xs text-ink/40 leading-relaxed">
        本指数为生活方式参考,不构成医疗建议。若有体检异常或长期不缓解,建议同时咨询医生 / 注册营养师。
      </p>
    </main>
  );
}
