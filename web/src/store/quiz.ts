/**
 * 公开 Quiz 状态(localStorage 持久化,匿名)
 *
 * 与 onboarding store 的区别:
 *   - onboarding 在登录后,内存状态 + 提交即写 server
 *   - quiz 在登录前,匿名 localStorage,登录后可作为 prefill 上溯到 onboarding
 *
 * 持久化原因:用户答完 quiz 看到指数后,大概率不会立刻登录(看完关掉再回来),
 * 我们要让二次进入时不丢失数据 + 登录后能 prefill onboarding。
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { ReverseFilterChoice, SymptomDimension, SymptomFrequency } from '../services/onboarding';
import type { RecentDiet, SleepPattern } from '../services/quiz';

export interface QuizState {
  reverseFilterChoice: ReverseFilterChoice | null;
  symptomsFrequency: Partial<Record<SymptomDimension, SymptomFrequency>>;
  recentDiet: RecentDiet | null;
  sleepPattern: SleepPattern | null;
  /** 完成时间(ISO),空 = 未完成 */
  completedAt: string | null;

  setReverseFilterChoice: (c: ReverseFilterChoice) => void;
  setSymptomsFrequency: (s: Partial<Record<SymptomDimension, SymptomFrequency>>) => void;
  setRecentDiet: (d: RecentDiet) => void;
  setSleepPattern: (s: SleepPattern) => void;
  markCompleted: () => void;
  reset: () => void;
}

const STORE_KEY = 'yanyan.quiz.v1';

export const useQuiz = create<QuizState>()(
  persist(
    (set) => ({
      reverseFilterChoice: null,
      symptomsFrequency: {},
      recentDiet: null,
      sleepPattern: null,
      completedAt: null,

      setReverseFilterChoice: (c) => set({ reverseFilterChoice: c }),
      setSymptomsFrequency: (s) => set({ symptomsFrequency: s }),
      setRecentDiet: (d) => set({ recentDiet: d }),
      setSleepPattern: (s) => set({ sleepPattern: s }),
      markCompleted: () => set({ completedAt: new Date().toISOString() }),
      reset: () =>
        set({
          reverseFilterChoice: null,
          symptomsFrequency: {},
          recentDiet: null,
          sleepPattern: null,
          completedAt: null
        })
    }),
    { name: STORE_KEY }
  )
);
