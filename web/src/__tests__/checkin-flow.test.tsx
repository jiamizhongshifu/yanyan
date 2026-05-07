/**
 * U7 次晨打卡 3 屏 + SymptomSlider 测试
 *
 * 重点覆盖:
 *   R12: Step 1 不展示昨日
 *   R11 + Round 2 修订: 滑块**无默认值**(severity=null,需用户主动选)
 *   Step 1 提交 → POST /symptoms/checkin
 *   Step 2 拉昨日对照(hasYesterday=true / false 两路)
 *   R14: Step 3 在 Step 2 后揭晓 + R18 点击展开 breakdown
 *   AE3 路径:hasCheckin=false 时显示"先去打卡"
 */

import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { Step1Blind } from '../pages/MorningCheckin/Step1Blind';
import { Step2Compare } from '../pages/MorningCheckin/Step2Compare';
import { Step3Reveal } from '../pages/MorningCheckin/Step3Reveal';
import { useCheckin } from '../store/checkin';

const navigateMock = vi.fn();
vi.mock('wouter', async () => {
  const actual = await vi.importActual<typeof import('wouter')>('wouter');
  return { ...actual, useLocation: () => ['/', navigateMock] };
});

// services/symptoms 整体 mock — 解耦网络
const postCheckinMock = vi.fn();
const fetchYesterdayMock = vi.fn();
const fetchYanScoreMock = vi.fn();
vi.mock('../services/symptoms', async () => {
  const actual = await vi.importActual<typeof import('../services/symptoms')>('../services/symptoms');
  return {
    ...actual,
    postCheckin: (...args: unknown[]) => postCheckinMock(...args),
    fetchYesterdayCompare: (...args: unknown[]) => fetchYesterdayMock(...args),
    fetchYanScoreToday: (...args: unknown[]) => fetchYanScoreMock(...args)
  };
});

beforeEach(() => {
  navigateMock.mockReset();
  postCheckinMock.mockReset();
  postCheckinMock.mockResolvedValue(true);
  fetchYesterdayMock.mockReset();
  fetchYanScoreMock.mockReset();
  // 默认无打卡 — Step1Blind useEffect 会调 fetchYanScoreToday 检查 hasCheckin
  fetchYanScoreMock.mockResolvedValue(null);
  useCheckin.getState().reset();
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ─── Step 1 ────────────────────────────────────────────────────────────

describe('U7 Step 1 盲打卡', () => {
  test('R12: 没有调 fetchYesterdayCompare(严格不读昨日)', () => {
    render(<Step1Blind />);
    expect(fetchYesterdayMock).not.toHaveBeenCalled();
  });

  test('R11: 默认所有维度 engaged=false,无滑块显示', () => {
    render(<Step1Blind />);
    // 7 个 engage checkbox 都未勾选
    expect(screen.getByTestId('engage-nasal_congestion')).not.toBeChecked();
    // 鼻塞 4 档按钮初始不应渲染
    expect(screen.queryByTestId('level-nasal_congestion-1')).toBeNull();
  });

  test('Round 2 修订: 勾选后滑块出现,severity 默认 null,UI 提示"请选一个程度"', () => {
    render(<Step1Blind />);
    fireEvent.click(screen.getByTestId('engage-nasal_congestion'));
    // 鼻塞 4 档按钮全部出现
    expect(screen.getByTestId('level-nasal_congestion-1')).toBeInTheDocument();
    expect(screen.getByTestId('level-nasal_congestion-4')).toBeInTheDocument();
    // 提示文案
    expect(screen.getByText(/请选一个程度/)).toBeInTheDocument();
    // store 中 severity 应是 null
    expect(useCheckin.getState().payload.nasal_congestion).toEqual({ engaged: true, severity: null });
  });

  test('点档位 → severity 写入 store + UI 上"请选一个程度"消失', () => {
    render(<Step1Blind />);
    fireEvent.click(screen.getByTestId('engage-nasal_congestion'));
    fireEvent.click(screen.getByTestId('level-nasal_congestion-3'));
    expect(useCheckin.getState().payload.nasal_congestion).toEqual({ engaged: true, severity: 3 });
    expect(screen.queryByText(/请选一个程度/)).toBeNull();
  });

  test('再次点同一档可撤销 engaged?  (toggle 行为) — 二次勾消除', () => {
    render(<Step1Blind />);
    fireEvent.click(screen.getByTestId('engage-nasal_congestion'));
    fireEvent.click(screen.getByTestId('engage-nasal_congestion'));
    expect(useCheckin.getState().payload.nasal_congestion?.engaged).toBe(false);
  });

  test('Happy 提交 → postCheckin → navigate /check-in/step2', async () => {
    render(<Step1Blind />);
    fireEvent.click(screen.getByTestId('engage-nasal_congestion'));
    fireEvent.click(screen.getByTestId('level-nasal_congestion-2'));
    fireEvent.click(screen.getByText('提交并查看对照'));

    await waitFor(() => expect(navigateMock).toHaveBeenCalledWith('/check-in/step2'));
    expect(postCheckinMock).toHaveBeenCalledTimes(1);
    expect(postCheckinMock.mock.calls[0][0]).toMatchObject({
      nasal_congestion: { engaged: true, severity: 2 }
    });
  });

  test('提交失败 → errorMessage,不 navigate', async () => {
    postCheckinMock.mockResolvedValueOnce(false);
    render(<Step1Blind />);
    fireEvent.click(screen.getByText('提交并查看对照'));
    expect(await screen.findByRole('alert')).toHaveTextContent(/提交失败/);
    expect(navigateMock).not.toHaveBeenCalled();
  });
});

// ─── Step 2 ────────────────────────────────────────────────────────────

describe('U7 Step 2 对照', () => {
  test('Day 1 用户(hasYesterday=false)→ 显示"今天是第一次"', async () => {
    fetchYesterdayMock.mockResolvedValueOnce({ hasYesterday: false });
    render(<Step2Compare />);
    expect(await screen.findByText(/今天是第一次/)).toBeInTheDocument();
  });

  test('有昨日数据 → 渲染对照行(昨天 vs 今早)', async () => {
    // 今早打卡:口干 1
    useCheckin.getState().setSeverity('dry_mouth', 1);
    fetchYesterdayMock.mockResolvedValueOnce({
      hasYesterday: true,
      recordedForDate: '2026-05-03',
      payload: {
        nasal_congestion: { engaged: true, severity: 2 },
        dry_mouth: { engaged: true, severity: 4 },
        acne: { engaged: false, severity: null }
      }
    });
    render(<Step2Compare />);
    // 等待渲染
    await waitFor(() => expect(screen.getByTestId('compare-nasal_congestion')).toBeInTheDocument());
    expect(screen.getByTestId('compare-nasal_congestion')).toHaveTextContent(/昨天:一鼻塞/);
    expect(screen.getByTestId('compare-nasal_congestion')).toHaveTextContent(/今早:无/); // 今早未勾
    expect(screen.getByTestId('compare-dry_mouth')).toHaveTextContent(/昨天:舌苔厚/);
    expect(screen.getByTestId('compare-dry_mouth')).toHaveTextContent(/今早:微干/);
    // engaged=false 的项不应出现
    expect(screen.queryByTestId('compare-acne')).toBeNull();
  });

  test('点击揭晓 → navigate /check-in/reveal', async () => {
    fetchYesterdayMock.mockResolvedValueOnce({ hasYesterday: false });
    render(<Step2Compare />);
    await screen.findByText(/今天是第一次/);
    fireEvent.click(screen.getByText('揭晓今日火分'));
    expect(navigateMock).toHaveBeenCalledWith('/check-in/reveal');
  });
});

// ─── Step 3 揭晓 ───────────────────────────────────────────────────────

describe('U7 Step 3 揭晓 + 归因 breakdown', () => {
  test('hasCheckin=false → "先去打卡"路径', async () => {
    fetchYanScoreMock.mockResolvedValueOnce({ hasCheckin: false });
    render(<Step3Reveal />);
    expect(await screen.findByText(/先去打卡/)).toBeInTheDocument();
    fireEvent.click(screen.getByText('打卡'));
    expect(navigateMock).toHaveBeenCalledWith('/check-in/step1');
  });

  test('Post-U8: 完整 result → 显示 level + score + missingParts 提示 + 点击展开 breakdown(R18)', async () => {
    fetchYanScoreMock.mockResolvedValueOnce({
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
    });
    render(<Step3Reveal />);
    expect(await screen.findByTestId('reveal-level')).toHaveTextContent('中火');
    expect(screen.getByTestId('reveal-score')).toHaveTextContent('58.5');

    expect(screen.queryByTestId('breakdown')).toBeNull();
    fireEvent.click(screen.getByTestId('reveal-level'));
    expect(screen.getByTestId('breakdown')).toBeInTheDocument();
    expect(screen.getByTestId('breakdown')).toHaveTextContent('饮食');
    expect(screen.getByTestId('breakdown')).toHaveTextContent('35');
  });

  test('Post-U8: result=null + unavailableReason=insufficient_parts → "数据还不够" + partScores 列表', async () => {
    fetchYanScoreMock.mockResolvedValueOnce({
      hasCheckin: true,
      result: null,
      partScores: { food: null, symptom: 50, env: null, activity: null },
      unavailableReason: 'insufficient_parts'
    });
    render(<Step3Reveal />);
    expect(await screen.findByText(/数据还不够/)).toBeInTheDocument();
    // partScores 列表展示原始分数
    expect(screen.getByTestId('part-scores')).toHaveTextContent('体感');
    expect(screen.getByTestId('part-scores')).toHaveTextContent('50');
    // 缺失项显示 —
    expect(screen.getByTestId('part-scores')).toHaveTextContent('—');
  });

  test('Post-U8: result + missingParts 非空 → 提示重分配', async () => {
    fetchYanScoreMock.mockResolvedValueOnce({
      hasCheckin: true,
      result: {
        score: 71.9,
        level: '中火',
        breakdown: { food: 62.5, symptom: 9.4, env: 0, activity: 0 },
        effectiveWeights: { food: 0.625, symptom: 0.375, env: 0, activity: 0 },
        missingParts: ['env', 'activity'],
        partScores: { food: 100, symptom: 25, env: null, activity: null }
      },
      partScores: { food: 100, symptom: 25, env: null, activity: null }
    });
    render(<Step3Reveal />);
    await screen.findByTestId('reveal-level');
    expect(screen.getByText(/未接入,权重已按比例重分配/)).toBeInTheDocument();
  });
});
