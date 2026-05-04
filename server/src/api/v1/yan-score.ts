/**
 * /api/v1/yan-score/today — Yan-Score v0 算法(U8 实施)
 *
 * 替换 U7 占位实现:接入 4 Part 加权 + 缺失重分配 + <2 Part 返回 null。
 *
 * 响应形态:
 *   - hasCheckin=false:今日没打卡也没餐食(任一 Part 都缺)→ UI 提示打卡
 *   - hasCheckin=true + result=null:可用 Part < 2 / 重分配超上限 → UI 提示"数据还不够"
 *   - hasCheckin=true + 完整 result:正常返回 score / level / breakdown / effectiveWeights
 */

import type { FastifyInstance } from 'fastify';
import { requireUser } from '../../auth';
import { withClient } from '../../db/client';
import {
  PgSymptomStore,
  todayDateString,
  type SymptomStore
} from '../../services/symptoms';
import {
  computeYanScoreForDay,
  type ScoreDeps,
  type YanScoreResult
} from '../../services/score';
import type { ActivitySnapshot, DailyMealAggregate, EnvSnapshot } from '../../services/score/parts';

export interface RegisterYanScoreOptions {
  deps?: {
    symptomStore?: SymptomStore;
    getUserDek?: (userId: string) => Promise<string | null>;
    /** 测试 / U9 接入前可注入 */
    loadDailyMealAggregate?: (userId: string, date: string) => Promise<DailyMealAggregate>;
    loadEnvSnapshot?: (userId: string, date: string) => Promise<EnvSnapshot | null>;
    loadActivitySnapshot?: (userId: string, date: string) => Promise<ActivitySnapshot | null>;
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

/** 标准化响应,无论 hasCheckin/result 状态字段稳定 */
interface ResponseBody {
  ok: true;
  hasCheckin: boolean;
  result: YanScoreResult | null;
  partScores: { food: number | null; symptom: number | null; env: number | null; activity: number | null };
  /** 当 result=null 时告诉前端为什么 */
  unavailableReason?: 'insufficient_parts' | 'no_data';
}

export async function registerYanScoreRoutes(app: FastifyInstance, opts: RegisterYanScoreOptions = {}): Promise<void> {
  const symptomStore = opts.deps?.symptomStore ?? new PgSymptomStore();
  const getUserDek = opts.deps?.getUserDek ?? defaultGetUserDek;
  const deps: ScoreDeps = {
    symptomStore,
    getUserDek,
    loadDailyMealAggregate: opts.deps?.loadDailyMealAggregate,
    loadEnvSnapshot: opts.deps?.loadEnvSnapshot,
    loadActivitySnapshot: opts.deps?.loadActivitySnapshot
  };

  app.get('/yan-score/today', async (req, reply) => {
    const user = requireUser(req, reply);
    if (!user) return;
    const date = todayDateString();
    const { hasAny, result, partScores } = await computeYanScoreForDay(deps, user.userId, date);

    const body: ResponseBody = {
      ok: true,
      hasCheckin: hasAny,
      result,
      partScores
    };
    if (!hasAny) body.unavailableReason = 'no_data';
    else if (!result) body.unavailableReason = 'insufficient_parts';
    return body;
  });
}
