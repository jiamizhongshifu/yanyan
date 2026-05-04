/**
 * 查询服务 + 异步回填队列
 *
 * 接口:
 *   getClassification(name) → 命中返回 FoodClassification,未命中返回 null + 进异步队列
 *   onMissingFood(name)     → 队列回调:LLM 派生 → 进人工 review(若低置信)/ 直接 upsert(若高置信)
 *
 * v1 队列用内存实现(BullMQ Phase 2 接入)。
 */

import type { FoodClassification } from './types';
import type { FoodClassifierStore } from './store';
import type { LlmDeriver } from './llm-deriver';
import { HUMAN_REVIEW_CONFIDENCE_THRESHOLD } from './llm-deriver';

export interface QueryDeps {
  store: FoodClassifierStore;
  /** 命中失败时调用,把食物名加入回填队列(不阻塞响应) */
  onMissingFood?: (name: string) => void;
}

export async function getClassification(deps: QueryDeps, name: string): Promise<FoodClassification | null> {
  const trimmed = name.trim();
  if (trimmed.length === 0) return null;
  const hit = await deps.store.findByName(trimmed);
  if (hit) return hit;
  // 未命中 → 触发异步回填
  if (deps.onMissingFood) {
    try {
      deps.onMissingFood(trimmed);
    } catch {
      /* 队列入队失败不阻塞响应 */
    }
  }
  return null;
}

/**
 * 内存版回填队列 — 单进程开发 / 测试用
 * 生产用 BullMQ + Redis(Phase 2)
 */
export class InMemoryBackfillQueue {
  private pending = new Set<string>();
  private processing = false;

  constructor(private deps: { store: FoodClassifierStore; llm: LlmDeriver }) {}

  enqueue(name: string): void {
    this.pending.add(name);
    void this.drain();
  }

  /** 测试用 / 监控用 */
  pendingSize(): number {
    return this.pending.size;
  }

  /** 测试用:同步等待队列清空 */
  async drainNow(): Promise<void> {
    await this.drain();
  }

  private async drain(): Promise<void> {
    if (this.processing) return;
    this.processing = true;
    try {
      while (this.pending.size > 0) {
        const name = this.pending.values().next().value as string;
        this.pending.delete(name);
        await this.processOne(name);
      }
    } finally {
      this.processing = false;
    }
  }

  private async processOne(name: string): Promise<void> {
    try {
      // 已被别的请求填充过 → 跳过
      const existing = await this.deps.store.findByName(name);
      if (existing) return;

      const derived = await this.deps.llm.derive(name);
      if (!derived) return;
      if (derived.confidence < HUMAN_REVIEW_CONFIDENCE_THRESHOLD) {
        // 低置信:不入库,进人工 review。v1 仅日志;Phase 2 接入审核工作流
        // eslint-disable-next-line no-console
        console.warn(`[classifier backfill] ${name} 置信度 ${derived.confidence} 低于阈值,需人工 review`);
        return;
      }
      await this.deps.store.upsert({
        foodCanonicalName: name,
        tcmLabel: derived.tcmLabel,
        tcmProperty: derived.tcmProperty,
        citations: derived.citations,
        sourceVersions: { llmModel: derived.modelVersion }
      });
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error(`[classifier backfill] ${name} 处理失败:`, err);
    }
  }
}
