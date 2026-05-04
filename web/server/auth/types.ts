/**
 * 鉴权抽象 — 多种来源(Supabase JWT / dev header)统一接口
 *
 * 职责:从请求 headers 中解析出当前用户 id;失败返回 null。
 * 由 Fastify preHandler 调用并把结果挂到 req.user。
 */

export interface AuthenticatedUser {
  /** 与 users.id (uuid) 一致 */
  userId: string;
  /** 来源:'supabase_jwt' / 'dev_header' / 'service' */
  source: AuthSource;
}

export type AuthSource = 'supabase_jwt' | 'dev_header' | 'service';

export interface AuthResolver {
  /**
   * @returns AuthenticatedUser 或 null;不抛异常,异常 → null
   */
  resolve(headers: Record<string, unknown>): Promise<AuthenticatedUser | null>;
}

/** 给 Fastify req 增加 user 字段的类型 */
declare module 'fastify' {
  interface FastifyRequest {
    user?: AuthenticatedUser;
  }
}
