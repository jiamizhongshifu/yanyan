/**
 * Fastify preHandler — 把 resolver 解析出的 user 挂到 req.user
 *
 * 路由级别仍由各自的 requireUser(req, reply) 决定是否需要鉴权;
 * 这一步只是把 user 解析放到一处,避免每个 handler 重复读 header。
 */

import type { FastifyInstance } from 'fastify';
import type { AuthResolver } from './types';

export async function registerAuthHook(app: FastifyInstance, resolver: AuthResolver): Promise<void> {
  app.addHook('preHandler', async (req) => {
    const user = await resolver.resolve(req.headers as Record<string, unknown>);
    if (user) {
      req.user = user;
    }
  });
}
