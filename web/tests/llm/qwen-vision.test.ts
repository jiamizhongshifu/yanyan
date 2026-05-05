/**
 * Phase 2 U8 vision 端真实接入测试 — QwenVisionClient
 */

import { QwenVisionClient } from '../../server/services/llm/qwen-vision';
import { _resetMonitorForTesting, getCostSnapshot } from '../../server/services/llm/cost-monitor';
import { LlmCallError } from '../../server/services/llm/deepseek';

const MOCK_JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);

function makeFetch(handler: (req: { url: string; init?: RequestInit }) => Response | Promise<Response>): typeof fetch {
  return ((url: string, init?: RequestInit) => Promise.resolve(handler({ url, init }))) as unknown as typeof fetch;
}

function makeClient(opts: {
  fetchImpl: typeof fetch;
  download?: () => Promise<Buffer | null>;
}): QwenVisionClient {
  return new QwenVisionClient({
    apiKey: 'fake',
    model: 'qwen-vl-max-latest',
    bucket: 'food-photos',
    fetchImpl: opts.fetchImpl,
    downloadImage: opts.download ?? (async () => MOCK_JPEG)
  });
}

describe('U8 QwenVisionClient', () => {
  beforeEach(() => {
    _resetMonitorForTesting();
  });

  test('happy path: 解析 items 数组 + 记录 token', async () => {
    const fakeFetch = makeFetch(() =>
      new Response(
        JSON.stringify({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  items: [
                    { name: '清蒸鲈鱼', confidence: 0.92, addedSugarG: 0 },
                    { name: '奶茶', confidence: 0.98, addedSugarG: 50 }
                  ],
                  overallConfidence: 0.95
                })
              }
            }
          ],
          model: 'qwen-vl-max-latest',
          usage: { prompt_tokens: 1500, completion_tokens: 80 }
        }),
        { status: 200 }
      )
    );
    const client = makeClient({ fetchImpl: fakeFetch });
    const r = await client.recognize('users/u1/m/photo.jpg');
    expect(r).not.toBeNull();
    expect(r!.items).toHaveLength(2);
    expect(r!.items[0]).toEqual({ name: '清蒸鲈鱼', confidence: 0.92, addedSugarGEstimate: 0 });
    expect(r!.items[1]).toEqual({ name: '奶茶', confidence: 0.98, addedSugarGEstimate: 50 });
    expect(r!.overallConfidence).toBe(0.95);
    expect(r!.modelVersion).toBe('qwen-vl-max-latest');
    const cost = getCostSnapshot();
    expect(cost.dailyTokens.input).toBe(1500);
  });

  test('图片下载失败 → 返回 null,不调用 LLM', async () => {
    let calls = 0;
    const fakeFetch = makeFetch(() => {
      calls++;
      return new Response('{}', { status: 200 });
    });
    const client = makeClient({ fetchImpl: fakeFetch, download: async () => null });
    const r = await client.recognize('users/u1/missing.jpg');
    expect(r).toBeNull();
    expect(calls).toBe(0);
  });

  test('Markdown code fence 包裹 JSON → 仍能解析', async () => {
    const fakeFetch = makeFetch(() =>
      new Response(
        JSON.stringify({
          choices: [
            {
              message: {
                content: '```json\n' + JSON.stringify({ items: [{ name: '鸡蛋羹' }] }) + '\n```'
              }
            }
          ],
          model: 'qwen-vl-max-latest'
        }),
        { status: 200 }
      )
    );
    const client = makeClient({ fetchImpl: fakeFetch });
    const r = await client.recognize('k');
    expect(r!.items[0].name).toBe('鸡蛋羹');
  });

  test('items 中无效 entry(空 name)被过滤', async () => {
    const fakeFetch = makeFetch(() =>
      new Response(
        JSON.stringify({
          choices: [
            { message: { content: JSON.stringify({ items: [{ name: '虾' }, { name: '' }, { name: '   ' }, { foo: 'x' }], overallConfidence: 0.7 }) } }
          ],
          model: 'm'
        }),
        { status: 200 }
      )
    );
    const client = makeClient({ fetchImpl: fakeFetch });
    const r = await client.recognize('k');
    expect(r!.items).toHaveLength(1);
    expect(r!.items[0].name).toBe('虾');
  });

  test('401 unauthorized 不重试', async () => {
    let calls = 0;
    const fakeFetch = makeFetch(() => {
      calls++;
      return new Response('nope', { status: 401 });
    });
    const client = makeClient({ fetchImpl: fakeFetch });
    await expect(client.recognize('k')).rejects.toMatchObject({ kind: 'unauthorized' });
    expect(calls).toBe(1);
  });

  test('429 rate_limit 退避重试', async () => {
    let calls = 0;
    const fakeFetch = makeFetch(() => {
      calls++;
      if (calls < 2) return new Response('rl', { status: 429 });
      return new Response(
        JSON.stringify({ choices: [{ message: { content: '{"items":[{"name":"白粥"}]}' } }], model: 'm' }),
        { status: 200 }
      );
    });
    const client = makeClient({ fetchImpl: fakeFetch });
    const r = await client.recognize('k');
    expect(r!.items[0].name).toBe('白粥');
    expect(calls).toBe(2);
  });

  test('5xx 重试 3 次仍失败 → throw server', async () => {
    let calls = 0;
    const fakeFetch = makeFetch(() => {
      calls++;
      return new Response('boom', { status: 500 });
    });
    const client = makeClient({ fetchImpl: fakeFetch });
    await expect(client.recognize('k')).rejects.toMatchObject({ kind: 'server' });
    expect(calls).toBe(3);
  });

  test('LLM 返回非 JSON → 返回 null', async () => {
    const fakeFetch = makeFetch(() =>
      new Response(
        JSON.stringify({ choices: [{ message: { content: '我看到一些食物但不知道叫啥' } }], model: 'm' }),
        { status: 200 }
      )
    );
    const client = makeClient({ fetchImpl: fakeFetch });
    const r = await client.recognize('k');
    expect(r).toBeNull();
  });

  test('PNG / WEBP magic bytes 嗅探正确', async () => {
    const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a]);
    let mimeFromBody = '';
    const fakeFetch = makeFetch(({ init }) => {
      const body = JSON.parse(init!.body as string);
      const url = body.messages[1].content[0].image_url.url;
      mimeFromBody = url.split(';')[0].replace('data:', '');
      return new Response(
        JSON.stringify({ choices: [{ message: { content: '{"items":[{"name":"x"}]}' } }], model: 'm' }),
        { status: 200 }
      );
    });
    const client = makeClient({ fetchImpl: fakeFetch, download: async () => png });
    await client.recognize('k');
    expect(mimeFromBody).toBe('image/png');
  });
});
