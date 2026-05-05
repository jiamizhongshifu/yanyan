/**
 * Supabase JWT 校验(自动支持 ES256 + HS256 双路)
 *
 * Supabase 新项目默认 ECC P-256(ES256)签 JWT,kid 引用 jwks 公钥;
 * 老项目 / Legacy JWT Secret 仍是 HS256 共享密钥。
 *
 * 检测:
 *   - token header alg = HS256 → 用 SUPABASE_JWT_SECRET
 *   - alg = ES256 / RS256 / EdDSA → 拉 JWKS 公钥(SUPABASE_URL/auth/v1/.well-known/jwks.json)
 *
 * Claims:
 *   sub  → user_id;exp 自动校验;role authenticated / service_role 通过,anon 拒
 */

import { createRemoteJWKSet, jwtVerify, decodeProtectedHeader, type JWTPayload, type KeyLike } from 'jose';
import type { AuthResolver, AuthenticatedUser } from './types';

export interface SupabaseJwtOpts {
  jwtSecret?: string;
  supabaseUrl?: string;
}

export class SupabaseJwtAuthResolver implements AuthResolver {
  private readonly hs256Secret: Uint8Array | null;
  private readonly jwks: ReturnType<typeof createRemoteJWKSet> | null;

  constructor(opts: SupabaseJwtOpts | string) {
    // 兼容旧调用签名 new SupabaseJwtAuthResolver(jwtSecret)
    const o: SupabaseJwtOpts = typeof opts === 'string' ? { jwtSecret: opts } : opts;
    this.hs256Secret =
      o.jwtSecret && o.jwtSecret.length >= 16 ? new TextEncoder().encode(o.jwtSecret) : null;
    this.jwks = o.supabaseUrl
      ? createRemoteJWKSet(
          new URL(`${o.supabaseUrl.replace(/\/$/, '')}/auth/v1/.well-known/jwks.json`)
        )
      : null;
    if (!this.hs256Secret && !this.jwks) {
      throw new Error('SupabaseJwtAuthResolver 至少需要 jwtSecret 或 supabaseUrl');
    }
  }

  async resolve(headers: Record<string, unknown>): Promise<AuthenticatedUser | null> {
    const auth = headers['authorization'] ?? headers['Authorization'];
    if (typeof auth !== 'string') return null;
    const match = auth.match(/^Bearer\s+(.+)$/i);
    if (!match) return null;
    const token = match[1];

    let payload: JWTPayload;
    try {
      const alg = decodeProtectedHeader(token).alg ?? 'HS256';
      if (alg === 'HS256' && this.hs256Secret) {
        ({ payload } = await jwtVerify(token, this.hs256Secret, { algorithms: ['HS256'] }));
      } else if (this.jwks) {
        ({ payload } = await jwtVerify(token, this.jwks as unknown as KeyLike, {
          algorithms: ['ES256', 'RS256', 'EdDSA']
        }));
      } else {
        return null;
      }
    } catch {
      return null;
    }

    const sub = payload.sub;
    if (typeof sub !== 'string' || sub.length === 0) return null;
    const role = (payload as { role?: unknown }).role;
    if (role === 'anon') return null;
    return {
      userId: sub,
      source: role === 'service_role' ? 'service' : 'supabase_jwt'
    };
  }
}
