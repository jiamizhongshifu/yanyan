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
}

const DEFAULT_TIMEOUT_MS = 8000;

function getApiBase(): string {
  return import.meta.env.VITE_API_BASE ?? '/api/v1';
}

export async function request<T>(opts: RequestOptions): Promise<ApiResult<T>> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), opts.timeoutMs ?? DEFAULT_TIMEOUT_MS);
  try {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(opts.headers ?? {})
    };
    if (opts.authToken) headers['Authorization'] = `Bearer ${opts.authToken}`;

    const res = await fetch(getApiBase() + opts.url, {
      method: opts.method ?? 'GET',
      headers,
      body: opts.data === undefined ? undefined : JSON.stringify(opts.data),
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
