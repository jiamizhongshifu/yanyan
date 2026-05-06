/**
 * U6 拍照 + MealResult 测试
 *
 * 重点覆盖:
 *   - Camera 页:点击调用 input → 走 compressImage → uploadPhoto → postMeal → set lastMeal → navigate
 *   - 上传失败 → errorMessage,不调 postMeal
 *   - postMeal low_confidence → errorMessage 提示补拍
 *   - MealResult:渲染 level / fireScore / items / 未收录提示
 *   - FoodItemCard:点"识别错误"调 postMealFeedback
 */

import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { Camera } from '../pages/Camera';
import { MealResult } from '../pages/MealResult';
import { useLastMeal } from '../store/lastMeal';

// 等 useAuth 的 getSession Promise 解析 + 后续 setState 落地;
// Camera 在 authLoading 时按钮 data-ready 为 false,加载完后变 true
async function waitForAuthReady() {
  await waitFor(() => {
    const btn = screen.queryByText('拍 / 选这一餐照片')?.closest('button') as HTMLButtonElement | null;
    expect(btn?.dataset.ready).toBe('true');
  });
}

// 路由 mock
const navigateMock = vi.fn();
vi.mock('wouter', async () => {
  const actual = await vi.importActual<typeof import('wouter')>('wouter');
  return { ...actual, useLocation: () => ['/', navigateMock] };
});

// Supabase mock — 仅 auth(meals 服务被整体 mock,无需 storage)
const supabaseMockState: { session: { access_token: string; user: { id: string } } | null } = {
  session: { access_token: 'fake-jwt', user: { id: 'u1' } }
};
vi.mock('../services/supabase', () => ({
  getSupabase: () => ({
    auth: {
      getSession: vi.fn(async () => ({ data: { session: supabaseMockState.session } })),
      onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
      signOut: vi.fn()
    },
    storage: { from: () => ({ upload: vi.fn() }) }
  }),
  resetSupabaseForTesting: vi.fn()
}));

// services/meals 整体 mock,直接控制 compress/upload/postMeal/postMealFeedback 各路径
const compressImageMock = vi.fn();
const uploadPhotoMock = vi.fn();
const postMealMock = vi.fn();
const postMealFeedbackMock = vi.fn();
const fetchMealIllustrationMock = vi.fn().mockResolvedValue(null);
vi.mock('../services/meals', () => ({
  compressImage: (...args: unknown[]) => compressImageMock(...args),
  uploadPhoto: (...args: unknown[]) => uploadPhotoMock(...args),
  postMeal: (...args: unknown[]) => postMealMock(...args),
  postMealFeedback: (...args: unknown[]) => postMealFeedbackMock(...args),
  fetchMealIllustration: (...args: unknown[]) => fetchMealIllustrationMock(...args)
}));

// crypto.randomUUID 在 jsdom 老版本可能缺失
beforeEach(() => {
  if (!('randomUUID' in globalThis.crypto)) {
    (globalThis.crypto as unknown as { randomUUID: () => string }).randomUUID = () => 'test-uuid';
  }
});

beforeEach(() => {
  navigateMock.mockReset();
  compressImageMock.mockReset();
  compressImageMock.mockImplementation(async () => new Blob([new Uint8Array([1, 2, 3])], { type: 'image/jpeg' }));
  uploadPhotoMock.mockReset();
  uploadPhotoMock.mockResolvedValue('users/u1/test-uuid/123.jpg');
  postMealMock.mockReset();
  postMealFeedbackMock.mockReset();
  postMealFeedbackMock.mockResolvedValue(true);
  fetchMealIllustrationMock.mockReset();
  fetchMealIllustrationMock.mockResolvedValue(null);
  useLastMeal.getState().set(null);
  supabaseMockState.session = { access_token: 'fake-jwt', user: { id: 'u1' } };
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('U6 Camera page', () => {
  const mealResultOk = {
    mealId: 'meal-1',
    fireScore: 0,
    level: '平' as const,
    items: [{ name: '清蒸鲈鱼', confidence: 0.9, classification: null }],
    unrecognizedNames: [],
    modelVersion: 'test'
  };

  test('happy: 选文件 → upload → postMeal → setLastMeal + navigate', async () => {
    postMealMock.mockResolvedValueOnce({ kind: 'ok', data: mealResultOk });

    render(<Camera />);
    await waitForAuthReady();
    fireEvent.change(screen.getByTestId('photo-input'), {
      target: { files: [new File([new Uint8Array([1, 2, 3])], 'meal.jpg', { type: 'image/jpeg' })] }
    });

    await waitFor(() => expect(navigateMock).toHaveBeenCalledWith('/meals/meal-1'));
    expect(uploadPhotoMock).toHaveBeenCalledWith('u1', expect.any(Blob));
    expect(postMealMock).toHaveBeenCalledWith('users/u1/test-uuid/123.jpg');
    expect(useLastMeal.getState().result?.fireScore).toBe(0);
  });

  test('Edge: uploadPhoto 失败(返回 null) → errorMessage 上传失败,不调 postMeal', async () => {
    uploadPhotoMock.mockResolvedValueOnce(null);

    render(<Camera />);
    await waitForAuthReady();
    fireEvent.change(screen.getByTestId('photo-input'), {
      target: { files: [new File([new Uint8Array(1)], 'a.jpg', { type: 'image/jpeg' })] }
    });

    expect(await screen.findByRole('alert')).toHaveTextContent(/上传失败/);
    expect(postMealMock).not.toHaveBeenCalled();
  });

  test('Edge: postMeal low_confidence → errorMessage 补拍提示', async () => {
    postMealMock.mockResolvedValueOnce({ kind: 'low_confidence', message: '看不太清,要不要补一张?' });

    render(<Camera />);
    await waitForAuthReady();
    fireEvent.change(screen.getByTestId('photo-input'), {
      target: { files: [new File([new Uint8Array(1)], 'b.jpg', { type: 'image/jpeg' })] }
    });

    expect(await screen.findByRole('alert')).toHaveTextContent(/补一张/);
    expect(navigateMock).not.toHaveBeenCalled();
  });
});

describe('U6 MealResult page', () => {
  test('renders level + fireScore + N items + 未收录提示', () => {
    useLastMeal.getState().set({
      mealId: 'meal-1',
      fireScore: 33.3,
      level: '微火',
      items: [
        { name: '清蒸鲈鱼', confidence: 0.9, classification: { foodCanonicalName: '清蒸鲈鱼', tcmLabel: '平', tcmProperty: '平', diiScore: -0.92, agesScore: 23, gi: null, addedSugarG: null, carbsG: null, citations: [{ source: 'canon', reference: '《本草纲目》' }] } },
        { name: '羊肉', confidence: 0.85, classification: { foodCanonicalName: '羊肉', tcmLabel: '发', tcmProperty: '热', diiScore: 0.55, agesScore: 56, gi: null, addedSugarG: null, carbsG: null, citations: [{ source: 'canon', reference: '《本草纲目》兽部·羊' }] } }
      ],
      unrecognizedNames: ['某神秘食物'],
      modelVersion: 'test'
    });

    render(<MealResult />);
    // 抗炎指数:fireScore 33.3 → antiInflam 67;级别"微火" → 显示"轻盈" + 4 星
    expect(screen.getByTestId('fire-level')).toHaveTextContent('轻盈');
    expect(screen.getByTestId('fire-score')).toHaveTextContent('67');
    expect(screen.getAllByTestId('food-item-card')).toHaveLength(2);
    expect(screen.getByText(/某神秘食物/)).toBeInTheDocument();
  });

  test('点"识别错误"按钮调 postMealFeedback', async () => {
    useLastMeal.getState().set({
      mealId: 'meal-9',
      fireScore: 0,
      level: '平',
      items: [
        { name: '清蒸鲈鱼', confidence: 0.9, classification: { foodCanonicalName: '清蒸鲈鱼', tcmLabel: '平', tcmProperty: '平', diiScore: -0.92, agesScore: 23, gi: null, addedSugarG: null, carbsG: null, citations: [] } }
      ],
      unrecognizedNames: [],
      modelVersion: 'test'
    });

    render(<MealResult />);
    fireEvent.click(screen.getByText('识别错误'));

    await waitFor(() => expect(postMealFeedbackMock).toHaveBeenCalledWith('meal-9', '清蒸鲈鱼', 'misrecognized'));
    expect(await screen.findByRole('status')).toHaveTextContent(/已记录/);
  });

  test('无 lastMeal → 自动跳 /camera', () => {
    useLastMeal.getState().set(null);
    render(<MealResult />);
    expect(navigateMock).toHaveBeenCalledWith('/camera');
  });
});
