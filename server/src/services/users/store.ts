/**
 * UserStore — 用户表读写抽象
 *
 * 同 ConsentStore 模式:接口 + Pg 实现,测试用 fake。
 */

import { withClient } from '../../db/client';
import type { OnboardingBaseline } from './types';

export interface UserRow {
  id: string;
  wxOpenid: string;
  consentVersionGranted: number;
  baselineSummary: Record<string, unknown>;
  deletedAt: Date | null;
}

export interface UserStore {
  findByOpenid(openid: string): Promise<UserRow | null>;
  /** 创建新用户;返回 newly created id */
  createUser(params: { wxOpenid: string; dekCiphertextB64: string }): Promise<string>;
  /** 写入 onboarding baseline_summary */
  updateBaseline(userId: string, baseline: OnboardingBaseline): Promise<void>;
}

export class PgUserStore implements UserStore {
  async findByOpenid(openid: string): Promise<UserRow | null> {
    return await withClient(async (client) => {
      const r = await client.query<{
        id: string;
        wx_openid: string;
        consent_version_granted: number;
        baseline_summary: Record<string, unknown>;
        deleted_at: Date | null;
      }>(
        `SELECT id, wx_openid, consent_version_granted, baseline_summary, deleted_at
           FROM users
          WHERE wx_openid = $1 AND deleted_at IS NULL`,
        [openid]
      );
      if (r.rowCount === 0) return null;
      const row = r.rows[0];
      return {
        id: row.id,
        wxOpenid: row.wx_openid,
        consentVersionGranted: row.consent_version_granted,
        baselineSummary: row.baseline_summary,
        deletedAt: row.deleted_at
      };
    });
  }

  async createUser(params: { wxOpenid: string; dekCiphertextB64: string }): Promise<string> {
    return await withClient(async (client) => {
      const r = await client.query<{ id: string }>(
        `INSERT INTO users (wx_openid, dek_ciphertext_b64) VALUES ($1, $2) RETURNING id`,
        [params.wxOpenid, params.dekCiphertextB64]
      );
      return r.rows[0].id;
    });
  }

  async updateBaseline(userId: string, baseline: OnboardingBaseline): Promise<void> {
    await withClient((c) =>
      c.query(`UPDATE users SET baseline_summary = $2, updated_at = now() WHERE id = $1`, [userId, baseline])
    );
  }
}
