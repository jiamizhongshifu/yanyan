/**
 * LLM cost monitor (Phase 2 U8)
 *
 * v1 简化:进程内累计(适合 Vercel 单实例 + Beta 量级)
 * Phase 3 规模化时迁 PG 持久化 + 跨实例同步。
 *
 * 触发飞书告警:
 *   - 单日成本 ≥ DAILY_BUDGET_USD × ALERT_THRESHOLD
 *   - 月度成本 ≥ MONTHLY_BUDGET_USD × ALERT_THRESHOLD
 *
 * 价格表 — DeepSeek 公开定价(每 1M tokens,USD)
 *   - 输入:$0.27 cache miss(在线 cache hit 更便宜,这里按上限估)
 *   - 输出:$1.10
 * 出错就高估,避免欠预算。
 */

import { sendFeishuAlert } from '../alerting/feishu';

export interface TokenUsage {
  model: string;
  inputTokens: number;
  outputTokens: number;
}

interface ModelPricing {
  inputPer1M: number;
  outputPer1M: number;
}

// USD per 1M tokens(2026-Q2 公开价格)
const PRICING: Record<string, ModelPricing> = {
  'deepseek-v4-pro': { inputPer1M: 0.27, outputPer1M: 1.1 },
  'deepseek-v3': { inputPer1M: 0.27, outputPer1M: 1.1 },
  default: { inputPer1M: 0.5, outputPer1M: 2.0 }
};

const ALERT_THRESHOLD = 0.8;

interface MonitorState {
  /** 当前 UTC 日期(YYYY-MM-DD)— 跨日重置 */
  currentDay: string;
  /** 当前 UTC 月份(YYYY-MM)— 跨月重置 */
  currentMonth: string;
  dailyTokens: { input: number; output: number };
  dailyCostUsd: number;
  monthlyTokens: { input: number; output: number };
  monthlyCostUsd: number;
  /** 防告警重复:已告警的阈值标记 */
  alertedDaily80: boolean;
  alertedMonthly80: boolean;
}

let state: MonitorState = freshState();

function freshState(): MonitorState {
  const now = new Date();
  return {
    currentDay: now.toISOString().slice(0, 10),
    currentMonth: now.toISOString().slice(0, 7),
    dailyTokens: { input: 0, output: 0 },
    dailyCostUsd: 0,
    monthlyTokens: { input: 0, output: 0 },
    monthlyCostUsd: 0,
    alertedDaily80: false,
    alertedMonthly80: false
  };
}

export function _resetMonitorForTesting(): void {
  state = freshState();
}

function dailyBudget(): number {
  return Number(process.env.LLM_DAILY_BUDGET_USD ?? '50');
}

function monthlyBudget(): number {
  return Number(process.env.LLM_MONTHLY_BUDGET_USD ?? '1000');
}

function rollIfNeeded(now: Date): void {
  const day = now.toISOString().slice(0, 10);
  const month = now.toISOString().slice(0, 7);
  if (day !== state.currentDay) {
    state.currentDay = day;
    state.dailyTokens = { input: 0, output: 0 };
    state.dailyCostUsd = 0;
    state.alertedDaily80 = false;
  }
  if (month !== state.currentMonth) {
    state.currentMonth = month;
    state.monthlyTokens = { input: 0, output: 0 };
    state.monthlyCostUsd = 0;
    state.alertedMonthly80 = false;
  }
}

function pricingFor(model: string): ModelPricing {
  return PRICING[model] ?? PRICING.default;
}

export function recordTokenUsage(usage: TokenUsage): void {
  rollIfNeeded(new Date());
  const p = pricingFor(usage.model);
  const cost = (usage.inputTokens * p.inputPer1M + usage.outputTokens * p.outputPer1M) / 1_000_000;
  state.dailyTokens.input += usage.inputTokens;
  state.dailyTokens.output += usage.outputTokens;
  state.dailyCostUsd += cost;
  state.monthlyTokens.input += usage.inputTokens;
  state.monthlyTokens.output += usage.outputTokens;
  state.monthlyCostUsd += cost;

  // 告警(无 await,fire-and-forget — 失败不阻塞业务)
  if (!state.alertedDaily80 && state.dailyCostUsd >= dailyBudget() * ALERT_THRESHOLD) {
    state.alertedDaily80 = true;
    void sendFeishuAlert({
      level: 'warning',
      title: 'LLM 单日成本达 80% 阈值',
      body: `日成本 $${state.dailyCostUsd.toFixed(2)} / 预算 $${dailyBudget()}(${state.currentDay})`
    });
  }
  if (!state.alertedMonthly80 && state.monthlyCostUsd >= monthlyBudget() * ALERT_THRESHOLD) {
    state.alertedMonthly80 = true;
    void sendFeishuAlert({
      level: 'warning',
      title: 'LLM 月度成本达 80% 阈值',
      body: `月成本 $${state.monthlyCostUsd.toFixed(2)} / 预算 $${monthlyBudget()}(${state.currentMonth})`
    });
  }
}

export interface CostSnapshot {
  day: string;
  month: string;
  dailyCostUsd: number;
  dailyBudgetUsd: number;
  monthlyCostUsd: number;
  monthlyBudgetUsd: number;
  dailyTokens: { input: number; output: number };
  monthlyTokens: { input: number; output: number };
  /** budget-exceeded 时业务路径应降级 */
  shouldDegrade: boolean;
}

export function getCostSnapshot(): CostSnapshot {
  rollIfNeeded(new Date());
  return {
    day: state.currentDay,
    month: state.currentMonth,
    dailyCostUsd: state.dailyCostUsd,
    dailyBudgetUsd: dailyBudget(),
    monthlyCostUsd: state.monthlyCostUsd,
    monthlyBudgetUsd: monthlyBudget(),
    dailyTokens: { ...state.dailyTokens },
    monthlyTokens: { ...state.monthlyTokens },
    shouldDegrade:
      state.dailyCostUsd >= dailyBudget() || state.monthlyCostUsd >= monthlyBudget()
  };
}
