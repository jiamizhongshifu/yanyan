/**
 * 次晨打卡跨屏 state — Step 1 → Step 2 → Step 3
 *
 * Step 1 写入 payload + 调 POST → 成功后 navigate Step 2(此时 server 已落库)
 * Step 2 拉昨日对照(yesterdayCompare)+ 拉 yan-score(展示挂在 reveal stage)
 * Step 3 显示 yan-score
 */

import { create } from 'zustand';
import type { SymptomCheckinPayload, SymptomDimension, YanScoreToday, YesterdayCompare } from '../services/symptoms';

interface CheckinState {
  payload: SymptomCheckinPayload;
  yesterday: YesterdayCompare | null;
  yanScore: YanScoreToday | null;
  toggle: (dim: SymptomDimension) => void;
  setSeverity: (dim: SymptomDimension, severity: number) => void;
  reset: () => void;
  setYesterday: (y: YesterdayCompare | null) => void;
  setYanScore: (s: YanScoreToday | null) => void;
}

export const useCheckin = create<CheckinState>((set) => ({
  payload: {},
  yesterday: null,
  yanScore: null,
  toggle: (dim) =>
    set((s) => {
      const cur = s.payload[dim];
      const nextEntry = cur?.engaged
        ? { engaged: false, severity: null }
        : { engaged: true, severity: null };
      return { payload: { ...s.payload, [dim]: nextEntry } };
    }),
  setSeverity: (dim, severity) =>
    set((s) => {
      const cur = s.payload[dim] ?? { engaged: true, severity: null };
      return { payload: { ...s.payload, [dim]: { ...cur, engaged: true, severity } } };
    }),
  reset: () => set({ payload: {}, yesterday: null, yanScore: null }),
  setYesterday: (y) => set({ yesterday: y }),
  setYanScore: (s) => set({ yanScore: s })
}));
