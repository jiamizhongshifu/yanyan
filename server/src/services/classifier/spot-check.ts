/**
 * USDA / 公开数据集 spot-check gate
 *
 * 对应 plan U5 verification(Round 2 review 修订):
 *   100 个高频食物的 DII / AGEs 数值与 USDA / 公开数据集 spot check 对比 误差率 ≤ 10%
 *
 * 防止 Phase 2 算法上线时大规模回填 — 早期就守住西方营养层数据质量。
 *
 * 算法:对 reference 中每个食物,从 store 取出 v1 派生值,与 reference 真值比较;
 * 误差超过 tolerance 的视为不通过,统计错误率。
 */

import { readFileSync } from 'fs';
import { join } from 'path';
import type { FoodClassifierStore } from './store';

export interface UsdaReference {
  description: string;
  tolerance: { diiScore: number; agesScore: number; gi: number };
  samples: Array<{
    foodCanonicalName: string;
    diiScore?: number;
    agesScore?: number;
    gi?: number;
  }>;
}

export interface SpotCheckResult {
  totalSamples: number;
  passed: number;
  failed: number;
  errorRate: number;
  thresholdRate: number;
  passes: boolean;
  failures: Array<{
    foodCanonicalName: string;
    field: 'diiScore' | 'agesScore' | 'gi';
    expected: number;
    actual: number | null;
    delta: number | null;
  }>;
  missingFromStore: string[];
}

const DEFAULT_REFERENCE_PATH = join(__dirname, '..', '..', '..', 'data', 'western-nutrition', 'usda-reference.json');

export function loadUsdaReference(path: string = DEFAULT_REFERENCE_PATH): UsdaReference {
  return JSON.parse(readFileSync(path, 'utf8')) as UsdaReference;
}

/**
 * 跑 spot check,返回结果。pass 标准:errorRate ≤ thresholdRate(默认 0.10 = 10%)
 */
export async function runUsdaSpotCheck(
  store: FoodClassifierStore,
  options: { reference?: UsdaReference; thresholdRate?: number } = {}
): Promise<SpotCheckResult> {
  const ref = options.reference ?? loadUsdaReference();
  const thresholdRate = options.thresholdRate ?? 0.10;
  const result: SpotCheckResult = {
    totalSamples: 0,
    passed: 0,
    failed: 0,
    errorRate: 0,
    thresholdRate,
    passes: false,
    failures: [],
    missingFromStore: []
  };

  for (const sample of ref.samples) {
    const stored = await store.findByName(sample.foodCanonicalName);
    if (!stored) {
      result.missingFromStore.push(sample.foodCanonicalName);
      continue;
    }
    let allFieldsPassed = true;
    for (const field of ['diiScore', 'agesScore', 'gi'] as const) {
      const expected = sample[field];
      if (expected === undefined) continue;
      result.totalSamples++;
      const actual = stored[field];
      if (actual === null || actual === undefined) {
        result.failures.push({ foodCanonicalName: sample.foodCanonicalName, field, expected, actual: null, delta: null });
        allFieldsPassed = false;
        continue;
      }
      const tol = ref.tolerance[field];
      const delta = Math.abs(actual - expected);
      if (delta > tol) {
        result.failures.push({ foodCanonicalName: sample.foodCanonicalName, field, expected, actual, delta });
        allFieldsPassed = false;
      } else {
        result.passed++;
      }
    }
    if (!allFieldsPassed) result.failed++;
  }

  result.errorRate = result.totalSamples === 0 ? 0 : result.failures.length / result.totalSamples;
  result.passes = result.errorRate <= thresholdRate && result.missingFromStore.length === 0;
  return result;
}
