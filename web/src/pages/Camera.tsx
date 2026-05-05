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
  const inputRef = useRef<HTMLInputElement>(null);
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
      // 重置 input 让用户能再选同一文件
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  // 头部插画:idle/done = 餐桌邀请图;识别中 = thinking;有错 = worried
  const headerImg = errorMessage
    ? 'mascot-worried.png'
    : busy
    ? 'mascot-thinking.png'
    : 'camera-tabletop.png';

  return (
    <main className="min-h-screen bg-paper px-7 pt-12 pb-10 max-w-md mx-auto">
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
      <p className="mt-3 text-sm text-ink/60 leading-relaxed text-center">
        {errorMessage
          ? errorMessage
          : busy
          ? '别走开,水豚正在帮你看这一餐里有什么。'
          : 'AI 会估算这一餐的添加糖与碳水,给出当餐抗炎指数(★1-5)。识别后你可以标记错的,我们会修正。'}
      </p>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={onPickFile}
        className="hidden"
        data-testid="photo-input"
      />

      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={authLoading || busy}
        data-ready={!authLoading && !busy}
        className="mt-12 w-full rounded-2xl bg-ink text-white py-8 text-lg font-medium disabled:opacity-50"
      >
        {authLoading ? '加载中…' : stage === 'idle' || stage === 'done' ? '拍 / 选这一餐照片' : STAGE_HINT[stage]}
      </button>

      {errorMessage && (
        <div role="alert" className="sr-only">
          {errorMessage}
        </div>
      )}

      <p className="mt-12 text-xs text-ink/40 leading-relaxed text-center">
        v1 阶段 LLM 识别走境内多模态服务;<br />
        识别结果不出境,照片仅在你的账号下保留。
      </p>
    </main>
  );
}
