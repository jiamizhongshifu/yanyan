/**
 * Hedged Recognizer — 多 LLM 并行 + 谁先返回用谁
 *
 * Round 2 review 修订:从原 5 秒串行 fallback 改为 hedged request,P95 从 8s 压到 ~3-5s。
 *
 * 行为:
 *   - 同时调多个 recognizer(豆包 + Qwen-VL 等);
 *   - 第一个非 null 结果即返回;
 *   - 全部都 null / 全部 reject → 返回 null。
 */

import type { LlmFoodRecognizer } from './llm-recognizer';
import type { RecognitionResult } from './types';

export class HedgedFoodRecognizer implements LlmFoodRecognizer {
  readonly modelVersion: string;

  constructor(private recognizers: LlmFoodRecognizer[]) {
    if (recognizers.length === 0) throw new Error('HedgedFoodRecognizer 需要至少 1 个 recognizer');
    this.modelVersion = `hedged(${recognizers.map((r) => r.modelVersion).join(',')})`;
  }

  async recognize(storageKey: string): Promise<RecognitionResult | null> {
    return await new Promise<RecognitionResult | null>((resolve) => {
      let pending = this.recognizers.length;
      let resolved = false;

      for (const r of this.recognizers) {
        // wrap 防 reject 影响其它并行调用
        Promise.resolve()
          .then(() => r.recognize(storageKey))
          .then((res) => {
            if (resolved) return;
            if (res) {
              resolved = true;
              resolve(res);
              return;
            }
            pending--;
            if (pending === 0 && !resolved) resolve(null);
          })
          .catch(() => {
            if (resolved) return;
            pending--;
            if (pending === 0 && !resolved) resolve(null);
          });
      }
    });
  }
}
