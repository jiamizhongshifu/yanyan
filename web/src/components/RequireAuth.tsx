/**
 * RequireAuth — 路由守卫
 *
 * 需要登录的子路由用 <RequireAuth> 包裹:
 *   - 未登录(且加载完成)→ navigate /login
 *   - 加载中 → 简短 loading 占位
 *   - 已登录 → 渲染 children
 */

import { useEffect, type ReactNode } from 'react';
import { useLocation } from 'wouter';
import { useAuth } from '../services/auth';

interface RequireAuthProps {
  children: ReactNode;
}

export function RequireAuth({ children }: RequireAuthProps) {
  const { session, loading } = useAuth();
  const [, navigate] = useLocation();

  useEffect(() => {
    if (!loading && !session) {
      navigate('/login');
    }
  }, [loading, session, navigate]);

  if (loading) {
    return <div className="min-h-screen bg-paper flex items-center justify-center text-ink/50">加载中…</div>;
  }
  if (!session) return null;
  return <>{children}</>;
}
