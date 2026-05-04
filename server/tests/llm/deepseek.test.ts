/**
 * DeepSeek client 抽象测试
 *   - 配置错时 throw
 *   - DevTextClient fixture map 命中 / 未命中
 *   - getTextClient 默认走 DevTextClient(测试环境无 DEEPSEEK_API_KEY)
 */

import { DeepSeekTextClient, DevTextClient, getTextClient, resetTextClientForTesting } from '../../src/services/llm';
import { resetConfigForTesting } from '../../src/config';

describe('U7 LLM — DeepSeek client', () => {
  beforeEach(() => {
    resetTextClientForTesting();
    resetConfigForTesting();
  });

  test('DeepSeekTextClient 缺 apiKey 立即 throw', () => {
    expect(() => new DeepSeekTextClient('', 'https://api.deepseek.com/anthropic', 'm')).toThrow();
  });

  test('DeepSeekTextClient.complete v1 占位 throw(待 ce-work 接入 SDK)', async () => {
    const c = new DeepSeekTextClient('fake-key', 'https://api.deepseek.com/anthropic', 'deepseek-v4-pro');
    await expect(
      c.complete({ messages: [{ role: 'user', content: 'hi' }] })
    ).rejects.toThrow(/待 ce-work 阶段接入/);
  });

  test('DevTextClient fixture 命中', async () => {
    const dev = new DevTextClient();
    dev.add('清蒸鲈鱼', '{"tcm_label":"平"}');
    const res = await dev.complete({
      messages: [{ role: 'user', content: '请分类: 清蒸鲈鱼' }]
    });
    expect(res.content).toBe('{"tcm_label":"平"}');
    expect(res.modelVersion).toBe('dev-text-v1');
  });

  test('DevTextClient 未命中 → 返回 "{}" 默认', async () => {
    const dev = new DevTextClient();
    const res = await dev.complete({ messages: [{ role: 'user', content: '佛跳墙' }] });
    expect(res.content).toBe('{}');
  });

  test('getTextClient 默认(测试环境无 KEY)→ DevTextClient', () => {
    delete process.env.DEEPSEEK_API_KEY;
    const c = getTextClient();
    expect(c).toBeInstanceOf(DevTextClient);
  });

  test('getTextClient KEY 配置后 → DeepSeekTextClient', () => {
    process.env.DEEPSEEK_API_KEY = 'fake-test-key';
    try {
      const c = getTextClient();
      expect(c).toBeInstanceOf(DeepSeekTextClient);
    } finally {
      delete process.env.DEEPSEEK_API_KEY;
    }
  });
});
