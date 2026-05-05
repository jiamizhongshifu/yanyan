/**
 * U10 主屏 + 4 tab + Findings + Me 测试
 *
 * 重点覆盖:
 *   - TodayFireCard 三态:hasCheckin=false / result=null / 完整 result
 *   - 累计 < 21 天 → 显示"数据累积中"
 *   - 累计 >= 21 天 → "本周趋势"信号
 *   - MealHistoryList:0 餐 → CTA 拍照;N 餐 → 时间 + 火分徽章
 *   - Findings 进度卡:Day X/30 + 进度条宽度
 *   - BottomTabs:active 状态切换
 */

import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { Router } from 'wouter';
import { memoryLocation } from 'wouter/memory-location';
import { Home } from '../pages/Home';
import { Findings } from '../pages/Findings';
import { Me } from '../pages/Me';
import { TodayFireCard } from '../components/TodayFireCard';
import { MealHistoryList } from '../components/MealHistoryList';
import { BottomTabs } from '../components/BottomTabs';

// Mock supabase auth
const supabaseMockState = { session: { access_token: 'jwt', user: { id: 'u1' } } };
vi.mock('../services/supabase', () => ({
  getSupabase: () => ({
    auth: {
      getSession: vi.fn(async () => ({ data: { session: supabaseMockState.session } })),
      onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
      signOut: vi.fn()
    }
  }),
  resetSupabaseForTesting: vi.fn()
}));

// Mock services 跳网络层
const fetchYanScoreMock = vi.fn();
vi.mock('../services/symptoms', async () => {
  const actual = await vi.importActual<typeof import('../services/symptoms')>('../services/symptoms');
  return { ...actual, fetchYanScoreToday: () => fetchYanScoreMock() };
});

const fetchHomeTodayMock = vi.fn();
const fetchProgressMock = vi.fn();
vi.mock('../services/home', () => ({
  fetchHomeToday: () => fetchHomeTodayMock(),
  fetchProgress: () => fetchProgressMock()
}));

beforeEach(() => {
  fetchYanScoreMock.mockReset();
  fetchHomeTodayMock.mockReset();
  fetchProgressMock.mockReset();
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ─── TodayFireCard pure rendering ──────────────────────────────────────

describe('U10 TodayFireCard', () => {
  test('null yanScore → 加载中', () => {
    render(<TodayFireCard yanScore={null} canDrawTrend={false} cumulativeDays={0} />);
    expect(screen.getByText(/加载中/)).toBeInTheDocument();
  });

  test('AE3:hasCheckin=false → "等待打卡" + 提示文案', () => {
    render(
      <TodayFireCard
        yanScore={{ hasCheckin: false, result: null, partScores: { food: null, symptom: null, env: null, activity: null } }}
        canDrawTrend={false}
        cumulativeDays={0}
      />
    );
    expect(screen.getByTestId('card-state')).toHaveTextContent('等待打卡');
    expect(screen.getByText(/明早打卡后揭晓/)).toBeInTheDocument();
  });

  test('result=null insufficient_parts → "数据还不够"', () => {
    render(
      <TodayFireCard
        yanScore={{
          hasCheckin: true,
          result: null,
          partScores: { food: null, symptom: 50, env: null, activity: null },
          unavailableReason: 'insufficient_parts'
        }}
        canDrawTrend={false}
        cumulativeDays={3}
      />
    );
    expect(screen.getByTestId('card-state')).toHaveTextContent('数据还不够');
  });

  test('完整 result + canDrawTrend=false → 显示等级 + 数据累积中', () => {
    render(
      <TodayFireCard
        yanScore={{
          hasCheckin: true,
          result: {
            score: 58.5,
            level: '中火',
            breakdown: { food: 35, symptom: 15, env: 6, activity: 2.5 },
            effectiveWeights: { food: 0.5, symptom: 0.3, env: 0.15, activity: 0.05 },
            missingParts: [],
            partScores: { food: 70, symptom: 50, env: 40, activity: 50 }
          },
          partScores: { food: 70, symptom: 50, env: 40, activity: 50 }
        }}
        canDrawTrend={false}
        cumulativeDays={5}
      />
    );
    expect(screen.getByTestId('card-level')).toHaveTextContent('中火');
    expect(screen.getByTestId('card-score')).toHaveTextContent('58.5');
    expect(screen.getByTestId('card-trend-pending')).toHaveTextContent(/累计 5\/21 天/);
  });

  test('完整 result + canDrawTrend=true(累计 25 天)→ 显示本周趋势', () => {
    render(
      <TodayFireCard
        yanScore={{
          hasCheckin: true,
          result: {
            score: 30,
            level: '微火',
            breakdown: { food: 15, symptom: 9, env: 4.5, activity: 1.5 },
            effectiveWeights: { food: 0.5, symptom: 0.3, env: 0.15, activity: 0.05 },
            missingParts: [],
            partScores: { food: 30, symptom: 30, env: 30, activity: 30 }
          },
          partScores: { food: 30, symptom: 30, env: 30, activity: 30 }
        }}
        canDrawTrend={true}
        cumulativeDays={25}
      />
    );
    expect(screen.getByTestId('card-trend')).toHaveTextContent(/累计 25 天/);
    expect(screen.queryByTestId('card-trend-pending')).toBeNull();
  });
});

// ─── MealHistoryList ──────────────────────────────────────────────────

describe('U10 MealHistoryList', () => {
  test('0 餐 → 显示拍这一餐 CTA', () => {
    render(
      <Router hook={memoryLocation({ path: '/app' }).hook}>
        <MealHistoryList meals={[]} />
      </Router>
    );
    expect(screen.getByText(/还没拍今天的第一餐/)).toBeInTheDocument();
    expect(screen.getByText('拍这一餐')).toBeInTheDocument();
  });

  test('N 餐 → 时间 + 火分徽章 + tcm 计数', () => {
    render(
      <Router hook={memoryLocation({ path: '/app' }).hook}>
        <MealHistoryList
          meals={[
            {
              id: 'meal-a',
              ateAt: '2026-05-04T05:30:00Z',
              photoOssKey: null,
              fireScore: 22,
              level: '平',
              tcmLabelsSummary: { 发: 0, 温和: 1, 平: 2, unknown: 0 }
            },
            {
              id: 'meal-b',
              ateAt: '2026-05-04T11:30:00Z',
              photoOssKey: null,
              fireScore: 60,
              level: '中火',
              tcmLabelsSummary: { 发: 2, 温和: 1, 平: 0, unknown: 0 }
            }
          ]}
        />
      </Router>
    );
    expect(screen.getByText('今日餐食 · 2 餐')).toBeInTheDocument();
    expect(screen.getByTestId('meal-row-meal-a')).toHaveTextContent('平');
    expect(screen.getByTestId('meal-row-meal-b')).toHaveTextContent('中火 60');
  });
});

// ─── Findings 进度卡 ───────────────────────────────────────────────────

describe('U10 Findings tab', () => {
  test('Day 5/30 占位', async () => {
    fetchProgressMock.mockResolvedValueOnce({
      cumulativeCheckinDays: 5,
      thresholds: { trendLineDays: 21, profilePdfDay: 30 },
      flags: { canDrawTrend: false, eligibleForProfilePdf: false }
    });
    render(<Findings />);
    expect(await screen.findByTestId('day-progress')).toHaveTextContent('Day 5 / 30');
    expect(screen.getByTestId('progress-bar')).toHaveStyle({ width: `${(5 / 30) * 100}%` });
    expect(screen.getByText(/未到 14 天/)).toBeInTheDocument();
  });

  test('Day 30 → eligibleForProfilePdf', async () => {
    fetchProgressMock.mockResolvedValueOnce({
      cumulativeCheckinDays: 30,
      thresholds: { trendLineDays: 21, profilePdfDay: 30 },
      flags: { canDrawTrend: true, eligibleForProfilePdf: true }
    });
    render(<Findings />);
    expect(await screen.findByText(/体质档案 v0\.5/)).toBeInTheDocument();
  });
});

// ─── Home 主屏并行加载 ────────────────────────────────────────────────

describe('U10 Home 主屏', () => {
  test('并行加载 yan-score / meals / progress → 渲染 3 块', async () => {
    fetchYanScoreMock.mockResolvedValueOnce({
      hasCheckin: true,
      result: {
        score: 22,
        level: '平',
        breakdown: { food: 11, symptom: 6, env: 3.3, activity: 1.1 },
        effectiveWeights: { food: 0.5, symptom: 0.3, env: 0.15, activity: 0.05 },
        missingParts: [],
        partScores: { food: 20, symptom: 30, env: 20, activity: 20 }
      },
      partScores: { food: 20, symptom: 30, env: 20, activity: 20 }
    });
    fetchHomeTodayMock.mockResolvedValueOnce({
      date: '2026-05-04',
      meals: [
        {
          id: 'meal-a',
          ateAt: '2026-05-04T05:00:00Z',
          photoOssKey: null,
          fireScore: 22,
          level: '平',
          tcmLabelsSummary: { 发: 0, 温和: 0, 平: 1, unknown: 0 }
        }
      ]
    });
    fetchProgressMock.mockResolvedValueOnce({
      cumulativeCheckinDays: 5,
      thresholds: { trendLineDays: 21, profilePdfDay: 30 },
      flags: { canDrawTrend: false, eligibleForProfilePdf: false }
    });

    render(
      <Router hook={memoryLocation({ path: '/app' }).hook}>
        <Home />
      </Router>
    );

    await waitFor(() => expect(screen.getByTestId('dial-level')).toHaveTextContent('平'));
    expect(screen.getByText('今日餐食 · 1 餐')).toBeInTheDocument();
    expect(screen.getByText(/累计 5\/21/)).toBeInTheDocument();
  });

  test('AE3 路径:hasCheckin=false → 主屏显示等待打卡', async () => {
    fetchYanScoreMock.mockResolvedValueOnce({
      hasCheckin: false,
      result: null,
      partScores: { food: null, symptom: null, env: null, activity: null }
    });
    fetchHomeTodayMock.mockResolvedValueOnce({ date: '2026-05-04', meals: [] });
    fetchProgressMock.mockResolvedValueOnce({
      cumulativeCheckinDays: 0,
      thresholds: { trendLineDays: 21, profilePdfDay: 30 },
      flags: { canDrawTrend: false, eligibleForProfilePdf: false }
    });
    render(
      <Router hook={memoryLocation({ path: '/app' }).hook}>
        <Home />
      </Router>
    );
    // hasCheckin=false + 无 quiz + 无 initialFireLevel → dial 退化到"做一次评估"占位
    await waitFor(() => expect(screen.getByText(/做一次评估/)).toBeInTheDocument());
    expect(screen.getByText(/还没拍今天的第一餐/)).toBeInTheDocument();
  });
});

// ─── BottomTabs ────────────────────────────────────────────────────────

describe('BottomTabs (3 tab IA)', () => {
  test('/app 路径 → today tab active', () => {
    render(
      <Router hook={memoryLocation({ path: '/app' }).hook}>
        <BottomTabs />
      </Router>
    );
    expect(screen.getByTestId('tab-today')).toHaveAttribute('aria-current', 'page');
    expect(screen.getByTestId('tab-body')).not.toHaveAttribute('aria-current');
  });

  test('/app/body 路径 → body tab active', () => {
    render(
      <Router hook={memoryLocation({ path: '/app/body' }).hook}>
        <BottomTabs />
      </Router>
    );
    expect(screen.getByTestId('tab-body')).toHaveAttribute('aria-current', 'page');
    expect(screen.getByTestId('tab-today')).not.toHaveAttribute('aria-current');
  });

  test('点 insights tab 不抛错', () => {
    render(
      <Router hook={memoryLocation({ path: '/app' }).hook}>
        <BottomTabs />
      </Router>
    );
    fireEvent.click(screen.getByTestId('tab-insights'));
  });
});

// ─── Me 页 ─────────────────────────────────────────────────────────────

describe('U10 Me 页', () => {
  test('登出按钮存在 + 撤回按钮存在', () => {
    render(
      <Router hook={memoryLocation({ path: '/me' }).hook}>
        <Me />
      </Router>
    );
    expect(screen.getByTestId('btn-signout')).toBeInTheDocument();
    expect(screen.getByTestId('btn-revoke')).toBeInTheDocument();
  });
});
