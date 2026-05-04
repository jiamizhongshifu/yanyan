/**
 * /api/v1/yan-score/today — Yan-Score 揭晓
 *
 * U7 实施:占位 stub,基于"是否做过今早打卡"返回简单火分(无完整 4 Part 算法)。
 * U8 实施:替换为完整 Yan-Score v0 算法(食物 50% + 体感 30% + 环境 15% + 步数 5%)。
 *
 * 返回结构稳定,U7 → U8 切换不破坏前端契约。
 */

import type { FastifyInstance } from 'fastify';
import { requireUser } from '../../auth';
import {
  PgSymptomStore,
  todayDateString,
  type SymptomStore
} from '../../services/symptoms';
import { decryptField } from '../../crypto/envelope';
import { withClient } from '../../db/client';
import type { SymptomCheckinPayload } from '../../services/symptoms';
import { effectiveSeverityMap, SYMPTOM_DIMENSION_LEVELS, SYMPTOM_DIMENSIONS } from '../../services/symptoms/types';

export type FireLevel = '平' | '微火' | '中火' | '大火';

export interface YanScoreToday {
  level: FireLevel;
  score: number;
  breakdown: {
    food: number;
    symptom: number;
    env: number;
    activity: number;
  };
  /** U7 占位标志 — 客户端可显示"占位算法,U8 替换"提示 */
  isPlaceholder: boolean;
}

export interface RegisterYanScoreOptions {
  deps?: {
    store?: SymptomStore;
    getUserDek?: (userId: string) => Promise<string | null>;
  };
}

async function defaultGetUserDek(userId: string): Promise<string | null> {
  return await withClient(async (c) => {
    const r = await c.query<{ dek_ciphertext_b64: string }>(
      `SELECT dek_ciphertext_b64 FROM users WHERE id = $1 AND deleted_at IS NULL`,
      [userId]
    );
    return r.rowCount === 0 ? null : r.rows[0].dek_ciphertext_b64;
  });
}

function scoreToLevel(score: number): FireLevel {
  if (score < 25) return '平';
  if (score < 50) return '微火';
  if (score < 75) return '中火';
  return '大火';
}

/**
 * U7 占位算法:
 *   - 没今早打卡 → null(客户端提示"明早打卡后揭晓")
 *   - 有打卡 → 用 SymptomPart 的简单加权(各维度严重度 / 该维度 max 档位 * 100,平均)
 *   - 其他 Part 暂为 0(U8 接入后填)
 */
async function computeYanScorePlaceholder(
  store: SymptomStore,
  userId: string,
  date: string,
  getUserDek: (userId: string) => Promise<string | null>
): Promise<YanScoreToday | null> {
  const row = await store.findByDate(userId, date, 'next_morning');
  if (!row) return null;

  const dek = await getUserDek(userId);
  if (!dek) return null;

  const blind = await decryptField<SymptomCheckinPayload>(userId, dek, row.blindInputCiphertext);
  const severityMap = effectiveSeverityMap(blind);

  let symptomTotal = 0;
  let count = 0;
  for (const dim of SYMPTOM_DIMENSIONS) {
    const sev = severityMap[dim];
    if (sev != null) {
      const max = SYMPTOM_DIMENSION_LEVELS[dim];
      symptomTotal += (sev / max) * 100;
      count++;
    }
  }
  const symptomPart = count === 0 ? 0 : symptomTotal / count;
  const score = Math.round(symptomPart * 0.30 * 10) / 10; // U7 仅 SymptomPart 30% 权重展示
  const level = scoreToLevel(score);

  return {
    level,
    score,
    breakdown: { food: 0, symptom: Math.round(symptomPart * 10) / 10, env: 0, activity: 0 },
    isPlaceholder: true
  };
}

export async function registerYanScoreRoutes(app: FastifyInstance, opts: RegisterYanScoreOptions = {}): Promise<void> {
  const store = opts.deps?.store ?? new PgSymptomStore();
  const getUserDek = opts.deps?.getUserDek ?? defaultGetUserDek;

  app.get('/yan-score/today', async (req, reply) => {
    const user = requireUser(req, reply);
    if (!user) return;
    const date = todayDateString();
    const result = await computeYanScorePlaceholder(store, user.userId, date, getUserDek);
    if (!result) {
      // 客户端拿到 hasCheckin=false → 显示"明早打卡后揭晓你的首份火分"(R19)
      return { ok: true, hasCheckin: false };
    }
    return { ok: true, hasCheckin: true, ...result };
  });
}
