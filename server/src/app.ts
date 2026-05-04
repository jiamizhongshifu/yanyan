/**
 * Fastify 应用工厂
 *
 * 分离 build vs listen,便于测试时 inject 而无需真正监听端口。
 */

import Fastify, { FastifyInstance } from 'fastify';
import { registerV1 } from './api/v1';

export interface BuildAppOptions {
  logger?: boolean;
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

  await app.register(registerV1, { prefix: '/api/v1' });

  return app;
}
