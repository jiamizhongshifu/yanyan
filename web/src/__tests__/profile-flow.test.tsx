/**
 * U13b ProfilePdf 页面渲染测试
 */

import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { ProfilePdf } from '../pages/ProfilePdf';
import type { ProfileV05Data } from '../services/profile';

vi.mock('../services/profile', async () => {
  const actual = await vi.importActual<typeof import('../services/profile')>('../services/profile');
  return { ...actual, fetchProfileV05: vi.fn() };
});

import { fetchProfileV05 } from '../services/profile';

const SAMPLE: ProfileV05Data = {
  cumulativeCheckinDays: 30,
  title: '30 天体质档案 v0.5',
  generatedAt: '2026-05-04T03:00:00Z',
  dailyTrend: Array.from({ length: 30 }, (_, i) => {
    const d = new Date('2026-04-05T00:00:00Z');
    d.setUTCDate(d.getUTCDate() + i);
    return {
      date: d.toISOString().slice(0, 10),
      avgFireScore: i % 3 === 0 ? 50 : null,
      mealCount: i % 3 === 0 ? 1 : 0
    };
  }),
  faCounts: { faTotal: 12, mildTotal: 8, calmTotal: 5, unknownTotal: 0 },
  commonFaFoods: [
    { name: '鲈鱼', citations: [{ source: 'canon', reference: '《本草纲目》' }] },
    { name: '辣椒', citations: [] }
  ],
  checkupSummary: null,
  disclaimers: ['本档案为 v0.5 群体先验版', '本档案仅作生活方式参考,不构成医疗建议']
};

describe('U13b ProfilePdf', () => {
  beforeEach(() => {
    vi.mocked(fetchProfileV05).mockReset();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  test('not_eligible:显示进度卡 Day X / 30,还差 Y 天', async () => {
    vi.mocked(fetchProfileV05).mockResolvedValue({
      kind: 'not_eligible',
      cumulativeCheckinDays: 12,
      required: 30
    });
    render(<ProfilePdf />);
    await waitFor(() => expect(screen.getByTestId('profile-not-eligible')).toBeInTheDocument());
    expect(screen.getByText(/Day 12 \/ 30/)).toBeInTheDocument();
    expect(screen.getByText(/还差 18 天/)).toBeInTheDocument();
  });

  test('ok 渲染:title + 趋势 + 群体发物 + 免责声明 + 打印按钮', async () => {
    vi.mocked(fetchProfileV05).mockResolvedValue({ kind: 'ok', data: SAMPLE });
    render(<ProfilePdf />);
    await waitFor(() => expect(screen.getByTestId('profile-eligible')).toBeInTheDocument());
    expect(screen.getByText('30 天体质档案 v0.5')).toBeInTheDocument();
    expect(screen.getByTestId('trend-section')).toBeInTheDocument();
    expect(screen.getByText(/发 12/)).toBeInTheDocument();
    expect(screen.getByText('鲈鱼')).toBeInTheDocument();
    expect(screen.getByText('辣椒')).toBeInTheDocument();
    expect(screen.getByTestId('disclaimers-section')).toBeInTheDocument();
    expect(screen.getByTestId('btn-print')).toBeInTheDocument();
  });

  test('error 状态显示错误文案', async () => {
    vi.mocked(fetchProfileV05).mockResolvedValue({ kind: 'error', message: '加载失败' });
    render(<ProfilePdf />);
    await waitFor(() => expect(screen.getByTestId('profile-error')).toBeInTheDocument());
    expect(screen.getByText('加载失败')).toBeInTheDocument();
  });

  test('点击打印按钮调用 window.print()', async () => {
    const printSpy = vi.fn();
    vi.stubGlobal('print', printSpy);
    vi.mocked(fetchProfileV05).mockResolvedValue({ kind: 'ok', data: SAMPLE });
    render(<ProfilePdf />);
    await waitFor(() => expect(screen.getByTestId('btn-print')).toBeInTheDocument());
    screen.getByTestId('btn-print').click();
    expect(printSpy).toHaveBeenCalled();
    vi.unstubAllGlobals();
  });
});
