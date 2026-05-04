/**
 * Fastify 应用工厂
 *
 * 分离 build vs listen,便于测试时 inject 而无需真正监听端口。
 */

import Fastify, { FastifyInstance } from 'fastify';
import { registerV1, type V1Options } from './api/v1';
import { registerAuthHook } from './auth/middleware';
import { getDefaultAuthResolver, type AuthResolver } from './auth';

export interface BuildAppOptions {
  logger?: boolean;
  v1?: V1Options;
  /** 测试时可注入(默认走 getDefaultAuthResolver,接受 Supabase JWT + dev header in non-prod) */
  authResolver?: AuthResolver;
}

export async function buildApp(opts: BuildAppOptions = {}): Promise<FastifyInstance> {
  const app = Fastify({
    logger: opts.logger ?? false,
    // 上传食物图片走 OSS 直传,后端 API body 不会很大
    bodyLimit: 1 * 1024 * 1024 // 1 MiB
  });

  // 全局错误格式
  app.setErrorHandler((err, _req, reply) => {
    const status = err.statusCode ?? 500;
    reply.code(status).send({
      ok: false,
      error: err.code ?? 'internal_error',
      message: status >= 500 ? '服务忙,请稍后再试' : err.message
    });
  });

  // 404 也走统一 envelope
  app.setNotFoundHandler((req, reply) => {
    reply.code(404).send({
      ok: false,
      error: 'not_found',
      message: `Route ${req.method}:${req.url} not found`
    });
  });

  // 鉴权 preHandler:解析 Authorization Bearer JWT(生产)或 X-User-Id(dev/test 补充路径)
  await registerAuthHook(app, opts.authResolver ?? getDefaultAuthResolver());

  const v1Opts = opts.v1 ?? {};
  await app.register(async (scoped) => {
    await registerV1(scoped, v1Opts);
  }, { prefix: '/api/v1' });

  return app;
}
