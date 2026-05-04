/**
 * 各 Part 标准化函数 单测
 */

import {
  computeActivityPart,
  computeEnvPart,
  computeFoodPart,
  computeSymptomPart
} from '../../server/services/score/parts';
import type { SymptomCheckinPayload } from '../../server/services/symptoms';

describe('U8 parts — Food / Symptom / Env / Activity', () => {
  // ─── Food ────────────────────────────────────────────────────────────
  test('Food: 全平 → 0', () => {
    expect(computeFoodPart({ counts: { 发: 0, 温和: 0, 平: 5, unknown: 0 } })).toBe(0);
  });
  test('Food: 全发 → 100', () => {
    expect(computeFoodPart({ counts: { 发: 3, 温和: 0, 平: 0, unknown: 0 } })).toBe(100);
  });
  test('Food: 火锅 4 发 + 8 平 → ~33.3 微火', () => {
    expect(computeFoodPart({ counts: { 发: 4, 温和: 0, 平: 8, unknown: 0 } })).toBeCloseTo(33.3, 0);
  });
  test('Food: unknown 视为 0(保守)', () => {
    expect(computeFoodPart({ counts: { 发: 0, 温和: 0, 平: 0, unknown: 3 } })).toBe(0);
  });
  test('Food: 0 条目 → null', () => {
    expect(computeFoodPart({ counts: { 发: 0, 温和: 0, 平: 0, unknown: 0 } })).toBeNull();
  });

  // ─── Symptom ─────────────────────────────────────────────────────────
  test('Symptom: 鼻塞 4/4 + 口干 2/4 → (100 + 50)/2 = 75', () => {
    const p: SymptomCheckinPayload = {
      nasal_congestion: { engaged: true, severity: 4 },
      dry_mouth: { engaged: true, severity: 2 }
    };
    expect(computeSymptomPart(p)).toBe(75);
  });
  test('Symptom: engaged=true severity=null 不计入(default-effect 防御)', () => {
    const p: SymptomCheckinPayload = {
      nasal_congestion: { engaged: true, severity: null },
      dry_mouth: { engaged: true, severity: 4 }
    };
    expect(computeSymptomPart(p)).toBe(100); // 仅 dry_mouth 有效
  });
  test('Symptom: 全无 → null', () => {
    expect(computeSymptomPart({})).toBeNull();
    expect(computeSymptomPart({ acne: { engaged: false, severity: null } })).toBeNull();
  });

  // ─── Env ─────────────────────────────────────────────────────────────
  test('Env: PM2.5 优(<35) + 春季 → ((0 + 20)/2) = 10', () => {
    expect(computeEnvPart({ pm25: 20, season: 'spring' })).toBe(10);
  });
  test('Env: PM2.5 中度(116-150) → 80;含季节夏天 → (80+0)/2 = 40', () => {
    expect(computeEnvPart({ pm25: 130, season: 'summer' })).toBe(40);
  });
  test('Env: 仅 pollen=high → 90', () => {
    expect(computeEnvPart({ pollenLevel: 'high' })).toBe(90);
  });
  test('Env: null/全空 → null', () => {
    expect(computeEnvPart(null)).toBeNull();
    expect(computeEnvPart({})).toBeNull();
  });

  // ─── Activity ────────────────────────────────────────────────────────
  test('Activity: 今日 = 中位数 → 50', () => {
    expect(computeActivityPart({ todaySteps: 8000, weekMedianSteps: 8000 })).toBe(50);
  });
  test('Activity: 今日 -50% → 100', () => {
    expect(computeActivityPart({ todaySteps: 4000, weekMedianSteps: 8000 })).toBe(100);
  });
  test('Activity: 今日 +50% → 0', () => {
    expect(computeActivityPart({ todaySteps: 12000, weekMedianSteps: 8000 })).toBe(0);
  });
  test('Activity: 缺 weekMedian → null', () => {
    expect(computeActivityPart({ todaySteps: 8000 })).toBeNull();
    expect(computeActivityPart(null)).toBeNull();
  });
});
