/**
 * Dev / test 用 header 鉴权
 *
 * 接受 X-User-Id header,直接当作 userId。
 * 永远不应在生产启用 — config.ts 的 NODE_ENV=production 校验会强制要求 JWT secret,
 * 但 dev header resolver 仍可被显式注入(测试用)。
 *
 * 测试用这条路径,避免每个测试都签 JWT。
 */

import type { AuthResolver, AuthenticatedUser } from './types';

export class DevHeaderAuthResolver implements AuthResolver {
  async resolve(headers: Record<string, unknown>): Promise<AuthenticatedUser | null> {
    const v = headers['x-user-id'];
    if (typeof v !== 'string' || v.length === 0) return null;
    return { userId: v, source: 'dev_header' };
  }
}

/**
 * 组合鉴权:依次尝试 N 个 resolver,第一个成功的即返回
 * 生产用 [SupabaseJwtAuthResolver];dev/test 用 [SupabaseJwtAuthResolver, DevHeaderAuthResolver]
 */
export class CompositeAuthResolver implements AuthResolver {
  constructor(private resolvers: AuthResolver[]) {}

  async resolve(headers: Record<string, unknown>): Promise<AuthenticatedUser | null> {
    for (const r of this.resolvers) {
      const result = await r.resolve(headers);
      if (result) return result;
    }
    return null;
  }
}
