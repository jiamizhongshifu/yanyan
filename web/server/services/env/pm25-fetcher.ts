/**
 * PM2.5 抓取器
 *
 * v1 真实数据源:和风天气 商用 API(已确认中国主要城市覆盖好,plan Round 2)。
 * v1 ce-work 阶段实施 HefengPm25Fetcher;此处提供:
 *   - Pm25Fetcher 接口
 *   - DevPm25Fetcher fixture(测试 / 开发用)
 *   - HefengPm25Fetcher 占位(throw)
 */

export interface Pm25Fetcher {
  /** @returns 浮点 PM2.5(μg/m³),失败返回 null(由调用方决定 fallback 路径) */
  fetch(cityCode: string): Promise<number | null>;
  readonly source: string;
}

export class DevPm25Fetcher implements Pm25Fetcher {
  readonly source = 'dev-fixture';
  private fixtures = new Map<string, number>();
  add(cityCode: string, pm25: number): void {
    this.fixtures.set(cityCode, pm25);
  }
  async fetch(cityCode: string): Promise<number | null> {
    return this.fixtures.get(cityCode) ?? null;
  }
}

export class HefengPm25Fetcher implements Pm25Fetcher {
  readonly source = 'hefeng-v7';
  constructor(private apiKey: string) {
    if (!apiKey) throw new Error('HefengPm25Fetcher 需要 apiKey');
  }
  async fetch(_cityCode: string): Promise<number | null> {
    throw new Error('HefengPm25Fetcher.fetch 待 ce-work 阶段接入和风天气 API SDK');
  }
}
