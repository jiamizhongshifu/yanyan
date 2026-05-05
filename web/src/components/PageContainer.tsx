/**
 * 页面容器 — 移动优先 + 大屏居中
 *
 * 默认 max-w-md(28rem ≈ 448px),与 mobile webapp 自然宽度相符;
 * 在平板 / 桌面大屏自动居中,左右留白,不会被拉伸到丑陋的全屏宽度。
 *
 * 用法:把页面 <main className="..."> 内层包一层 <PageContainer>。
 */
import type { ReactNode } from 'react';

interface Props {
  children: ReactNode;
  /** 默认 max-w-md(448px),个别需要更宽如 PDF 档案 / Landing 用 max-w-2xl */
  maxWidth?: 'md' | 'lg' | 'xl' | '2xl' | '3xl';
  className?: string;
}

const MAX_W: Record<NonNullable<Props['maxWidth']>, string> = {
  md: 'max-w-md',
  lg: 'max-w-lg',
  xl: 'max-w-xl',
  '2xl': 'max-w-2xl',
  '3xl': 'max-w-3xl'
};

export function PageContainer({ children, maxWidth = 'md', className = '' }: Props) {
  return (
    <div className={`w-full ${MAX_W[maxWidth]} mx-auto ${className}`}>
      {children}
    </div>
  );
}
