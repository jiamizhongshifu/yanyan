/**
 * 鉴权模块 — 默认 resolver 工厂 + 路由用 helper
 */

import type { FastifyRequest, FastifyReply } from 'fastify';
import { getConfig } from '../config';
import { CompositeAuthResolver, DevHeaderAuthResolver } from './dev-header';
import { SupabaseJwtAuthResolver } from './supabase-jwt';
import type { AuthResolver, AuthenticatedUser } from './types';

export * from './types';
export { SupabaseJwtAuthResolver } from './supabase-jwt';
export { DevHeaderAuthResolver, CompositeAuthResolver } from './dev-header';

let cached: AuthResolver | null = null;

/**
 * 默认 resolver 装配:
 *   生产 → SupabaseJwtAuthResolver (only)
 *   非生产 → CompositeAuthResolver([Supabase JWT, Dev header])
 *
 * Dev header 仅作为补充路径,JWT 优先。
 */
export function getDefaultAuthResolver(): AuthResolver {
  if (cached) return cached;
  const cfg = getConfig();
  const resolvers: AuthResolver[] = [];

  if (cfg.SUPABASE_JWT_SECRET || cfg.SUPABASE_URL) {
    resolvers.push(
      new SupabaseJwtAuthResolver({
        jwtSecret: cfg.SUPABASE_JWT_SECRET,
        supabaseUrl: cfg.SUPABASE_URL
      })
    );
  }

  if (cfg.NODE_ENV !== 'production') {
    resolvers.push(new DevHeaderAuthResolver());
  }

  if (resolvers.length === 0) {
    // 非生产 + 没配 JWT secret 时,留 dev header 作为唯一路径(纯本地开发)
    resolvers.push(new DevHeaderAuthResolver());
  }

  cached = new CompositeAuthResolver(resolvers);
  return cached;
}

export function resetAuthForTesting(): void {
  cached = null;
}

/**
 * 路由 helper:从已认证 req 中拿 user;否则 reply 401。
 *
 * 使用:
 *   const user = requireUser(req, reply);
 *   if (!user) return; // reply 已经被 send,直接 return
 */
export function requireUser(req: FastifyRequest, reply: FastifyReply): AuthenticatedUser | null {
  if (req.user) return req.user;
  reply.code(401).send({ ok: false, error: 'unauthorized', message: 'authentication required' });
  return null;
}
