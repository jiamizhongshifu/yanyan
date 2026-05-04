/**
 * 花粉抓取器
 *
 * Plan U9:中国除北京 / 上海 / 成都等少数城市外,无可商用实时花粉数据。
 * v1 行为:
 *   - 已知数据源城市:fetch 返回 PollenLevel
 *   - 未知城市:fetch 返回 null,调用方降级为"季节性默认"(春秋默认 mid)
 */

import type { PollenLevel } from './types';

const POLLEN_DATA_CITIES = new Set<string>(['BJ', 'SH', 'CD', 'TJ', 'GZ', 'XA']);

export interface PollenFetcher {
  fetch(cityCode: string): Promise<PollenLevel | null>;
  hasData(cityCode: string): boolean;
  readonly source: string;
}

export class DevPollenFetcher implements PollenFetcher {
  readonly source = 'dev-fixture';
  private fixtures = new Map<string, PollenLevel>();
  add(cityCode: string, level: PollenLevel): void {
    this.fixtures.set(cityCode, level);
  }
  hasData(cityCode: string): boolean {
    return this.fixtures.has(cityCode);
  }
  async fetch(cityCode: string): Promise<PollenLevel | null> {
    return this.fixtures.get(cityCode) ?? null;
  }
}

export class HefengPollenFetcher implements PollenFetcher {
  readonly source = 'hefeng-v7';
  constructor(private apiKey: string) {
    if (!apiKey) throw new Error('HefengPollenFetcher 需要 apiKey');
  }
  hasData(cityCode: string): boolean {
    return POLLEN_DATA_CITIES.has(cityCode);
  }
  async fetch(_cityCode: string): Promise<PollenLevel | null> {
    throw new Error('HefengPollenFetcher.fetch 待 ce-work 阶段接入和风天气 API SDK');
  }
}

export { POLLEN_DATA_CITIES };
