/**
 * Vercel Serverless Function — 整个 Fastify 应用的入口
 *
 * 模式:用 [...slug] catch-all 路由,把所有 /api/* 请求转给 Fastify。
 * 优点:单文件迁移,不必拆每个路由为独立 function;
 * 限制:cold start 影响所有路径,但 v1 流量低,可接受。
 *
 * Phase 2 流量上来后可以拆为多个 function(每个 function 一个路由组)以减少 cold start 联动。
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../server/app';

let appPromise: Promise<FastifyInstance> | null = null;

async function getApp(): Promise<FastifyInstance> {
  if (!appPromise) {
    appPromise = buildApp({ logger: false }).then(async (a) => {
      await a.ready();
      return a;
    });
  }
  return appPromise;
}

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  const app = await getApp();
  app.server.emit('request', req, res);
}

// Vercel 配置:让该函数处理所有 /api/* 路径
export const config = {
  api: {
    bodyParser: false // Fastify 自己解析 body
  }
};
