/**
 * DashScope wanx2.1-t2i-turbo 文生图 — 用于餐食蜡笔风插画
 *
 * 流程(异步任务):
 *   1. POST /aigc/text2image/image-synthesis(header X-DashScope-Async: enable) → task_id
 *   2. GET /tasks/:task_id 轮询直到 SUCCEEDED / FAILED / 超时
 *   3. SUCCEEDED 时下载 results[0].url → 返回 PNG buffer
 *
 * 缓存:由调用方负责(我们用 Supabase Storage `app-assets/illustrations/<mealId>.png`)
 *
 * 失败行为:throw Error,调用方决定是否兜底到默认插画。
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { getConfig } from '../../config';

const SUBMIT_ENDPOINT =
  'https://dashscope.aliyuncs.com/api/v1/services/aigc/text2image/image-synthesis';
const TASK_ENDPOINT_BASE = 'https://dashscope.aliyuncs.com/api/v1/tasks/';
const MODEL = 'wanx2.1-t2i-turbo';
const TOTAL_BUDGET_MS = 45_000;
const POLL_INTERVAL_MS = 2_000;

const ILLUSTRATIONS_BUCKET = 'app-assets';
const ILLUSTRATIONS_PREFIX = 'illustrations/';

function buildSupabase(): SupabaseClient {
  const cfg = getConfig();
  return createClient(cfg.SUPABASE_URL, cfg.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false }
  });
}

export function illustrationStorageKey(mealId: string): string {
  return `${ILLUSTRATIONS_PREFIX}${mealId}.png`;
}

export function illustrationPublicUrl(mealId: string): string {
  const cfg = getConfig();
  return `${cfg.SUPABASE_URL}/storage/v1/object/public/${ILLUSTRATIONS_BUCKET}/${illustrationStorageKey(mealId)}`;
}

/**
 * 检查 Supabase Storage 是否已有缓存的插画
 * 命中 → 返回 public URL;miss → 返回 null
 */
export async function lookupCachedIllustration(mealId: string): Promise<string | null> {
  const sb = buildSupabase();
  const key = illustrationStorageKey(mealId);
  // 用 createSignedUrl(短 TTL)替代 head — supabase-js 没有直接 head;
  // 列出父目录里精确匹配文件名的 entry 来判断存在性
  const { data, error } = await sb.storage
    .from(ILLUSTRATIONS_BUCKET)
    .list(ILLUSTRATIONS_PREFIX, { limit: 1, search: `${mealId}.png` });
  if (error) return null;
  if (data && data.length > 0 && data[0].name === `${mealId}.png`) {
    return illustrationPublicUrl(mealId);
  }
  return null;
}

/** 用食物名构造蜡笔风插画 prompt */
export function buildPrompt(foodNames: string[]): string {
  const names = foodNames.length > 0 ? foodNames.join('、') : '一份家常餐食';
  return [
    '蜡笔手绘风格插画,儿童读物质感,温暖治愈,柔和的色彩与有质感的笔触,',
    `主体是一盘 ${names},俯视视角,放在一个木质托盘上,`,
    '配色以米色 / 浅绿 / 暖橙为主,白色背景,无文字无 logo,正方形构图。'
  ].join('');
}

interface SubmitResp {
  output?: { task_id?: string };
  message?: string;
}

interface TaskResp {
  output?: {
    task_status?: 'PENDING' | 'RUNNING' | 'SUCCEEDED' | 'FAILED' | 'UNKNOWN';
    results?: Array<{ url?: string }>;
    code?: string;
    message?: string;
  };
}

/**
 * 生成餐食插画并写入 Supabase Storage
 * @returns 公开 URL,失败返回 null
 */
export async function generateAndCacheIllustration(
  mealId: string,
  foodNames: string[]
): Promise<string | null> {
  const cfg = getConfig();
  if (!cfg.DASHSCOPE_API_KEY) return null;

  const startedAt = Date.now();
  const prompt = buildPrompt(foodNames);

  // 1. submit task
  let taskId: string;
  try {
    const submitRes = await fetch(SUBMIT_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${cfg.DASHSCOPE_API_KEY}`,
        'X-DashScope-Async': 'enable'
      },
      body: JSON.stringify({
        model: MODEL,
        input: { prompt },
        parameters: { size: '1024*1024', n: 1 }
      })
    });
    if (!submitRes.ok) {
      console.error('[wanx-image] submit non-ok', submitRes.status, await submitRes.text());
      return null;
    }
    const submitJson = (await submitRes.json()) as SubmitResp;
    if (!submitJson.output?.task_id) {
      console.error('[wanx-image] no task_id in submit response', submitJson);
      return null;
    }
    taskId = submitJson.output.task_id;
  } catch (err) {
    console.error('[wanx-image] submit threw', err);
    return null;
  }

  // 2. poll
  let imageUrl: string | null = null;
  while (Date.now() - startedAt < TOTAL_BUDGET_MS) {
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
    try {
      const taskRes = await fetch(TASK_ENDPOINT_BASE + taskId, {
        headers: { Authorization: `Bearer ${cfg.DASHSCOPE_API_KEY}` }
      });
      if (!taskRes.ok) continue;
      const taskJson = (await taskRes.json()) as TaskResp;
      const status = taskJson.output?.task_status;
      if (status === 'SUCCEEDED') {
        imageUrl = taskJson.output?.results?.[0]?.url ?? null;
        break;
      }
      if (status === 'FAILED' || status === 'UNKNOWN') {
        console.error('[wanx-image] task failed', taskJson.output);
        return null;
      }
    } catch (err) {
      console.error('[wanx-image] poll threw', err);
    }
  }
  if (!imageUrl) {
    console.error('[wanx-image] timeout, no image url after', Date.now() - startedAt, 'ms');
    return null;
  }

  // 3. download from DashScope CDN
  let pngBuffer: Buffer;
  try {
    const dl = await fetch(imageUrl);
    if (!dl.ok) {
      console.error('[wanx-image] download non-ok', dl.status);
      return null;
    }
    pngBuffer = Buffer.from(await dl.arrayBuffer());
  } catch (err) {
    console.error('[wanx-image] download threw', err);
    return null;
  }

  // 4. upload to Supabase Storage
  try {
    const sb = buildSupabase();
    const key = illustrationStorageKey(mealId);
    const { error } = await sb.storage.from(ILLUSTRATIONS_BUCKET).upload(key, pngBuffer, {
      contentType: 'image/png',
      upsert: true,
      cacheControl: '604800' // 7 day public cache
    });
    if (error) {
      console.error('[wanx-image] supabase upload', error);
      return null;
    }
  } catch (err) {
    console.error('[wanx-image] upload threw', err);
    return null;
  }

  return illustrationPublicUrl(mealId);
}
