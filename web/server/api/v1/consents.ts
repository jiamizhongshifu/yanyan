/**
 * /api/v1/consents 路由
 *
 * 端点:
 *   GET  /consents/required           — 当前 consent_version_required(供小程序启动时比对)
 *   GET  /users/me/consent            — 当前用户的同意状态(needsReconsent 触发拦截)
 *   POST /consents                    — 记录一次同意事件(N 个 scope)
 *   POST /consents/revoke             — 撤回同意 + KMS 吊销 + 软删除
 *
 * 注:鉴权 middleware 由 U3 之后的某个 unit 接入(wx.login → token);v1 这里通过
 *     header X-User-Id 接收(测试 / 占位用)。
 */

import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import {
  CONSENT_SCOPES,
  CURRENT_CONSENT_VERSION_REQUIRED,
  recordConsent,
  revokeConsent,
  getConsentStatus,
  PgConsentStore,
  type ConsentDeps
} from '../../services/consents';
import { getKms, hashClientIp } from '../../crypto/kms';
import { requireUser } from '../../auth';

const RecordConsentBody = z.object({
  scopes: z.array(z.enum(CONSENT_SCOPES)).min(1),
  consentVersion: z.number().int().positive()
});

export interface RegisterConsentsOptions {
  /** 测试时可注入 fake store + fake kms;省略则使用 PgConsentStore + 全局 KMS */
  deps?: ConsentDeps;
}

export async function registerConsentsRoutes(app: FastifyInstance, opts: RegisterConsentsOptions = {}): Promise<void> {
  const deps: ConsentDeps = opts.deps ?? { store: new PgConsentStore(), kms: getKms() };

  app.get('/consents/required', async () => {
    return { ok: true, consentVersionRequired: CURRENT_CONSENT_VERSION_REQUIRED };
  });

  app.get('/users/me/consent', async (req, reply) => {
    const user = requireUser(req, reply);
    if (!user) return;
    const status = await getConsentStatus(deps, user.userId);
    if (!status) {
      reply.code(404);
      return { ok: false, error: 'user_not_found' };
    }
    return { ok: true, ...status };
  });

  app.post('/consents', async (req, reply) => {
    const user = requireUser(req, reply);
    if (!user) return;
    const parsed = RecordConsentBody.safeParse(req.body);
    if (!parsed.success) {
      reply.code(400);
      return { ok: false, error: 'invalid_body', issues: parsed.error.issues };
    }
    const ipHash = req.ip ? hashClientIp(req.ip) : undefined;
    await recordConsent(deps, {
      userId: user.userId,
      scopes: parsed.data.scopes,
      consentVersion: parsed.data.consentVersion,
      userAgent: req.headers['user-agent'] as string | undefined,
      clientIpHash: ipHash
    });
    return { ok: true };
  });

  app.post('/consents/revoke', async (req, reply) => {
    const user = requireUser(req, reply);
    if (!user) return;
    const result = await revokeConsent(deps, user.userId);
    return { ok: true, ...result };
  });
}
