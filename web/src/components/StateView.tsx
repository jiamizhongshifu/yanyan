/**
 * 状态视图模板 — Loading / Empty / Error 三套统一外观,替代散布的"加载中…"裸文本
 *
 * 设计:
 *   - LoadingView   :轻量,旋转 spinner + 文案,不抢焦点
 *   - EmptyView     :水豚 mascot + 标题 + 副文案 + 可选 CTA(引导用户下一步)
 *   - ErrorView     :worried mascot + 标题 + 详情 + 重试按钮
 *
 * 用法:
 *   if (loading) return <LoadingView />;
 *   if (!data) return <EmptyView title="还没什么可看" body="拍第一餐..." cta={{label:'去拍餐',onClick:...}} />;
 *   if (error) return <ErrorView onRetry={fetchData} detail={errorMsg} />;
 *
 * 这 3 个组件都是 self-contained,不假设父级布局,默认水平居中。
 */

import type { ReactNode } from 'react';
import { Button } from './Button';
import { asset } from '../services/assets';

// ── Loading ──────────────────────────────────────

interface LoadingProps {
  /** 文案,默认"加载中…" */
  message?: string;
  /** 是否撑满父高度,垂直居中(用于 page-level loading) */
  fullScreen?: boolean;
}

export function LoadingView({ message = '加载中…', fullScreen = false }: LoadingProps) {
  return (
    <div
      className={`flex flex-col items-center justify-center gap-3 text-ink/50 ${
        fullScreen ? 'min-h-screen' : 'py-10'
      }`}
      role="status"
      aria-live="polite"
      data-testid="state-loading"
    >
      <Spinner />
      <span className="text-xs">{message}</span>
    </div>
  );
}

// ── Empty ────────────────────────────────────────

interface EmptyProps {
  /** mascot 图,默认 thinking */
  mascot?: 'thinking' | 'happy' | 'cheer' | 'pensive' | 'caring';
  title: string;
  body?: string;
  /** 可选引导 CTA */
  cta?: { label: string; onClick: () => void };
  /** 紧凑模式:卡内嵌入用,减小 mascot 尺寸 */
  compact?: boolean;
}

const MASCOT_FILE: Record<NonNullable<EmptyProps['mascot']>, string> = {
  thinking: 'mascot-thinking.png',
  happy: 'mascot-happy.png',
  cheer: 'mascot-cheer.png',
  pensive: 'mascot-pensive.png',
  caring: 'mascot-caring.png'
};

export function EmptyView({ mascot = 'thinking', title, body, cta, compact = false }: EmptyProps) {
  const mascotSize = compact ? 'w-16 h-16' : 'w-24 h-24';
  const padding = compact ? 'py-6' : 'py-10';
  return (
    <div
      className={`flex flex-col items-center text-center px-6 ${padding}`}
      role="status"
      data-testid="state-empty"
    >
      <img
        src={asset(MASCOT_FILE[mascot])}
        alt=""
        className={`${mascotSize} object-contain`}
        loading="lazy"
      />
      <p className="mt-3 text-sm font-medium text-ink">{title}</p>
      {body && <p className="mt-1.5 text-xs text-ink/50 leading-relaxed max-w-xs">{body}</p>}
      {cta && (
        <Button size="md" onClick={cta.onClick} className="mt-5">
          {cta.label}
        </Button>
      )}
    </div>
  );
}

// ── Error ────────────────────────────────────────

interface ErrorProps {
  title?: string;
  detail?: ReactNode;
  /** 提供时显示"重试"按钮 */
  onRetry?: () => void;
  retryLabel?: string;
}

export function ErrorView({
  title = '加载出错了',
  detail = '可能是网络抖动,稍等再试。',
  onRetry,
  retryLabel = '重试'
}: ErrorProps) {
  return (
    <div
      className="flex flex-col items-center text-center px-6 py-10"
      role="alert"
      data-testid="state-error"
    >
      <img
        src={asset('mascot-worried.png')}
        alt=""
        className="w-24 h-24 object-contain"
        loading="lazy"
      />
      <p className="mt-3 text-sm font-medium text-ink">{title}</p>
      <p className="mt-1.5 text-xs text-ink/50 leading-relaxed max-w-xs">{detail}</p>
      {onRetry && (
        <Button size="md" onClick={onRetry} className="mt-5">
          {retryLabel}
        </Button>
      )}
    </div>
  );
}

// ── shared spinner ──────────────────────────────

function Spinner() {
  return (
    <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" opacity="0.25" fill="none" />
      <path
        d="M 12 2 a 10 10 0 0 1 10 10"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
        fill="none"
      />
    </svg>
  );
}
