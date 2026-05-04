/**
 * Phase 2 U8 测试 — 真实 LLM client + cost-monitor + feishu + RealLlmDeriver
 */

import { DeepSeekTextClient, LlmCallError } from '../../src/services/llm/deepseek';
import { recordTokenUsage, getCostSnapshot, _resetMonitorForTesting } from '../../src/services/llm/cost-monitor';
import { sendFeishuAlert } from '../../src/services/alerting/feishu';
import { RealLlmDeriver } from '../../src/services/classifier/llm-deriver';
import type { LlmTextClient } from '../../src/services/llm/deepseek';

function makeFetch(handler: (req: { url: string; init?: RequestInit }) => Response | Promise<Response>): typeof fetch {
  return ((url: string, init?: RequestInit) => Promise.resolve(handler({ url, init }))) as unknown as typeof fetch;
}

describe('U8 DeepSeekTextClient real', () => {
  test('happy path: 200 → parse content[0].text + 记 token', async () => {
    _resetMonitorForTesting();
    const fakeFetch = makeFetch(() =>
      new Response(
        JSON.stringify({
          content: [{ type: 'text', text: '{"tcmLabel":"发","tcmProperty":"热","citations":[{"source":"canon","reference":"《本草纲目》"}],"confidence":0.9}' }],
          model: 'deepseek-v4-pro',
          usage: { input_tokens: 100, output_tokens: 50 }
        }),
        { status: 200 }
      )
    );
    const c = new DeepSeekTextClient('k', 'https://api.deepseek.com/anthropic', 'deepseek-v4-pro', fakeFetch);
    const res = await c.complete({ messages: [{ role: 'user', content: '虾' }] });
    expect(res.content).toContain('tcmLabel');
    expect(res.modelVersion).toBe('deepseek-v4-pro');
    expect(res.latencyMs).toBeGreaterThanOrEqual(0);
    const cost = getCostSnapshot();
    expect(cost.dailyTokens.input).toBe(100);
    expect(cost.dailyTokens.output).toBe(50);
    expect(cost.dailyCostUsd).toBeGreaterThan(0);
  });

  test('429 → rate_limit + 重试 → 第二次 200 成功', async () => {
    _resetMonitorForTesting();
    let calls = 0;
    const fakeFetch = makeFetch(() => {
      calls++;
      if (calls === 1) return new Response('too many', { status: 429 });
      return new Response(
        JSON.stringify({
          content: [{ type: 'text', text: 'ok' }],
          model: 'm',
          usage: { input_tokens: 1, output_tokens: 1 }
        }),
        { status: 200 }
      );
    });
    const c = new DeepSeekTextClient('k', 'https://api.deepseek.com/anthropic', 'deepseek-v4-pro', fakeFetch);
    const res = await c.complete({ messages: [{ role: 'user', content: 'hi' }] });
    expect(res.content).toBe('ok');
    expect(calls).toBe(2);
  });

  test('500 → server + 重试 3 次都失败抛出', async () => {
    _resetMonitorForTesting();
    let calls = 0;
    const fakeFetch = makeFetch(() => {
      calls++;
      return new Response('boom', { status: 500 });
    });
    const c = new DeepSeekTextClient('k', 'https://api.deepseek.com/anthropic', 'deepseek-v4-pro', fakeFetch);
    await expect(c.complete({ messages: [{ role: 'user', content: 'hi' }] })).rejects.toMatchObject({
      kind: 'server'
    });
    expect(calls).toBe(3);
  });

  test('401 → unauthorized 不重试', async () => {
    let calls = 0;
    const fakeFetch = makeFetch(() => {
      calls++;
      return new Response('nope', { status: 401 });
    });
    const c = new DeepSeekTextClient('bad', 'https://api.deepseek.com/anthropic', 'deepseek-v4-pro', fakeFetch);
    await expect(c.complete({ messages: [{ role: 'user', content: 'hi' }] })).rejects.toMatchObject({
      kind: 'unauthorized'
    });
    expect(calls).toBe(1);
  });

  test('system prompt 提取到顶层 + messages 只保留 user/assistant', async () => {
    let body: Record<string, unknown> = {};
    const fakeFetch = makeFetch(({ init }) => {
      body = JSON.parse(init!.body as string);
      return new Response(
        JSON.stringify({ content: [{ type: 'text', text: 'ok' }], model: 'm', usage: { input_tokens: 0, output_tokens: 0 } }),
        { status: 200 }
      );
    });
    const c = new DeepSeekTextClient('k', 'https://api.deepseek.com/anthropic', 'deepseek-v4-pro', fakeFetch);
    await c.complete({
      messages: [
        { role: 'system', content: 'sys-msg' },
        { role: 'user', content: 'u' }
      ]
    });
    expect(body.system).toBe('sys-msg');
    expect((body.messages as Array<{ role: string }>).every((m) => m.role !== 'system')).toBe(true);
  });
});

describe('U8 cost monitor', () => {
  beforeEach(() => {
    _resetMonitorForTesting();
    delete process.env.LLM_DAILY_BUDGET_USD;
    delete process.env.LLM_MONTHLY_BUDGET_USD;
  });

  test('累加 token + 计算 USD(deepseek-v4-pro 价格)', () => {
    recordTokenUsage({ model: 'deepseek-v4-pro', inputTokens: 1_000_000, outputTokens: 0 });
    expect(getCostSnapshot().dailyCostUsd).toBeCloseTo(0.27, 2);
    recordTokenUsage({ model: 'deepseek-v4-pro', inputTokens: 0, outputTokens: 1_000_000 });
    expect(getCostSnapshot().dailyCostUsd).toBeCloseTo(0.27 + 1.1, 2);
  });

  test('未知 model 走 default 价格(避免欠预算)', () => {
    recordTokenUsage({ model: 'unknown-model', inputTokens: 1_000_000, outputTokens: 1_000_000 });
    expect(getCostSnapshot().dailyCostUsd).toBeCloseTo(2.5, 2);
  });

  test('shouldDegrade 在预算超限时为 true', () => {
    process.env.LLM_DAILY_BUDGET_USD = '1';
    recordTokenUsage({ model: 'deepseek-v4-pro', inputTokens: 0, outputTokens: 1_000_000 }); // $1.10
    expect(getCostSnapshot().shouldDegrade).toBe(true);
  });
});

describe('U8 feishu alert', () => {
  test('未配置 webhook → 静默降级 console + sent:false', async () => {
    delete process.env.FEISHU_WEBHOOK_URL;
    const r = await sendFeishuAlert({ level: 'warning', title: 't', body: 'b' });
    expect(r.sent).toBe(false);
    expect(r.reason).toBe('no_webhook_configured');
  });

  test('配置 webhook + 200 → sent:true,body 含 title', async () => {
    process.env.FEISHU_WEBHOOK_URL = 'https://feishu.test/hook';
    let captured: unknown = null;
    const fakeFetch = makeFetch(({ init }) => {
      captured = JSON.parse(init!.body as string);
      return new Response('ok', { status: 200 });
    });
    const r = await sendFeishuAlert({ level: 'critical', title: 'API down', body: 'detail' }, fakeFetch);
    expect(r.sent).toBe(true);
    expect(captured).toMatchObject({ msg_type: 'text' });
    expect(JSON.stringify(captured)).toContain('API down');
    delete process.env.FEISHU_WEBHOOK_URL;
  });

  test('webhook 5xx → sent:false reason:http_500', async () => {
    process.env.FEISHU_WEBHOOK_URL = 'https://feishu.test/hook';
    const fakeFetch = makeFetch(() => new Response('boom', { status: 500 }));
    const r = await sendFeishuAlert({ level: 'warning', title: 't', body: 'b' }, fakeFetch);
    expect(r.sent).toBe(false);
    expect(r.reason).toBe('http_500');
    delete process.env.FEISHU_WEBHOOK_URL;
  });
});

describe('U8 RealLlmDeriver', () => {
  function makeClient(content: string): LlmTextClient {
    return {
      modelVersion: 'test',
      async complete() {
        return { content, modelVersion: 'test', latencyMs: 1 };
      }
    };
  }

  test('happy: 完整 JSON 输出 → 解析 + citations 非空 → 返回 derivation', async () => {
    const client = makeClient(
      JSON.stringify({
        tcmLabel: '发',
        tcmProperty: '热',
        citations: [{ source: 'canon', reference: '《本草纲目》' }],
        confidence: 0.9
      })
    );
    const d = new RealLlmDeriver(client);
    const r = await d.derive('虾');
    expect(r).not.toBeNull();
    expect(r!.tcmLabel).toBe('发');
    expect(r!.tcmProperty).toBe('热');
    expect(r!.citations).toHaveLength(1);
    expect(r!.confidence).toBe(0.9);
  });

  test('无 citations → 强制低 confidence(进人工 review)', async () => {
    const client = makeClient(
      JSON.stringify({ tcmLabel: '平', tcmProperty: '平', citations: [], confidence: 0.95 })
    );
    const d = new RealLlmDeriver(client);
    const r = await d.derive('白米饭');
    expect(r!.confidence).toBeLessThan(0.6);
  });

  test('Markdown 代码块包裹 → 仍能解析', async () => {
    const client = makeClient(
      '```json\n' + JSON.stringify({ tcmLabel: '平', tcmProperty: '平', citations: [{ source: 'canon', reference: '《饮膳正要》' }] }) + '\n```'
    );
    const d = new RealLlmDeriver(client);
    const r = await d.derive('小米');
    expect(r).not.toBeNull();
    expect(r!.tcmLabel).toBe('平');
  });

  test('非法 tcmLabel 值 → 返回 null', async () => {
    const client = makeClient(JSON.stringify({ tcmLabel: 'invalid', tcmProperty: '平', citations: [{ source: 'canon', reference: 'x' }] }));
    const d = new RealLlmDeriver(client);
    expect(await d.derive('未知')).toBeNull();
  });

  test('client throw → 返回 null(不抛出,上层走 backfill)', async () => {
    const client: LlmTextClient = {
      modelVersion: 'test',
      async complete() {
        throw new LlmCallError('rate_limit', 'rate limit');
      }
    };
    const d = new RealLlmDeriver(client);
    expect(await d.derive('虾')).toBeNull();
  });

  test('空食物名 → 返回 null,不调 client', async () => {
    let called = 0;
    const client: LlmTextClient = {
      modelVersion: 'test',
      async complete() {
        called++;
        return { content: '{}', modelVersion: 'test', latencyMs: 1 };
      }
    };
    const d = new RealLlmDeriver(client);
    expect(await d.derive('   ')).toBeNull();
    expect(called).toBe(0);
  });
});
