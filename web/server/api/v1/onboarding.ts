/**
 * /api/v1 onboarding 相关端点
 *
 * 端点:
 *   POST /users               — wx.login code → 创建/查找用户 → 返回 userId
 *   POST /users/me/baseline   — 保存 onboarding 7 维度症状频次 + 反向定位选项
 */

import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import {
  DevCodeToSessionResolver,
  PgUserStore,
  loginOrCreate,
  saveBaseline,
  ensureUser,
  REVERSE_FILTER_CHOICES,
  SYMPTOM_DIMENSIONS,
  SYMPTOM_FREQUENCY,
  inferInitialFireLevel,
  type CodeToSessionResolver,
  type OnboardingBaseline,
  type UsersDeps,
  type UserStore
} from '../../services/users';
import { getKms } from '../../crypto/kms';
import { requireUser } from '../../auth';

const LoginBody = z.object({ code: z.string().min(1) });

const BaselineBody = z.object({
  reverseFilterChoice: z.enum(REVERSE_FILTER_CHOICES),
  symptomsFrequency: z.record(z.enum(SYMPTOM_DIMENSIONS), z.enum(SYMPTOM_FREQUENCY))
});

export interface RegisterOnboardingOptions {
  /** 测试时可注入 fake store + fake resolver + fake kms */
  deps?: { store?: UserStore; resolver?: CodeToSessionResolver };
}

export async function registerOnboardingRoutes(app: FastifyInstance, opts: RegisterOnboardingOptions = {}): Promise<void> {
  const deps: UsersDeps = {
    store: opts.deps?.store ?? new PgUserStore(),
    kms: getKms(),
    resolver: opts.deps?.resolver ?? new DevCodeToSessionResolver()
  };

  app.post('/users', async (req, reply) => {
    const parsed = LoginBody.safeParse(req.body);
    if (!parsed.success) {
      reply.code(400);
      return { ok: false, error: 'invalid_body', issues: parsed.error.issues };
    }
    const result = await loginOrCreate(deps, parsed.data.code);
    return { ok: true, ...result };
  });

  /**
   * Post-pivot:Supabase Auth 创建 auth.users 后,客户端调此端点确保
   * public.users.<id> 存在,生成 DEK。幂等。
   */
  app.post('/users/me/ensure', async (req, reply) => {
    const { requireUser } = await import('../../auth');
    const user = requireUser(req, reply);
    if (!user) return;
    const result = await ensureUser(deps, user.userId);
    return { ok: true, ...result };
  });

  app.post('/users/me/baseline', async (req, reply) => {
    const user = requireUser(req, reply);
    if (!user) return;
    const parsed = BaselineBody.safeParse(req.body);
    if (!parsed.success) {
      reply.code(400);
      return { ok: false, error: 'invalid_body', issues: parsed.error.issues };
    }
    const baseline: OnboardingBaseline = parsed.data;
    await saveBaseline(deps, user.userId, baseline);
    const initial = inferInitialFireLevel(baseline);
    return { ok: true, initialFireLevel: initial.level, ratio: initial.ratio };
  });
}
