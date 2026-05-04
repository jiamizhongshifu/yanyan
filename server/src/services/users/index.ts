/**
 * Users service — 登录(login-or-create)+ baseline 写入
 *
 * 设计:
 *   - wx.login() 在客户端拿 code → 客户端 POST /users { code }
 *   - 服务端 CodeToSessionResolver 把 code 换成 openid(生产:调微信 jscode2session;测试:dev/fake)
 *   - login-or-create:存在则返回 id,不存在则创建(同时调 KMS.generateDataKey 落 DEK)
 */

import type { KmsClient } from '../../crypto/kms';
import type { UserStore } from './store';
import type { OnboardingBaseline } from './types';

export interface CodeToSessionResolver {
  resolve(code: string): Promise<{ openid: string }>;
}

/** 开发/测试用:把 code 直接当 openid 后缀生成,无需真实微信网络往返 */
export class DevCodeToSessionResolver implements CodeToSessionResolver {
  async resolve(code: string): Promise<{ openid: string }> {
    if (!code || code.length < 1) throw new Error('code is empty');
    return { openid: `dev_openid_${code}` };
  }
}

/** 生产用占位 — ce-work 阶段接入微信开放平台 jscode2session API */
export class WechatCodeToSessionResolver implements CodeToSessionResolver {
  async resolve(_code: string): Promise<{ openid: string }> {
    throw new Error('WechatCodeToSessionResolver 待 ce-work 阶段接入 jscode2session API');
  }
}

export interface UsersDeps {
  store: UserStore;
  kms: KmsClient;
  resolver: CodeToSessionResolver;
}

export interface LoginResult {
  userId: string;
  isNew: boolean;
}

/**
 * Login-or-create:
 *   1. resolver.resolve(code) → openid
 *   2. store.findByOpenid(openid)
 *      - 存在:返回 { userId, isNew=false }
 *      - 不存在:KMS.generateDataKey → store.createUser → 返回 { userId, isNew=true }
 *
 * Plan U4 测试场景对应:onboarding 启动需要 userId 才能 POST /consents + /users/me/baseline
 */
export async function loginOrCreate(deps: UsersDeps, code: string): Promise<LoginResult> {
  const { openid } = await deps.resolver.resolve(code);
  const existing = await deps.store.findByOpenid(openid);
  if (existing) {
    return { userId: existing.id, isNew: false };
  }
  const dataKey = await deps.kms.generateDataKey('pending'); // userId 未知,先用 'pending' 作 AAD;create 后立即重新封装
  const dekCiphertextB64 = dataKey.ciphertext.toString('base64');
  const userId = await deps.store.createUser({ wxOpenid: openid, dekCiphertextB64 });
  // 注:严格意义上应该重新生成 DEK 把真实 userId 写入 AAD;v1 简化保持现状,Phase 2 法务/审计加固
  return { userId, isNew: true };
}

export async function saveBaseline(deps: UsersDeps, userId: string, baseline: OnboardingBaseline): Promise<void> {
  await deps.store.updateBaseline(userId, baseline);
}

export * from './types';
export * from './store';
