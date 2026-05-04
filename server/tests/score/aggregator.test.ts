/**
 * U8 Yan-Score aggregator 单元测试
 *
 * 重点覆盖 plan U8 + Round 2 修订:
 *   - 4 Part 全可用 → 正常加权
 *   - 缺 1 Part → 按比例重分配,上限内 OK
 *   - 缺 2 Part(可用 = 2)→ 重分配 OK 或上限超 → null
 *   - 缺 3 Part(可用 = 1)→ null
 *   - level 边界 25 / 50 / 75
 */

import { aggregate } from '../../src/services/score/aggregator';
import { DEFAULT_WEIGHTS, scoreToLevel } from '../../src/services/score/types';

describe('U8 aggregator — 4 Part 加权 + 重分配', () => {
  test('4 Part 全可用,score = food*0.5 + symptom*0.3 + env*0.15 + activity*0.05', () => {
    const r = aggregate({ food: 50, symptom: 50, env: 50, activity: 50 });
    expect(r).not.toBeNull();
    expect(r!.score).toBe(50);
    expect(r!.level).toBe('中火'); // 50 → [50, 75)
    expect(r!.missingParts).toEqual([]);
    expect(r!.effectiveWeights).toEqual({ food: 0.5, symptom: 0.3, env: 0.15, activity: 0.05 });
  });

  test('4 Part 全 0 → score 0,level 平', () => {
    const r = aggregate({ food: 0, symptom: 0, env: 0, activity: 0 });
    expect(r!.score).toBe(0);
    expect(r!.level).toBe('平');
  });

  test('4 Part 全 100 → score 100,level 大火', () => {
    const r = aggregate({ food: 100, symptom: 100, env: 100, activity: 100 });
    expect(r!.score).toBe(100);
    expect(r!.level).toBe('大火');
  });

  test('缺 activity:权重重分配到 food/symptom/env,上限内 OK', () => {
    const r = aggregate({ food: 60, symptom: 50, env: 40, activity: null });
    expect(r).not.toBeNull();
    expect(r!.missingParts).toEqual(['activity']);
    // 各 Part 权重在上限内(原权重 ×2)
    expect(r!.effectiveWeights.food).toBeLessThanOrEqual(DEFAULT_WEIGHTS.food * 2);
    expect(r!.effectiveWeights.symptom).toBeLessThanOrEqual(DEFAULT_WEIGHTS.symptom * 2);
    expect(r!.effectiveWeights.env).toBeLessThanOrEqual(DEFAULT_WEIGHTS.env * 2);
    // 总和 ≈ 1
    const sum =
      r!.effectiveWeights.food + r!.effectiveWeights.symptom + r!.effectiveWeights.env + r!.effectiveWeights.activity;
    expect(sum).toBeCloseTo(1, 5);
  });

  test('缺 env + activity:可用 food + symptom,加权按比例,上限内 OK', () => {
    const r = aggregate({ food: 80, symptom: 20, env: null, activity: null });
    expect(r).not.toBeNull();
    expect(r!.missingParts).toEqual(['env', 'activity']);
    // food: 0.5/0.8 = 0.625;symptom: 0.3/0.8 = 0.375
    expect(r!.effectiveWeights.food).toBeCloseTo(0.625, 3);
    expect(r!.effectiveWeights.symptom).toBeCloseTo(0.375, 3);
    // 0.625 ≤ 1.0(food 上限),0.375 ≤ 0.6(symptom 上限),OK
    // score = 80 × 0.625 + 20 × 0.375 = 50 + 7.5 = 57.5
    expect(r!.score).toBe(57.5);
    expect(r!.level).toBe('中火');
  });

  test('缺 food + activity:可用 symptom + env,symptom 重分配后超上限 → null', () => {
    // symptom 0.3 / 0.45 = 0.667 > 0.6(上限);env 0.15 / 0.45 = 0.333 > 0.3(上限)
    const r = aggregate({ food: null, symptom: 50, env: 50, activity: null });
    expect(r).toBeNull();
  });

  test('缺 food + symptom + activity:可用只有 env(< 2)→ null', () => {
    const r = aggregate({ food: null, symptom: null, env: 50, activity: null });
    expect(r).toBeNull();
  });

  test('缺 3:可用 food only(< 2)→ null', () => {
    const r = aggregate({ food: 80, symptom: null, env: null, activity: null });
    expect(r).toBeNull();
  });

  test('全部 null → null', () => {
    expect(aggregate({ food: null, symptom: null, env: null, activity: null })).toBeNull();
  });

  test('breakdown 各 Part 实际贡献,总和 ≈ score', () => {
    const r = aggregate({ food: 100, symptom: 100, env: 100, activity: 100 });
    const sum = r!.breakdown.food + r!.breakdown.symptom + r!.breakdown.env + r!.breakdown.activity;
    // 由于 round 误差,允许 ±0.5
    expect(Math.abs(sum - r!.score)).toBeLessThanOrEqual(0.5);
  });

  test('level 边界:24.9=平 / 25=微火 / 49.9=微火 / 50=中火 / 74.9=中火 / 75=大火', () => {
    expect(scoreToLevel(24.9)).toBe('平');
    expect(scoreToLevel(25)).toBe('微火');
    expect(scoreToLevel(49.9)).toBe('微火');
    expect(scoreToLevel(50)).toBe('中火');
    expect(scoreToLevel(74.9)).toBe('中火');
    expect(scoreToLevel(75)).toBe('大火');
  });
});
