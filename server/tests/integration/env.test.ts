/**
 * U9 环境数据 service 测试
 *
 * 对应 plan U9 测试场景:
 *   - Happy: 北京 PM2.5=65 + 花粉中等 → snapshot 含 ~65 + mid + season
 *   - Edge: 用户在花粉无数据城市 → pollen=null,只 PM2.5 + 季节
 *   - Edge: 30 分钟内重复请求 → cache_hit,不再 fetch
 *   - Edge: fetch 超时 / 失败,有 stale 缓存 → stale_fallback
 *   - Edge: fetch 全失败,无缓存 → null
 *   - Pure: seasonForDate 4 季边界
 */

import {
  DevPm25Fetcher,
  DevPollenFetcher,
  HefengPm25Fetcher,
  HefengPollenFetcher,
  POLLEN_DATA_CITIES,
  getCurrentSnapshotForCity,
  seasonForDate,
  type EnvSnapshot,
  type EnvSnapshotStore
} from '../../src/services/env';

class FakeEnvStore implements EnvSnapshotStore {
  rows: EnvSnapshot[] = [];
  async findLatest(cityCode: string): Promise<EnvSnapshot | null> {
    const matching = this.rows.filter((r) => r.cityCode === cityCode);
    if (matching.length === 0) return null;
    return matching.reduce((latest, r) =>
      r.snapshotAt.getTime() > latest.snapshotAt.getTime() ? r : latest
    );
  }
  async insert(snapshot: EnvSnapshot): Promise<void> {
    this.rows.push(snapshot);
  }
}

describe('U9 seasonForDate', () => {
  test.each([
    ['2026-03-15', 'spring'],
    ['2026-06-15', 'summer'],
    ['2026-09-15', 'autumn'],
    ['2026-12-15', 'winter'],
    ['2026-01-31', 'winter'],
    ['2026-02-28', 'winter'],
    ['2026-05-31', 'spring'],
    ['2026-11-30', 'autumn']
  ])('%s → %s', (iso, expected) => {
    expect(seasonForDate(new Date(iso + 'T12:00:00Z'))).toBe(expected);
  });
});

describe('U9 fetcher 占位 + Dev fixture', () => {
  test('HefengPm25Fetcher 缺 apiKey throw', () => {
    expect(() => new HefengPm25Fetcher('')).toThrow();
  });
  test('HefengPm25Fetcher.fetch 占位 throw', async () => {
    const f = new HefengPm25Fetcher('fake');
    await expect(f.fetch('BJ')).rejects.toThrow(/待 ce-work/);
  });
  test('HefengPollenFetcher.hasData 检查城市白名单', () => {
    const f = new HefengPollenFetcher('fake');
    expect(f.hasData('BJ')).toBe(true);
    expect(f.hasData('LZ')).toBe(false); // 兰州不在 POLLEN_DATA_CITIES
  });
  test('POLLEN_DATA_CITIES 包含主要省会(覆盖人群)', () => {
    expect(POLLEN_DATA_CITIES.has('BJ')).toBe(true);
    expect(POLLEN_DATA_CITIES.has('SH')).toBe(true);
    expect(POLLEN_DATA_CITIES.has('CD')).toBe(true);
  });
  test('DevPm25Fetcher 命中 / 不命中', async () => {
    const f = new DevPm25Fetcher();
    f.add('BJ', 65);
    expect(await f.fetch('BJ')).toBe(65);
    expect(await f.fetch('XX')).toBeNull();
  });
  test('DevPollenFetcher hasData + fetch', async () => {
    const f = new DevPollenFetcher();
    f.add('BJ', 'mid');
    expect(f.hasData('BJ')).toBe(true);
    expect(f.hasData('LZ')).toBe(false);
    expect(await f.fetch('BJ')).toBe('mid');
  });
});

describe('U9 getCurrentSnapshotForCity', () => {
  let store: FakeEnvStore;
  let pm25: DevPm25Fetcher;
  let pollen: DevPollenFetcher;
  const NOW = new Date('2026-03-15T10:00:00Z');

  beforeEach(() => {
    store = new FakeEnvStore();
    pm25 = new DevPm25Fetcher();
    pollen = new DevPollenFetcher();
  });

  test('Happy 北京: PM2.5 + 花粉 + 季节 全有 → fresh_fetch + 入库', async () => {
    pm25.add('BJ', 65);
    pollen.add('BJ', 'mid');
    const r = await getCurrentSnapshotForCity({ store, pm25, pollen, now: () => NOW }, 'BJ');
    expect(r).not.toBeNull();
    expect(r!.source).toBe('fresh_fetch');
    expect(r!.snapshot).toMatchObject({
      cityCode: 'BJ',
      pm25: 65,
      pollenLevel: 'mid',
      season: 'spring'
    });
    expect(store.rows).toHaveLength(1);
  });

  test('花粉无数据城市:只 PM2.5 + 季节(降级,plan U9)', async () => {
    pm25.add('LZ', 80);
    // pollen.add 不调 → DevPollenFetcher.hasData('LZ')=false
    const r = await getCurrentSnapshotForCity({ store, pm25, pollen, now: () => NOW }, 'LZ');
    expect(r!.snapshot.pm25).toBe(80);
    expect(r!.snapshot.pollenLevel).toBeNull();
    expect(r!.snapshot.season).toBe('spring');
  });

  test('30 分钟内重复请求 → cache_hit,不再 fetch', async () => {
    pm25.add('BJ', 65);
    pollen.add('BJ', 'mid');
    const r1 = await getCurrentSnapshotForCity({ store, pm25, pollen, now: () => NOW }, 'BJ');
    expect(r1!.source).toBe('fresh_fetch');

    // 抓取器换成 throw — 验证 cache_hit 路径不调外部
    const brokenPm25 = { source: 't', fetch: () => Promise.reject(new Error('should not call')) };
    const brokenPollen = {
      source: 't',
      hasData: () => true,
      fetch: () => Promise.reject(new Error('should not call'))
    };

    const r2 = await getCurrentSnapshotForCity(
      {
        store,
        pm25: brokenPm25 as never,
        pollen: brokenPollen as never,
        now: () => new Date(NOW.getTime() + 10 * 60 * 1000) // +10 分钟,仍在 30 分钟窗口内
      },
      'BJ'
    );
    expect(r2!.source).toBe('cache_hit');
    expect(r2!.snapshot.pm25).toBe(65);
  });

  test('Edge: 抓取超时 + 有 stale 缓存 → stale_fallback', async () => {
    // 先建立一个旧 snapshot
    const stale: EnvSnapshot = {
      cityCode: 'BJ',
      pm25: 50,
      pollenLevel: 'low',
      season: 'spring',
      snapshotAt: new Date(NOW.getTime() - 90 * 60 * 1000) // 90 分钟前 → stale
    };
    await store.insert(stale);

    // pm25 / pollen 都失败
    const failingPm25 = {
      source: 't',
      fetch: () => Promise.reject(new Error('timeout'))
    };
    const failingPollen = {
      source: 't',
      hasData: () => true,
      fetch: () => Promise.reject(new Error('timeout'))
    };

    const r = await getCurrentSnapshotForCity(
      {
        store,
        pm25: failingPm25 as never,
        pollen: failingPollen as never,
        now: () => NOW
      },
      'BJ'
    );
    expect(r).not.toBeNull();
    expect(r!.source).toBe('stale_fallback');
    expect(r!.snapshot.pm25).toBe(50);
  });

  test('Edge: 抓取全失败,无任何缓存 → null', async () => {
    const failingPm25 = { source: 't', fetch: () => Promise.reject(new Error('x')) };
    const failingPollen = { source: 't', hasData: () => true, fetch: () => Promise.reject(new Error('x')) };
    const r = await getCurrentSnapshotForCity(
      { store, pm25: failingPm25 as never, pollen: failingPollen as never, now: () => NOW },
      'BJ'
    );
    expect(r).toBeNull();
  });

  test('Edge: PM2.5 拿到但花粉失败 → 返回 PM2.5 部分,pollen=null', async () => {
    pm25.add('BJ', 75);
    const failingPollen = {
      source: 't',
      hasData: () => true,
      fetch: () => Promise.reject(new Error('x'))
    };
    const r = await getCurrentSnapshotForCity(
      { store, pm25, pollen: failingPollen as never, now: () => NOW },
      'BJ'
    );
    expect(r!.snapshot.pm25).toBe(75);
    expect(r!.snapshot.pollenLevel).toBeNull();
  });

  test('insert 失败不阻断响应', async () => {
    pm25.add('BJ', 65);
    pollen.add('BJ', 'mid');
    const brokenStore: EnvSnapshotStore = {
      findLatest: async () => null,
      insert: async () => {
        throw new Error('db down');
      }
    };
    const r = await getCurrentSnapshotForCity(
      { store: brokenStore, pm25, pollen, now: () => NOW },
      'BJ'
    );
    expect(r!.source).toBe('fresh_fetch');
    expect(r!.snapshot.pm25).toBe(65);
  });
});
