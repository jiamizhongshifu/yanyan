/**
 * RequireAuth — 路由守卫
 *
 * 需要登录的子路由用 <RequireAuth> 包裹:
 *   - 未登录 + 加载完成 → 记原 pathname 到 sessionStorage,navigate /login
 *   - 加载中 → LoadingView 占位
 *   - 已登录 → 渲染 children
 *
 * Login 成功后(AuthCallback)读 sessionStorage 跳回原页,
 *   不再硬跳 /app — deep link 到 /app/insights / /findings 等场景才不会丢意图。
 */

import { useEffect, type ReactNode } from 'react';
import { useLocation } from 'wouter';
import { useAuth } from '../services/auth';
import { LoadingView } from './StateView';

const REDIRECT_KEY = 'yanyan.auth.redirect-to';

/** 写入预期跳转路径(仅 /app/* 等受保护前缀,避免存 /login 等无效目标) */
function rememberIntent(pathname: string) {
  if (typeof sessionStorage === 'undefined') return;
  if (!pathname || pathname === '/login' || pathname === '/' || pathname.startsWith('/auth/')) return;
  sessionStorage.setItem(REDIRECT_KEY, pathname);
}

/** 读取并清除预期跳转路径 */
export function consumeAuthRedirect(): string | null {
  if (typeof sessionStorage === 'undefined') return null;
  const v = sessionStorage.getItem(REDIRECT_KEY);
  if (v) sessionStorage.removeItem(REDIRECT_KEY);
  return v;
}

interface RequireAuthProps {
  children: ReactNode;
}

export function RequireAuth({ children }: RequireAuthProps) {
  const { session, loading } = useAuth();
  const [location, navigate] = useLocation();

  useEffect(() => {
    if (!loading && !session) {
      rememberIntent(location);
      navigate('/login', { replace: true });
    }
  }, [loading, session, navigate, location]);

  if (loading) {
    return (
      <div className="min-h-screen bg-paper">
        <LoadingView fullScreen />
      </div>
    );
  }
  if (!session) return null;
  return <>{children}</>;
}
