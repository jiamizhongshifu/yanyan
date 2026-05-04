/**
 * 环境数据 service — 编排:store hit / 30 分钟过期 / fetch / 失败时 fallback 到 stale
 *
 * 使用方式:Yan-Score 的 loadEnvSnapshot 注入此模块的 getCurrentSnapshotForCity。
 *
 * Plan U9 行为对照:
 *   - 缓存命中(< 30 分钟):直接返回 source=cache_hit
 *   - 缓存过期或不存在:并行 fetch PM2.5 + 花粉(可获城市)→ insert → source=fresh_fetch
 *   - 抓取超时 / 失败 + 有上一份 stale 缓存:fallback to stale → source=stale_fallback
 *   - 抓取失败 + 无任何缓存:返回 null(EnvPart 自然 null,Yan-Score 重分配)
 */

import { seasonForDate } from './season';
import type { Pm25Fetcher } from './pm25-fetcher';
import type { PollenFetcher } from './pollen-fetcher';
import type { EnvSnapshotStore } from './store';
import { SNAPSHOT_FRESH_MS, type EnvSnapshot, type SnapshotResult } from './types';

export interface EnvDeps {
  store: EnvSnapshotStore;
  pm25: Pm25Fetcher;
  pollen: PollenFetcher;
  /** 注入 now 便于测试时控制时间;默认 new Date() */
  now?: () => Date;
}

export async function getCurrentSnapshotForCity(
  deps: EnvDeps,
  cityCode: string
): Promise<SnapshotResult | null> {
  const now = deps.now ? deps.now() : new Date();
  const cached = await deps.store.findLatest(cityCode);
  if (cached && now.getTime() - cached.snapshotAt.getTime() < SNAPSHOT_FRESH_MS) {
    return { snapshot: cached, source: 'cache_hit' };
  }

  // 并行 fetch — 任一失败不阻断另一
  const [pm25, pollen] = await Promise.all([
    deps.pm25.fetch(cityCode).catch(() => null),
    deps.pollen.hasData(cityCode) ? deps.pollen.fetch(cityCode).catch(() => null) : Promise.resolve(null)
  ]);

  // 完全抓不到 → fallback 到 stale 缓存(若有)
  if (pm25 === null && pollen === null) {
    if (cached) return { snapshot: cached, source: 'stale_fallback' };
    return null;
  }

  const snapshot: EnvSnapshot = {
    cityCode,
    pm25,
    pollenLevel: pollen,
    season: seasonForDate(now),
    snapshotAt: now,
    rawPayload: { pm25Source: deps.pm25.source, pollenSource: deps.pollen.source }
  };

  // 写入失败不阻断响应(下次仍可重抓)
  try {
    await deps.store.insert(snapshot);
  } catch {
    /* swallow — 缓存写失败不影响当前响应 */
  }

  return { snapshot, source: 'fresh_fetch' };
}

export * from './types';
export * from './season';
export * from './pm25-fetcher';
export * from './pollen-fetcher';
export * from './store';
