/**
 * 种子入库流程
 *
 * v1 简化:直接从 server/data/seed-foods/v1.json 读取手工 curated 食物列表 → 入库。
 * Phase 2+ 改为:典籍 RAG → LlmDeriver → 人工 spot check 队列 → 高置信度入库。
 *
 * 这一文件提供两条路径:
 *   - seedFromFixture:从 v1.json 入库(立即可用,30 个高频食物)
 *   - seedWithLlmDerivation:对食物名列表跑 LLM 派生 → 入库(扩展到 800-1500 时使用)
 */

import { readFileSync } from 'fs';
import { join } from 'path';
import type { FoodClassifierStore } from './store';
import type { LlmDeriver } from './llm-deriver';
import { HUMAN_REVIEW_CONFIDENCE_THRESHOLD } from './llm-deriver';
import type { FoodSeed } from './types';

export interface SeedDeps {
  store: FoodClassifierStore;
  llm?: LlmDeriver;
}

export interface SeedResult {
  inserted: number;
  skipped: number;
  needsReview: string[]; // 低置信度,进人工 review 队列
  errors: Array<{ food: string; error: string }>;
}

const DEFAULT_FIXTURE_PATH = join(__dirname, '..', '..', '..', 'data', 'seed-foods', 'v1.json');

export function loadFixture(path: string = DEFAULT_FIXTURE_PATH): FoodSeed[] {
  const raw = readFileSync(path, 'utf8');
  return JSON.parse(raw) as FoodSeed[];
}

export async function seedFromFixture(deps: SeedDeps, fixture: FoodSeed[]): Promise<SeedResult> {
  const result: SeedResult = { inserted: 0, skipped: 0, needsReview: [], errors: [] };

  for (const seed of fixture) {
    try {
      await deps.store.upsert({
        foodCanonicalName: seed.foodCanonicalName,
        tcmLabel: seed.tcmLabel,
        tcmProperty: seed.tcmProperty,
        diiScore: seed.diiScore ?? null,
        agesScore: seed.agesScore ?? null,
        gi: seed.gi ?? null,
        citations: seed.citations,
        sourceVersions: { canon: 'v1-curated', humanReviewedAt: new Date().toISOString() }
      });
      result.inserted++;
    } catch (err) {
      result.errors.push({
        food: seed.foodCanonicalName,
        error: err instanceof Error ? err.message : String(err)
      });
    }
  }
  return result;
}

/**
 * LLM-driven 派生入库:用于扩展到 800-1500 食物
 *
 * 低置信度(< 0.6)进 needsReview 队列,不入库 — 等人工 spot check 通过后再调 seedFromFixture。
 */
export async function seedWithLlmDerivation(deps: SeedDeps, foodNames: string[]): Promise<SeedResult> {
  if (!deps.llm) throw new Error('seedWithLlmDerivation requires deps.llm');
  const result: SeedResult = { inserted: 0, skipped: 0, needsReview: [], errors: [] };

  for (const name of foodNames) {
    try {
      const existing = await deps.store.findByName(name);
      if (existing) {
        result.skipped++;
        continue;
      }
      const derived = await deps.llm.derive(name);
      if (!derived) {
        result.errors.push({ food: name, error: 'llm_no_result' });
        continue;
      }
      if (derived.confidence < HUMAN_REVIEW_CONFIDENCE_THRESHOLD) {
        result.needsReview.push(name);
        continue;
      }
      await deps.store.upsert({
        foodCanonicalName: name,
        tcmLabel: derived.tcmLabel,
        tcmProperty: derived.tcmProperty,
        citations: derived.citations,
        sourceVersions: { llmModel: derived.modelVersion }
      });
      result.inserted++;
    } catch (err) {
      result.errors.push({ food: name, error: err instanceof Error ? err.message : String(err) });
    }
  }
  return result;
}
