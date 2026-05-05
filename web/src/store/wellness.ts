/**
 * 每日 wellness 状态 — 喝水 / 步数 手动录入
 *
 * 存储:zustand persist localStorage,按 `YYYY-MM-DD` 键索引到 dailyMap。
 * 不强制持久到 server(用户可能换设备 → 这部分数据接 Apple Health 后再迁)。
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface DayEntry {
  waterCups: number; // 8 杯目标
  steps: number;
}

interface WellnessState {
  /** key = YYYY-MM-DD */
  dailyMap: Record<string, DayEntry>;
  addWaterCup: (date: string) => void;
  removeWaterCup: (date: string) => void;
  setSteps: (date: string, steps: number) => void;
  getDay: (date: string) => DayEntry;
}

const empty: DayEntry = { waterCups: 0, steps: 0 };

export const useWellness = create<WellnessState>()(
  persist(
    (set, get) => ({
      dailyMap: {},
      addWaterCup: (date) =>
        set((s) => {
          const d = s.dailyMap[date] ?? empty;
          return { dailyMap: { ...s.dailyMap, [date]: { ...d, waterCups: Math.min(12, d.waterCups + 1) } } };
        }),
      removeWaterCup: (date) =>
        set((s) => {
          const d = s.dailyMap[date] ?? empty;
          return { dailyMap: { ...s.dailyMap, [date]: { ...d, waterCups: Math.max(0, d.waterCups - 1) } } };
        }),
      setSteps: (date, steps) =>
        set((s) => {
          const d = s.dailyMap[date] ?? empty;
          return { dailyMap: { ...s.dailyMap, [date]: { ...d, steps: Math.max(0, Math.round(steps)) } } };
        }),
      getDay: (date) => get().dailyMap[date] ?? empty
    }),
    { name: 'yanyan.wellness.v1' }
  )
);

export function todayKey(now = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}
