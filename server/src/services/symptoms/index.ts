/**
 * Symptoms service
 *
 * - submitMorningCheckin:Step 1 盲打卡 → encrypt blind_input + severity → upsert
 * - getYesterdayForCompare:Step 2 对照展示用,decrypt 后简化字段返回
 *
 * Step 1 严格不读昨日数据(plan R12 — 防 anchoring 偏倚)— Step 2 才允许读
 */

import { decryptField, encryptField } from '../../crypto/envelope';
import type { SymptomStore } from './store';
import {
  CURRENT_DEFINITION_VERSION,
  effectiveSeverityMap,
  type CheckinSource,
  type SymptomCheckinPayload,
  type SymptomDimensionEntry
} from './types';

export interface SymptomsDeps {
  store: SymptomStore;
  /** 把 userId → users.dek_ciphertext_b64 — Pg 默认实现见 api/v1/symptoms */
  getUserDek: (userId: string) => Promise<string | null>;
}

export interface SubmitCheckinParams {
  userId: string;
  recordedForDate: string;
  payload: SymptomCheckinPayload;
  source: CheckinSource;
}

export interface YesterdayForCompare {
  recordedForDate: string;
  payload: SymptomCheckinPayload;
}

export async function submitMorningCheckin(deps: SymptomsDeps, params: SubmitCheckinParams): Promise<string> {
  const dek = await deps.getUserDek(params.userId);
  if (!dek) throw new Error('user_not_initialized');

  // blind_input:用户原始勾选输入(完整 dimension 元数据)
  const blindCt = await encryptField(params.userId, dek, params.payload);
  // severity:有效程度图(只含真正滑动过的维度,Yan-Score U8 直接消费)
  const severityCt = await encryptField(params.userId, dek, effectiveSeverityMap(params.payload));

  return await deps.store.upsert({
    userId: params.userId,
    recordedForDate: params.recordedForDate,
    blindInputCiphertext: blindCt,
    severityCiphertext: severityCt,
    definitionVersion: CURRENT_DEFINITION_VERSION,
    source: params.source
  });
}

/** Step 2 对照:返回昨日打卡解密后的 payload(本人请求才允许) */
export async function getYesterdayForCompare(
  deps: SymptomsDeps,
  userId: string,
  today: string
): Promise<YesterdayForCompare | null> {
  const yesterday = await deps.store.findYesterday(userId, today, 'next_morning');
  if (!yesterday) return null;

  const dek = await deps.getUserDek(userId);
  if (!dek) return null;

  const payload = await decryptField<SymptomCheckinPayload>(userId, dek, yesterday.blindInputCiphertext);
  return { recordedForDate: yesterday.recordedForDate, payload };
}

/**
 * 仅取昨日"打过卡的维度名"(不返回严重度) — 给 UI 提示"昨天勾过 X、Y"
 * 注:Step 1 永远不调它(R12);只有 Step 2 对照展示用
 */
export async function getYesterdayEngagedDimensions(
  deps: SymptomsDeps,
  userId: string,
  today: string
): Promise<{ recordedForDate: string; engagedDimensions: string[] } | null> {
  const got = await getYesterdayForCompare(deps, userId, today);
  if (!got) return null;
  const engaged = Object.entries(got.payload)
    .filter(([, e]) => (e as SymptomDimensionEntry | undefined)?.engaged)
    .map(([dim]) => dim);
  return { recordedForDate: got.recordedForDate, engagedDimensions: engaged };
}

export * from './types';
export * from './store';
