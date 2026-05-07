/**
 * 按钮组件 — 取代散布在各页面的 <button className="rounded-full bg-ink ..."> 样板
 *
 * 解决:
 *   1. 主/次/三级按钮样式统一(原本散落各处,微小不一致)
 *   2. 全态:default / active / disabled / loading
 *   3. 大小三档:lg(默认主 CTA) / md(对话框/卡内) / sm(紧凑列表)
 *   4. 触控区 ≥ 44px(无障碍)
 *
 * 用法:
 *   <Button onClick={...}>主操作</Button>                    // primary lg
 *   <Button variant="secondary">次操作</Button>
 *   <Button variant="tertiary" size="sm">取消</Button>
 *   <Button loading>提交中...</Button>                        // 自动禁用 + 旋转 spinner
 *   <Button as="a" href="...">行的链接按钮</Button>           // 渲染成 <a>
 */

import { forwardRef, type ButtonHTMLAttributes, type AnchorHTMLAttributes, type ReactNode } from 'react';

type Variant = 'primary' | 'secondary' | 'tertiary';
type Size = 'lg' | 'md' | 'sm';

interface CommonProps {
  variant?: Variant;
  size?: Size;
  /** 加载中:显示 spinner + 禁用点击,按钮文本仍可见 */
  loading?: boolean;
  /** 全宽(撑满父容器),默认 false */
  block?: boolean;
  /** 左侧图标(已加载完的 React 节点) */
  leftIcon?: ReactNode;
  children?: ReactNode;
  className?: string;
}

type ButtonProps = CommonProps & ButtonHTMLAttributes<HTMLButtonElement> & { as?: 'button' };
type AnchorProps = CommonProps & AnchorHTMLAttributes<HTMLAnchorElement> & { as: 'a' };
type Props = ButtonProps | AnchorProps;

const VARIANT: Record<Variant, string> = {
  primary: 'bg-ink text-paper active:opacity-80',
  secondary: 'bg-paper text-ink border border-ink/10 active:bg-ink/5',
  tertiary: 'bg-transparent text-ink border-2 border-ink/15 active:bg-ink/5'
};

const SIZE: Record<Size, string> = {
  lg: 'rounded-full px-6 py-3 text-base font-medium min-h-[44px]',
  md: 'rounded-full px-5 py-2.5 text-sm font-medium min-h-[40px]',
  sm: 'rounded-full px-4 py-1.5 text-xs font-medium min-h-[32px]'
};

const BASE = 'inline-flex items-center justify-center gap-2 transition disabled:opacity-40 disabled:cursor-not-allowed disabled:active:opacity-40';

export const Button = forwardRef<HTMLButtonElement | HTMLAnchorElement, Props>(function Button(
  { variant = 'primary', size = 'lg', loading = false, block = false, leftIcon, children, className = '', ...rest },
  ref
) {
  const cls = [
    BASE,
    VARIANT[variant],
    SIZE[size],
    block ? 'w-full' : '',
    className
  ]
    .filter(Boolean)
    .join(' ');

  const content = (
    <>
      {loading ? <Spinner /> : leftIcon}
      <span>{children}</span>
    </>
  );

  if (rest.as === 'a') {
    const { as: _as, ...anchorRest } = rest as AnchorProps;
    return (
      <a
        ref={ref as React.Ref<HTMLAnchorElement>}
        className={cls}
        aria-disabled={loading || (anchorRest as { 'aria-disabled'?: boolean })['aria-disabled']}
        {...anchorRest}
      >
        {content}
      </a>
    );
  }

  const { as: _as, disabled, type, ...buttonRest } = rest as ButtonProps;
  return (
    <button
      ref={ref as React.Ref<HTMLButtonElement>}
      type={type ?? 'button'}
      className={cls}
      disabled={disabled || loading}
      {...buttonRest}
    >
      {content}
    </button>
  );
});

function Spinner() {
  return (
    <svg
      className="animate-spin h-4 w-4 -ml-0.5"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
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
