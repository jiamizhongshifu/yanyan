/**
 * Onboarding 跨屏状态(zustand 内存,不持久化)
 *
 * 4 屏共享一份 state:
 *   - reverseFilterChoice  step1 选择
 *   - symptomsFrequency    step2 7 维度方块
 *   - initialFireLevel     step3 揭晓
 *
 * 强退后状态丢失 — v1 接受这个简化(onboarding 60 秒以内的流程,不需要持久化恢复)。
 */

import { create } from 'zustand';
import type { ReverseFilterChoice, SymptomDimension, SymptomFrequency, FireLevel } from '../services/onboarding';

export interface OnboardingState {
  reverseFilterChoice: ReverseFilterChoice | null;
  symptomsFrequency: Partial<Record<SymptomDimension, SymptomFrequency>>;
  initialFireLevel: FireLevel | null;
  setReverseFilterChoice: (c: ReverseFilterChoice) => void;
  setSymptomsFrequency: (s: Partial<Record<SymptomDimension, SymptomFrequency>>) => void;
  setInitialFireLevel: (l: FireLevel) => void;
  reset: () => void;
}

export const useOnboarding = create<OnboardingState>((set) => ({
  reverseFilterChoice: null,
  symptomsFrequency: {},
  initialFireLevel: null,
  setReverseFilterChoice: (c) => set({ reverseFilterChoice: c }),
  setSymptomsFrequency: (s) => set({ symptomsFrequency: s }),
  setInitialFireLevel: (l) => set({ initialFireLevel: l }),
  reset: () => set({ reverseFilterChoice: null, symptomsFrequency: {}, initialFireLevel: null })
}));
