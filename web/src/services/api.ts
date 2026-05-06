/**
 * API wrapper — 统一 fetch + 鉴权 + 三档 fallbackMessage
 *
 * 鉴权策略(post-Supabase pivot):
 *   - 业务 API 调 Vercel Functions(/api/v1/*),走 Supabase Auth JWT
 *   - 客户端在 header 加 `Authorization: Bearer <jwt>`(后续 U3 接入)
 *   - 部分查询直接走 Supabase JS SDK + RLS,不必走 server(后续单元区分)
 *
 * 失败永远返回 user-friendly fallbackMessage,不暴露后端原始错误。
 */

interface ApiSuccess<T> {
  ok: true;
  data: T;
  status: number;
}

interface ApiFailure {
  ok: false;
  error: string;
  status: number;
  fallbackMessage: string;
}

export type ApiResult<T> = ApiSuccess<T> | ApiFailure;

interface RequestOptions {
  url: string;
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  data?: unknown;
  headers?: Record<string, string>;
  timeoutMs?: number;
  /** 鉴权 JWT;由调用方从 Supabase Auth 拿 */
  authToken?: string | null;
  /**
   * 关闭重试。默认:GET 自动重试 2 次(网络错 / 超时 / 5xx / 429);
   * POST/PUT/DELETE 不重试(防 mutation 重复)。设 true 强制单次。
   */
  noRetry?: boolean;
}

const DEFAULT_TIMEOUT_MS = 8000;
const RETRY_BACKOFF_MS = [200, 700]; // 共 2 次重试,总体最多 ~900ms 等待

function getApiBase(): string {
  return import.meta.env.VITE_API_BASE ?? '/api/v1';
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function singleAttempt<T>(opts: RequestOptions): Promise<ApiResult<T>> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), opts.timeoutMs ?? DEFAULT_TIMEOUT_MS);
  try {
    // POST 无 body 时不要写 Content-Type: application/json,否则 Fastify
    // JSON parser 会因为空 body 返回 400(empty_body)。如 /users/me/ensure。
    const hasBody = opts.data !== undefined;
    const headers: Record<string, string> = {
      ...(hasBody ? { 'Content-Type': 'application/json' } : {}),
      ...(opts.headers ?? {})
    };
    if (opts.authToken) headers['Authorization'] = `Bearer ${opts.authToken}`;

    const res = await fetch(getApiBase() + opts.url, {
      method: opts.method ?? 'GET',
      headers,
      body: hasBody ? JSON.stringify(opts.data) : undefined,
      signal: ctrl.signal
    });

    if (res.ok) {
      const data = (await res.json().catch(() => null)) as T;
      return { ok: true, data, status: res.status };
    }
    return {
      ok: false,
      error: `http_${res.status}`,
      status: res.status,
      fallbackMessage: res.status >= 500 ? '服务忙,请稍后再试' : '请求异常,请稍后再试'
    };
  } catch (err) {
    const isAbort = (err as Error).name === 'AbortError';
    return {
      ok: false,
      error: isAbort ? 'timeout' : 'network_error',
      status: 0,
      fallbackMessage: isAbort ? '请求超时,请检查网络后重试' : '网络不通,请检查后重试'
    };
  } finally {
    clearTimeout(timer);
  }
}

function isRetryable(result: ApiResult<unknown>): boolean {
  if (result.ok) return false;
  // 网络层错误 / 超时 / 5xx / 429 都重试;4xx(除 429)是客户端错,重试无意义
  if (result.status === 0) return true; // network / timeout
  if (result.status >= 500) return true;
  if (result.status === 429) return true;
  return false;
}

export async function request<T>(opts: RequestOptions): Promise<ApiResult<T>> {
  const method = opts.method ?? 'GET';
  // 仅 GET 自动重试;mutation 一律单次,防重复副作用
  const canRetry = !opts.noRetry && method === 'GET';

  let result = await singleAttempt<T>(opts);
  if (!canRetry || !isRetryable(result)) return result;

  for (let i = 0; i < RETRY_BACKOFF_MS.length; i++) {
    await sleep(RETRY_BACKOFF_MS[i]);
    result = await singleAttempt<T>(opts);
    if (!isRetryable(result)) return result;
  }
  return result;
}
