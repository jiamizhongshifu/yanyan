/**
 * Supabase JWT 校验
 *
 * Supabase 默认签名算法:HS256,密钥即 SUPABASE_JWT_SECRET。
 * Token 来自客户端 supabase.auth.getSession().data.session.access_token,
 * 通过 Authorization: Bearer <token> 传入。
 *
 * Claims 关心:
 *   sub        → user_id(对应 users.id 一致 — 我们在 user 创建时与 supabase auth user 同步 id)
 *   exp        → 过期时间(jose 自动校验)
 *   role       → 'authenticated' / 'anon' / 'service_role'
 *   email/aud  → 不强制校验(简化)
 */

import { jwtVerify } from 'jose';
import type { AuthResolver, AuthenticatedUser } from './types';

export class SupabaseJwtAuthResolver implements AuthResolver {
  private readonly secret: Uint8Array;

  constructor(jwtSecret: string) {
    if (!jwtSecret || jwtSecret.length < 16) {
      throw new Error('SupabaseJwtAuthResolver 需要长度 ≥ 16 的 jwtSecret');
    }
    this.secret = new TextEncoder().encode(jwtSecret);
  }

  async resolve(headers: Record<string, unknown>): Promise<AuthenticatedUser | null> {
    const auth = headers['authorization'] ?? headers['Authorization'];
    if (typeof auth !== 'string') return null;
    const match = auth.match(/^Bearer\s+(.+)$/i);
    if (!match) return null;
    const token = match[1];
    try {
      const { payload } = await jwtVerify(token, this.secret, { algorithms: ['HS256'] });
      const sub = payload.sub;
      if (typeof sub !== 'string' || sub.length === 0) return null;
      // role 校验:只接受 authenticated / service_role,拒绝 anon
      const role = (payload as { role?: unknown }).role;
      if (role === 'anon') return null;
      return {
        userId: sub,
        source: role === 'service_role' ? 'service' : 'supabase_jwt'
      };
    } catch {
      return null;
    }
  }
}
