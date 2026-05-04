/**
 * 环境数据类型 — 给 Yan-Score EnvPart(U8 消费)
 */

export type Season = 'spring' | 'summer' | 'autumn' | 'winter';
export type PollenLevel = 'low' | 'mid' | 'high';

export interface EnvSnapshot {
  /** 城市 code(GB/T 2260 6 位行政区划码,或自定义短码 e.g. 'BJ') */
  cityCode: string;
  /** 0-500;null 时 EnvPart 内部不计入此项 */
  pm25: number | null;
  /** null 时不计入(plan U9:大多数城市无花粉数据,降级为只看 PM2.5 + 季节) */
  pollenLevel: PollenLevel | null;
  /** 季节恒可计算,从本地时间 → 春/夏/秋/冬 */
  season: Season;
  /** 抓取时间戳;判断 30 分钟过期用 */
  snapshotAt: Date;
  /** raw payload(和风原始响应),供调试 / 法规审计 */
  rawPayload?: Record<string, unknown>;
}

/** 缓存判定阈值:30 分钟(plan U9) */
export const SNAPSHOT_FRESH_MS = 30 * 60 * 1000;

/** 数据源标记 — 给客户端展示 + 观测用 */
export type SnapshotSource = 'fresh_fetch' | 'cache_hit' | 'stale_fallback';

export interface SnapshotResult {
  snapshot: EnvSnapshot;
  source: SnapshotSource;
}
