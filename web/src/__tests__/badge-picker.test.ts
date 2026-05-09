/**
 * badgePicker 单测
 *   - 同日期 + 同 tier → 同 shape(确定性)
 *   - 不同日期 → 至少出现 2 个不同 shape(覆盖池子变化)
 *   - shape 一定属于声明的 tier 池
 */

import { describe, test, expect } from 'vitest';
import { pickShape, tierOfShape, POOL } from '../services/badgePicker';

describe('pickShape', () => {
  test('确定性:同日期同 tier 多次调用结果相同', () => {
    const a = pickShape('2026-05-08', 'great');
    const b = pickShape('2026-05-08', 'great');
    expect(a).toBe(b);
  });

  test('跨天有变化:连续 7 天采样至少出现 2 个不同 shape', () => {
    const shapes = new Set<string>();
    for (let d = 1; d <= 7; d++) {
      const date = `2026-05-${String(d).padStart(2, '0')}`;
      shapes.add(pickShape(date, 'great'));
    }
    expect(shapes.size).toBeGreaterThanOrEqual(2);
  });

  test('挑出来的 shape 一定在该 tier 的池子里', () => {
    const dates = ['2026-01-15', '2026-04-23', '2026-09-30', '2026-12-01'];
    for (const date of dates) {
      for (const tier of ['nice', 'great', 'perfect'] as const) {
        const shape = pickShape(date, tier);
        expect(POOL[tier]).toContain(shape);
      }
    }
  });
});

describe('tierOfShape', () => {
  test('反向映射 shape → tier 正确', () => {
    expect(tierOfShape('candy')).toBe('nice');
    expect(tierOfShape('lollipop')).toBe('nice');
    expect(tierOfShape('soda')).toBe('great');
    expect(tierOfShape('chocolate')).toBe('great');
    expect(tierOfShape('cake')).toBe('perfect');
    expect(tierOfShape('sushi')).toBe('perfect');
    expect(tierOfShape('pizza')).toBe('perfect');
  });
});
