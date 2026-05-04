/**
 * Consents service — R5b 单独同意 + 撤回 + 硬删除 sweep
 *
 * 撤回流程顺序(plan U3 / Round 2 review 修订):
 *   1. KMS.scheduleKeyDeletion(userId)  — 立即吊销 DEK 解密权限,防止软删除窗口期内部解密
 *   2. evictDekFromCache(userId)         — 清掉应用进程内的明文 DEK 缓存
 *   3. store.softDeleteUser(userId)      — 打 deleted_at 时间戳
 *   4. (30 天后由 cron 触发)store.hardDeleteUser + 数据级 DEK 永久销毁
 *
 * 这个顺序保证:撤回那一刻起,即使运维 / 被攻陷的服务账号尝试解密用户密文字段,KMS 也会拒绝。
 */

import { evictDekFromCache } from '../../crypto/envelope';
import type { KmsClient } from '../../crypto/kms';
import type { ConsentStore } from './store';
import {
  CURRENT_CONSENT_VERSION_REQUIRED,
  HARD_DELETE_RETENTION_DAYS,
  RecordConsentParams,
  ConsentStatus
} from './types';

export interface ConsentDeps {
  store: ConsentStore;
  kms: KmsClient;
}

export interface RevokeResult {
  userId: string;
  kmsRevoked: boolean;
  cacheEvicted: boolean;
  softDeleted: boolean;
}

export interface HardDeleteSweepResult {
  scanned: number;
  hardDeleted: string[];
  errors: Array<{ userId: string; error: string }>;
}

/**
 * 记录一次同意事件 — 在事务内写入 N 个 scope 行 + 更新 users.consent_version_granted
 *
 * Plan U3 测试场景:
 *   Integration: 同意后 privacy_consents 表正确写入(scope=health_data, granted_at, consent_version)
 */
export async function recordConsent(deps: ConsentDeps, params: RecordConsentParams): Promise<void> {
  if (params.scopes.length === 0) {
    throw new Error('recordConsent 至少需要一个 scope');
  }
  await deps.store.recordConsent(params);
}

/**
 * 读取用户当前同意状态;needsReconsent = granted < required
 * 拦截存量用户用(plan Round 2 review:存量用户在新版本生效前被强制拦截)
 */
export async function getConsentStatus(deps: ConsentDeps, userId: string): Promise<ConsentStatus | null> {
  const row = await deps.store.getUserConsentStatus(userId);
  if (!row) return null;
  return {
    required: CURRENT_CONSENT_VERSION_REQUIRED,
    granted: row.consentVersionGranted,
    needsReconsent: row.consentVersionGranted < CURRENT_CONSENT_VERSION_REQUIRED
  };
}

/**
 * 撤回同意 — 立即吊销 KMS + 软删除
 *
 * Plan U3 测试场景:
 *   Edge case: 用户撤回同意后 → 30 天硬删除 cron 触发 → 用户数据完全清除(此函数管前 3 步)
 */
export async function revokeConsent(deps: ConsentDeps, userId: string): Promise<RevokeResult> {
  await deps.kms.scheduleKeyDeletion(userId);
  evictDekFromCache(userId);
  await deps.store.softDeleteUser(userId);
  return {
    userId,
    kmsRevoked: true,
    cacheEvicted: true,
    softDeleted: true
  };
}

/**
 * Hard-delete sweep — 由 cron 每天调用一次,清理已超过保留期的软删除用户
 *
 * 容错策略:单个用户硬删失败时记入 errors,不阻断其他用户的清理。
 *
 * Plan Round 2 review 修订:KMS DEK 在硬删除时永久销毁(LocalKmsStub 已通过 scheduleKeyDeletion
 * 在撤回时持久吊销;阿里云 KMS 接入时此处可调 deleteKey 做最终销毁)。
 */
export async function runHardDeleteSweep(
  deps: ConsentDeps,
  options: { now?: Date; retentionDays?: number } = {}
): Promise<HardDeleteSweepResult> {
  const now = options.now ?? new Date();
  const retentionDays = options.retentionDays ?? HARD_DELETE_RETENTION_DAYS;
  const cutoff = new Date(now.getTime() - retentionDays * 24 * 60 * 60 * 1000);

  const userIds = await deps.store.findUsersForHardDelete(cutoff);
  const result: HardDeleteSweepResult = { scanned: userIds.length, hardDeleted: [], errors: [] };

  for (const userId of userIds) {
    try {
      await deps.store.hardDeleteUser(userId);
      result.hardDeleted.push(userId);
    } catch (err) {
      result.errors.push({ userId, error: err instanceof Error ? err.message : String(err) });
    }
  }
  return result;
}

export * from './types';
export * from './store';
