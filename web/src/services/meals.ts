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
const MAX_DIMENSION = 1024;
const JPG_QUALITY = 0.85;

export interface MealItem {
  name: string;
  confidence: number;
  classification: {
    foodCanonicalName: string;
    tcmLabel: '发' | '温和' | '平';
    tcmProperty: '寒' | '凉' | '平' | '温' | '热';
    diiScore: number | null;
    agesScore: number | null;
    gi: number | null;
    citations: Array<{ source: 'canon' | 'paper' | 'modern_nutrition'; reference: string; excerpt?: string }>;
  } | null;
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
    data: { storageKey }
  });
  if (res.ok) return { kind: 'ok', data: res.data };
  if (res.status === 422) return { kind: 'low_confidence', message: '看不太清,要不要补一张?' };
  if (res.status === 503) return { kind: 'recognition_failed', message: '识别忙,稍后再试。' };
  return { kind: 'error', message: res.fallbackMessage };
}

export async function postMealFeedback(
  mealId: string,
  itemName: string,
  kind: 'misrecognized' | 'no_reaction'
): Promise<boolean> {
  const token = await getCurrentAccessToken();
  if (!token) return false;
  const res = await request({
    url: `/meals/${mealId}/feedback`,
    method: 'POST',
    authToken: token,
    data: { itemName, kind }
  });
  return res.ok;
}
