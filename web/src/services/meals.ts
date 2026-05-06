/**
 * Meals 客户端服务
 *
 * 流程:
 *   1. 客户端选/拍照 → File
 *   2. compressImage(file) → Blob (~1024 max edge, JPG quality 0.85)
 *   3. uploadPhoto(userId, blob) → storageKey('users/<userId>/<mealId>/<ts>.jpg')
 *   4. POST /meals { storageKey } → server LLM 识别 + 入库
 *   5. POST /meals/:id/feedback (用户标记误识别 / 反例)
 */

import { getSupabase } from './supabase';
import { request } from './api';
import { getCurrentAccessToken } from './auth';

const FOOD_PHOTOS_BUCKET = 'food-photos';
const MAX_DIMENSION = 768; // 跨境上传 + base64 给 LLM,小一点更稳
const JPG_QUALITY = 0.82;

export interface FoodClassificationLite {
  foodCanonicalName: string;
  tcmLabel: '发' | '温和' | '平';
  tcmProperty: '寒' | '凉' | '平' | '温' | '热';
  diiScore: number | null;
  agesScore: number | null;
  gi: number | null;
  addedSugarG: number | null;
  carbsG: number | null;
  citations: Array<{ source: 'canon' | 'paper' | 'modern_nutrition'; reference: string; excerpt?: string }>;
}

export interface MealItem {
  name: string;
  confidence: number;
  /** LLM 返回的主料(2-6 个 canonical 食材名);用于前端渲染主料行 */
  ingredients?: string[];
  /** 每个主料对应的 DB 分类(matched 或 null) */
  ingredientDetails?: Array<{ name: string; classification: FoodClassificationLite | null }>;
  classification: FoodClassificationLite | null;
}

export type FireLevel = '平' | '微火' | '中火' | '大火';

export interface MealResult {
  mealId: string;
  fireScore: number;
  level: FireLevel;
  items: MealItem[];
  unrecognizedNames: string[];
  modelVersion: string;
}

/**
 * 客户端图片压缩 — 用 canvas 缩到 max edge 1024,JPG quality 0.85
 * 平均把 4-8MB 拍照缩到 < 500KB,加快上传 + 节省存储
 */
export async function compressImage(file: File): Promise<Blob> {
  return await new Promise<Blob>((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const ratio = Math.min(1, MAX_DIMENSION / Math.max(img.width, img.height));
      const w = Math.round(img.width * ratio);
      const h = Math.round(img.height * ratio);
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('canvas_context_unavailable'));
        return;
      }
      ctx.drawImage(img, 0, 0, w, h);
      canvas.toBlob(
        (blob) => {
          if (blob) resolve(blob);
          else reject(new Error('canvas_to_blob_failed'));
        },
        'image/jpeg',
        JPG_QUALITY
      );
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('image_decode_failed'));
    };
    img.src = url;
  });
}

/**
 * 上传到 Supabase Storage 并返回 storage key
 * Storage RLS 策略保证用户只能写入自己的 users/<userId>/* 前缀
 */
export async function uploadPhoto(userId: string, blob: Blob): Promise<string | null> {
  const ts = Date.now();
  const mealId = crypto.randomUUID();
  const key = `users/${userId}/${mealId}/${ts}.jpg`;
  const { error } = await getSupabase()
    .storage.from(FOOD_PHOTOS_BUCKET)
    .upload(key, blob, { contentType: 'image/jpeg', upsert: false });
  if (error) return null;
  return key;
}

export async function postMeal(storageKey: string): Promise<
  | { kind: 'ok'; data: MealResult }
  | { kind: 'low_confidence'; message: string }
  | { kind: 'recognition_failed'; message: string }
  | { kind: 'error'; message: string }
> {
  const token = await getCurrentAccessToken();
  if (!token) return { kind: 'error', message: '账号未登录,请重新登录。' };
  const res = await request<MealResult & { ok: true }>({
    url: '/meals',
    method: 'POST',
    authToken: token,
    data: { storageKey },
    timeoutMs: 55_000 // server-side LLM 25s+25s+overhead,client 略小于 Vercel 60s function 上限
  });
  if (res.ok) return { kind: 'ok', data: res.data };
  if (res.status === 422) return { kind: 'low_confidence', message: '看不太清,要不要补一张?' };
  if (res.status === 503) return { kind: 'recognition_failed', message: '识别忙,稍后再试。' };
  return { kind: 'error', message: res.fallbackMessage };
}

/**
 * 拉取或生成餐食插画
 *   1. GET /meals/:id/illustration → 命中缓存秒返
 *   2. miss → POST 触发生成(异步轮询 + 上传 Supabase ~15-30s)
 *   3. 任何环节失败返回 null,UI 会兜底到 mascot
 */
export async function fetchMealIllustration(mealId: string, foodNames: string[]): Promise<string | null> {
  const token = await getCurrentAccessToken();
  if (!token) return null;

  // 先 GET 看缓存
  const getRes = await request<{ ok: true; url: string }>({
    url: `/meals/${mealId}/illustration`,
    method: 'GET',
    authToken: token
  });
  if (getRes.ok && getRes.data?.url) return getRes.data.url;

  // miss → POST 触发生成,server 会同步等到结果返回
  const postRes = await request<{ ok: true; url: string }>({
    url: `/meals/${mealId}/illustration`,
    method: 'POST',
    authToken: token,
    data: { foodNames },
    timeoutMs: 55_000 // 与 server 的 45s budget + 网络 buffer 对齐
  });
  if (postRes.ok && postRes.data?.url) return postRes.data.url;
  return null;
}

/**
 * 用户编辑后整体提交 items,server 重新分类 + 算分 + 落库,返回新的 MealResult
 */
export async function updateMealItems(
  mealId: string,
  items: Array<{ name: string; confidence?: number; ingredients?: string[] }>
): Promise<MealResult | null> {
  const token = await getCurrentAccessToken();
  if (!token) return null;
  const res = await request<MealResult & { ok: true }>({
    url: `/meals/${mealId}/items`,
    method: 'PUT',
    authToken: token,
    data: { items, modelVersion: 'user-edited' },
    timeoutMs: 30_000
  });
  if (res.ok) return res.data;
  return null;
}

export type MealFeedbackKind =
  | 'misrecognized'
  | 'no_reaction'
  | 'thumbs_up'
  | 'thumbs_down';

export async function postMealFeedback(
  mealId: string,
  itemName: string,
  kind: MealFeedbackKind,
  note?: string
): Promise<boolean> {
  const token = await getCurrentAccessToken();
  if (!token) return false;
  const res = await request({
    url: `/meals/${mealId}/feedback`,
    method: 'POST',
    authToken: token,
    data: { itemName, kind, ...(note ? { note } : {}) }
  });
  return res.ok;
}
