/**
 * ConsentStore — 数据访问接口
 *
 * 为 service 层做依赖注入:生产用 PgConsentStore,测试用 fake 实现。
 * 这样 service 逻辑(recordConsent / revokeConsent / hardDeleteSweep)
 * 可以在不依赖真实 PG 的情况下被单元测试覆盖。
 */

import type { PoolClient } from 'pg';
import { withClient } from '../../db/client';
import type { ConsentScope, RecordConsentParams } from './types';

export interface InsertedConsentRow {
  userId: string;
  scope: ConsentScope;
  consentVersion: number;
  userAgent?: string;
  clientIpHash?: string;
}

export interface UserConsentRow {
  userId: string;
  consentVersionGranted: number;
  deletedAt: Date | null;
}

export interface ConsentStore {
  /** 在事务内写入 N 条 consent 行 + 更新 users.consent_version_granted */
  recordConsent(params: RecordConsentParams): Promise<void>;
  /** 读取用户当前 granted 版本 */
  getUserConsentStatus(userId: string): Promise<UserConsentRow | null>;
  /** 软删除:打 deleted_at 时间戳;不真删 */
  softDeleteUser(userId: string): Promise<void>;
  /** 硬删除:由 cron 在保留期后调用 */
  hardDeleteUser(userId: string): Promise<void>;
  /** 找出所有过保留期、可硬删除的用户 id */
  findUsersForHardDelete(deletedBefore: Date): Promise<string[]>;
}

export class PgConsentStore implements ConsentStore {
  async recordConsent(params: RecordConsentParams): Promise<void> {
    await withClient(async (client) => {
      await client.query('BEGIN');
      try {
        for (const scope of params.scopes) {
          await client.query(
            `INSERT INTO privacy_consents
               (user_id, scope, consent_version, user_agent, client_ip_hash)
             VALUES ($1, $2, $3, $4, $5)`,
            [params.userId, scope, params.consentVersion, params.userAgent ?? null, params.clientIpHash ?? null]
          );
        }
        await client.query(
          `UPDATE users
             SET consent_version_granted = GREATEST(consent_version_granted, $2),
                 updated_at = now()
           WHERE id = $1`,
          [params.userId, params.consentVersion]
        );
        await client.query('COMMIT');
      } catch (err) {
        await client.query('ROLLBACK');
        throw err;
      }
    });
  }

  async getUserConsentStatus(userId: string): Promise<UserConsentRow | null> {
    return await withClient(async (client) => {
      const result = await client.query<{ id: string; consent_version_granted: number; deleted_at: Date | null }>(
        `SELECT id, consent_version_granted, deleted_at FROM users WHERE id = $1`,
        [userId]
      );
      if (result.rowCount === 0) return null;
      const row = result.rows[0];
      return {
        userId: row.id,
        consentVersionGranted: row.consent_version_granted,
        deletedAt: row.deleted_at
      };
    });
  }

  async softDeleteUser(userId: string): Promise<void> {
    await withClient((c) => c.query(`UPDATE users SET deleted_at = now(), updated_at = now() WHERE id = $1`, [userId]));
  }

  async hardDeleteUser(userId: string): Promise<void> {
    await withClient(async (client) => {
      await client.query('BEGIN');
      try {
        // 顺序:子表先删,users 最后(外键依赖)
        await client.query(`DELETE FROM analytics_events WHERE user_id = $1`, [userId]);
        await client.query(`DELETE FROM yan_score_daily WHERE user_id = $1`, [userId]);
        await client.query(`DELETE FROM symptoms WHERE user_id = $1`, [userId]);
        await client.query(`DELETE FROM meals WHERE user_id = $1`, [userId]);
        await client.query(`DELETE FROM privacy_consents WHERE user_id = $1`, [userId]);
        await client.query(`DELETE FROM users WHERE id = $1`, [userId]);
        await client.query('COMMIT');
      } catch (err) {
        await client.query('ROLLBACK');
        throw err;
      }
    });
  }

  async findUsersForHardDelete(deletedBefore: Date): Promise<string[]> {
    return await withClient(async (client) => {
      const result = await client.query<{ id: string }>(
        `SELECT id FROM users WHERE deleted_at IS NOT NULL AND deleted_at < $1`,
        [deletedBefore]
      );
      return result.rows.map((r) => r.id);
    });
  }
}

/** 公开的便捷函数,允许传入测试用 mock client(可选) */
export async function withReadOnlyClient<T>(fn: (c: PoolClient) => Promise<T>): Promise<T> {
  return withClient(fn);
}
