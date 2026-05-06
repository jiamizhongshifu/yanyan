/**
 * 客户端 in-memory 共享缓存 — 给热点 GET 用。
 *
 * 解决:Today / Body / Insights 切换时各自重发同一组 API(yan-score / home-today / progress 等)。
 *
 * 行为:
 *   - 命中 + 未过期 → 直接返回
 *   - 命中 + 已过期 → 重新 fetch
 *   - 未命中 → fetch + 缓存
 *   - 同 key 并发请求合并(避免 inflight 重复)
 *   - mutation 路径(拍餐/打卡/挑战 upsert)调 invalidate(prefix) 主动清除
 */

interface Entry<T> {
  value: T;
  expiresAt: number;
}

const cache = new Map<string, Entry<unknown>>();
const inflight = new Map<string, Promise<unknown>>();

export function cached<T>(key: string, ttlMs: number, fetcher: () => Promise<T>): Promise<T> {
  const now = Date.now();
  const hit = cache.get(key);
  if (hit && hit.expiresAt > now) {
    return Promise.resolve(hit.value as T);
  }
  const existing = inflight.get(key);
  if (existing) return existing as Promise<T>;

  const promise = fetcher()
    .then((value) => {
      cache.set(key, { value, expiresAt: Date.now() + ttlMs });
      inflight.delete(key);
      return value;
    })
    .catch((err) => {
      inflight.delete(key);
      throw err;
    });
  inflight.set(key, promise);
  return promise;
}

/**
 * 清除以 prefix 开头的所有缓存项;不传则清空。
 * 在 mutation 完成后调用。
 */
export function invalidate(prefix?: string): void {
  if (!prefix) {
    cache.clear();
    inflight.clear();
    return;
  }
  for (const k of [...cache.keys()]) if (k.startsWith(prefix)) cache.delete(k);
  for (const k of [...inflight.keys()]) if (k.startsWith(prefix)) inflight.delete(k);
}

/** 测试用 */
export function _resetCacheForTests(): void {
  cache.clear();
  inflight.clear();
}
