/**
 * Smoke test:Fastify 应用可启动 + /health 不依赖 DB 也返回 200
 *
 * 对应 plan U2 测试场景 "Happy path: 启动 server → /health 返回 200"
 *
 * 使用 fastify.inject(),不真正监听端口、不连 DB。
 */

import { buildApp } from '../../server/app';
import type { FastifyInstance } from 'fastify';

describe('U2 smoke / api', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildApp();
  });

  afterAll(async () => {
    await app.close();
  });

  test('GET /api/v1/health returns 200 with service identity', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/health' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ ok: true, service: 'yanyan-server' });
  });

  test('unknown route returns 404 in error envelope', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/does-not-exist' });
    expect(res.statusCode).toBe(404);
    expect(res.json()).toMatchObject({ ok: false });
  });
});
