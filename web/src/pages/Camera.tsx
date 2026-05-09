/**
 * 拍照页(F2 入口)
 *
 * Web 拍照路径(替代 wx.chooseMedia):
 *   <input type="file" accept="image/*" capture="environment">
 *   - capture="environment" 后置摄像头(iOS Safari + 安卓 Chrome 都支持)
 *   - 兼容性退化:capture 不支持时自动变相册选择
 *
 * 流程:选/拍照 → 压缩 → 上传 Storage → POST /meals → 跳 MealResult
 */

import { useRef, useState } from 'react';
import { useLocation } from 'wouter';
import { useAuth } from '../services/auth';
import { compressImage, postMeal, uploadPhoto } from '../services/meals';
import { useLastMeal } from '../store/lastMeal';
import { track } from '../services/tracker';
import { asset } from '../services/assets';

type Stage = 'idle' | 'compressing' | 'uploading' | 'recognizing' | 'done' | 'error';

const STAGE_HINT: Record<Exclude<Stage, 'idle'>, string> = {
  compressing: '压缩照片中…',
  uploading: '上传中…',
  recognizing: '识别中…',
  done: '完成',
  error: '出错'
};

export function Camera() {
  const [, navigate] = useLocation();
  const { userId, loading: authLoading } = useAuth();
  const setLastMeal = useLastMeal((s) => s.set);
  // 两个独立 input:
  //   - cameraInputRef:capture=environment 直接调摄像头
  //   - galleryInputRef:不带 capture,触发系统相册选择
  // iOS Safari / 安卓 Chrome 都会把 capture 属性当作"打开相机的偏好",
  // 不带则进相册。
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const [stage, setStage] = useState<Stage>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const busy = stage === 'compressing' || stage === 'uploading' || stage === 'recognizing';

  const onPickFile: React.ChangeEventHandler<HTMLInputElement> = async (e) => {
    setErrorMessage('');
    const file = e.target.files?.[0];
    if (!file) return;
    if (!userId) {
      setErrorMessage('账号未登录,请重新登录。');
      return;
    }

    try {
      setStage('compressing');
      const blob = await compressImage(file);

      setStage('uploading');
      const key = await uploadPhoto(userId, blob);
      if (!key) {
        setStage('error');
        setErrorMessage('上传失败,请稍后再试。');
        return;
      }
      track('photo_uploaded');

      setStage('recognizing');
      const outcome = await postMeal(key);
      if (outcome.kind === 'ok') {
        setLastMeal(outcome.data);
        setStage('done');
        track('meal_recognized', { mealId: outcome.data.mealId });
        navigate(`/meals/${outcome.data.mealId}`);
        return;
      }
      setStage('error');
      setErrorMessage(outcome.message);
    } catch (err) {
      setStage('error');
      setErrorMessage(err instanceof Error ? err.message : '处理失败');
    } finally {
      // 重置两个 input 让用户能再选同一文件
      if (cameraInputRef.current) cameraInputRef.current.value = '';
      if (galleryInputRef.current) galleryInputRef.current.value = '';
    }
  };

  // 头部插画:idle/done = 餐桌邀请图;识别中 = thinking;有错 = worried
  const headerImg = errorMessage
    ? 'mascot-worried.png'
    : busy
    ? 'mascot-thinking.png'
    : 'camera-tabletop.png';

  // 关闭按钮目标 — 优先回到 FAB 触发时的 tab(从底栏拍照),否则 /app
  const onClose = async () => {
    if (busy) return; // 处理中禁止关闭
    const { consumeCameraFromTab } = await import('../components/BottomTabs');
    navigate(consumeCameraFromTab() ?? '/app');
  };

  return (
    <main className="min-h-screen bg-paper px-7 pt-12 pb-10 max-w-md mx-auto">
      {/* 关闭按钮 — 左上角 ✕ */}
      <button
        type="button"
        onClick={onClose}
        disabled={busy}
        aria-label="关闭"
        className="absolute top-4 left-4 w-10 h-10 rounded-full bg-white shadow-sm flex items-center justify-center text-ink/70 active:scale-95 transition disabled:opacity-40"
        data-testid="camera-close"
      >
        <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M6 6 L18 18" />
          <path d="M6 18 L18 6" />
        </svg>
      </button>

      <div className="flex justify-center mb-2">
        <img
          src={asset(headerImg)}
          alt=""
          className={`object-contain transition-all ${busy || errorMessage ? 'w-32 h-32' : 'w-44 h-44'}`}
          loading="lazy"
        />
      </div>
      <h1 className="text-2xl font-semibold text-ink text-center">
        {errorMessage ? '出了点小问题' : busy ? STAGE_HINT[stage as keyof typeof STAGE_HINT] : '拍下这一餐'}
      </h1>
      <p className="mt-3 text-sm text-ink/50 leading-relaxed text-center">
        {errorMessage
          ? errorMessage
          : busy
          ? '别走开,水豚正在帮你看这一餐里有什么。'
          : 'AI 会估算这一餐的添加糖与碳水,给出当餐抗炎指数(★1-5)。识别后你可以标记错的,我们会修正。'}
      </p>

      {/* 两个隐藏 input — 一个走相机,一个走相册 */}
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={onPickFile}
        className="hidden"
        data-testid="photo-input-camera"
      />
      <input
        ref={galleryInputRef}
        type="file"
        accept="image/*"
        onChange={onPickFile}
        className="hidden"
        data-testid="photo-input-gallery"
      />

      {/* 处理中显示单一进度按钮(占满宽度);idle 时显示并排两个 CTA */}
      {busy ? (
        <button
          type="button"
          disabled
          className="mt-12 w-full rounded-2xl bg-ink text-white py-8 text-lg font-medium opacity-50"
        >
          {STAGE_HINT[stage]}
        </button>
      ) : (
        <div className="mt-12 grid grid-cols-2 gap-3" data-testid="photo-actions">
          <button
            type="button"
            onClick={() => cameraInputRef.current?.click()}
            disabled={authLoading}
            className="rounded-2xl bg-ink text-white py-6 px-3 text-base font-medium disabled:opacity-50 active:opacity-80 flex flex-col items-center gap-2"
            data-testid="btn-take-photo"
          >
            <svg viewBox="0 0 24 24" className="w-7 h-7" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 8 a 1 1 0 0 1 1 -1 h 4 l 1.5 -2 h 5 l 1.5 2 h 4 a 1 1 0 0 1 1 1 v 10 a 1 1 0 0 1 -1 1 h -16 a 1 1 0 0 1 -1 -1 z" />
              <circle cx="12" cy="13" r="4" />
            </svg>
            <span>拍这一餐</span>
          </button>
          <button
            type="button"
            onClick={() => galleryInputRef.current?.click()}
            disabled={authLoading}
            className="rounded-2xl bg-paper text-ink border-2 border-ink/15 py-6 px-3 text-base font-medium disabled:opacity-50 active:bg-ink/5 flex flex-col items-center gap-2"
            data-testid="btn-pick-gallery"
          >
            <svg viewBox="0 0 24 24" className="w-7 h-7" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="4" width="18" height="14" rx="2" />
              <circle cx="9" cy="10" r="2" />
              <path d="M3 16 l 5 -5 l 4 4 l 3 -3 l 6 6" />
            </svg>
            <span>从相册选</span>
          </button>
        </div>
      )}

      {errorMessage && (
        <div role="alert" className="sr-only">
          {errorMessage}
        </div>
      )}

      <p className="mt-12 text-xs text-ink/30 leading-relaxed text-center">
        v1 阶段 LLM 识别走境内多模态服务;<br />
        识别结果不出境,照片仅在你的账号下保留。
      </p>
    </main>
  );
}
