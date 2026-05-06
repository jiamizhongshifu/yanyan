/**
 * U13a TodaySuggestionCard 渲染测试
 */

import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { TodaySuggestionCard } from '../components/TodaySuggestionCard';
import type { TodayRecommendation } from '../services/recommend';

vi.mock('../services/recommend', async () => {
  const actual = await vi.importActual<typeof import('../services/recommend')>('../services/recommend');
  return {
    ...actual,
    fetchTodayRecommendation: vi.fn()
  };
});

import { fetchTodayRecommendation } from '../services/recommend';

const FA_HEAVY: TodayRecommendation = {
  mode: 'fa_heavy',
  headline: '近 3 天偏热,先收一收',
  tagline: '下面是常见的发物,可以先避开 1-2 项;同时给你 3 餐平和组合作参考。',
  avoid: [
    { name: '辣椒', citations: [{ source: 'canon', reference: '《本草纲目》' }] },
    { name: '虾', citations: [] }
  ],
  meals: [
    { slot: 'breakfast', items: ['白米粥', '南瓜'], citations: [{ source: 'modern_nutrition', reference: 'USDA FoodData Central' }] },
    { slot: 'lunch', items: ['山药', '鸡肉'], citations: [] },
    { slot: 'dinner', items: ['豆腐', '小米粥'], citations: [] }
  ],
  basis: { fa: 11, mild: 2, calm: 1, days: 3 }
};

const INSUFFICIENT: TodayRecommendation = {
  mode: 'insufficient_data',
  headline: '今天先吃得平稳一些',
  tagline: '资料还不够个性化…',
  avoid: [],
  meals: [
    { slot: 'breakfast', items: ['白米粥'], citations: [] },
    { slot: 'lunch', items: ['山药'], citations: [] },
    { slot: 'dinner', items: ['豆腐'], citations: [] }
  ],
  basis: { fa: 0, mild: 0, calm: 0, days: 0 }
};

describe('U13a TodaySuggestionCard', () => {
  beforeEach(() => {
    vi.mocked(fetchTodayRecommendation).mockReset();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  test('fa_heavy 渲染 avoid 列表 + 3 餐 + 引用', async () => {
    vi.mocked(fetchTodayRecommendation).mockResolvedValue(FA_HEAVY);
    render(<TodaySuggestionCard />);
    await waitFor(() => expect(screen.getByTestId('suggestion-card')).toBeInTheDocument());
    expect(screen.getByTestId('suggestion-headline').textContent).toContain('偏热');
    expect(screen.getByTestId('suggestion-avoid')).toBeInTheDocument();
    expect(screen.getByText('辣椒')).toBeInTheDocument();
    expect(screen.getByText('虾')).toBeInTheDocument();
    expect(screen.getByTestId('suggestion-meals')).toBeInTheDocument();
    expect(screen.getByText(/白米粥/)).toBeInTheDocument();
    // 推荐卡只渲染 modern_nutrition / paper 来源,canon 典籍隐藏
    expect(screen.getByText(/USDA FoodData Central/)).toBeInTheDocument();
  });

  test('insufficient_data:无 avoid 区块,只渲染 3 餐 + 通用文案', async () => {
    vi.mocked(fetchTodayRecommendation).mockResolvedValue(INSUFFICIENT);
    render(<TodaySuggestionCard />);
    await waitFor(() => expect(screen.getByTestId('suggestion-card')).toBeInTheDocument());
    expect(screen.queryByTestId('suggestion-avoid')).not.toBeInTheDocument();
    expect(screen.getByTestId('suggestion-meals')).toBeInTheDocument();
    expect(screen.getByText(/平稳/)).toBeInTheDocument();
  });

  test('fetch 失败 → 不渲染卡片', async () => {
    vi.mocked(fetchTodayRecommendation).mockResolvedValue(null);
    const { container } = render(<TodaySuggestionCard />);
    await waitFor(() => expect(screen.queryByTestId('suggestion-loading')).not.toBeInTheDocument());
    expect(container.querySelector('[data-testid="suggestion-card"]')).toBeNull();
  });
});
