/**
 * Camera → MealResult 之间通过 zustand 传 result(避免在 URL 里塞大对象)
 */

import { create } from 'zustand';
import type { MealResult } from '../services/meals';

interface LastMealState {
  result: MealResult | null;
  set: (r: MealResult | null) => void;
}

export const useLastMeal = create<LastMealState>((set) => ({
  result: null,
  set: (r) => set({ result: r })
}));
