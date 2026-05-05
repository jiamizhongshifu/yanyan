/**
 * 公开 Quiz Result — 炎症指数 + 等级 + 建议 + 锁定功能预览 + 登录 CTA
 *
 * 漏斗底部:用户看到自己的初步指数后,展示登录后能解锁什么(拍照炎症分 / 30 天档案 / 个体易诱炎食物清单)
 */

import { useEffect, useMemo } from 'react';
import { useLocation } from 'wouter';
import { computeInflammationIndex, LEVEL_HINT, type InflammationIndex } from '../../services/quiz';
import { useQuiz } from '../../store/quiz';
import { asset } from '../../services/assets';
import type { FireLevel } from '../../services/onboarding';

const LEVEL_COLOR: Record<FireLevel, string> = {
  平: 'text-fire-ping',
  微火: 'text-fire-mild',
  中火: 'text-fire-mid',
  大火: 'text-fire-high'
};

/** 每档对应的独立插图(白底,可作 icon)— Supabase app-assets bucket */
const LEVEL_ICON_FILE: Record<FireLevel, string> = {
  平: 'level-ping.png',
  微火: 'level-weihuo.png',
  中火: 'level-zhonghuo.png',
  大火: 'level-dahuo.png'
};

const UNLOCKED_FEATURES = [
  {
    title: '每餐拍照即时火分',
    body: 'AI 识别食物 + 当餐火分,饭桌上 5 秒决定是不是现在该停。'
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
    body: '完整 30 天炎症指数趋势 + 个体易诱炎食物 + 体检对照(若上传)+ 引用,可下载 / 分享。'
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
      <header className="text-xs text-ink/40 tracking-widest">炎炎消防队 · 初步评估</header>

      {/* hero — 水豚捧仪表盘 */}
      <div className="mt-4 -mx-2 rounded-3xl overflow-hidden">
        <img
          src={asset('quiz-result-hero.png')}
          alt=""
          className="w-full h-auto block"
          loading="eager"
        />
      </div>

      <section className="mt-3 rounded-3xl bg-white px-6 py-7 text-center">
        <div className="flex items-center justify-center gap-3">
          <img
            src={asset(LEVEL_ICON_FILE[index.level])}
            alt={`等级:${index.level}`}
            className="w-16 h-16 object-contain"
            data-testid="level-illustration"
          />
          <p className={`text-7xl font-light ${LEVEL_COLOR[index.level]}`} data-testid="result-score">
            {index.score}
          </p>
        </div>
        <p className={`mt-2 text-2xl ${LEVEL_COLOR[index.level]}`} data-testid="result-level">
          {index.level}
        </p>
        <p className="mt-1 text-xs text-ink/40">你当前的炎症指数 · 基于 {Math.round(index.completeness * 100)}% 数据完整度</p>
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
        <p className="text-xs text-ink/50 mb-3 px-2">炎症指数 4 档分级参考</p>
        <img
          src={asset('level-scale.png')}
          alt="平 / 微火 / 中火 / 大火 4 档对照"
          className="w-full rounded-xl"
          loading="lazy"
        />
      </section>

      <section className="mt-8">
        <h2 className="text-base font-medium text-ink mb-4">登录后解锁这些</h2>
        <div className="space-y-3">
          {UNLOCKED_FEATURES.map((f, i) => (
            <div key={i} className="rounded-2xl bg-white px-5 py-4 relative">
              <div className="absolute top-4 right-4 text-xs text-ink/30">🔒</div>
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
