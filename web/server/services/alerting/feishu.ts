/**
 * 飞书机器人告警 (Phase 2 U8)
 *
 * 替换 Phase 1 webhook 占位 — 真实 fetch 飞书 custom-bot incoming webhook
 *
 * 配置:
 *   FEISHU_WEBHOOK_URL — webhook 完整 URL,失踪时退化为 console.warn(开发友好,不阻塞业务)
 *
 * 触发场景(plan U8):
 *   - 新用户问卷"减肥目标"占比 > 30%
 *   - LLM 月度成本超 80% / 100%
 *   - Web Push 失败率超 30%
 *   - EB 候选生成率 < 50%(Phase 2 U2 上线后)
 *
 * 设计:fire-and-forget,失败不抛出(告警链路自身不该阻塞业务)
 */

export type AlertLevel = 'info' | 'warning' | 'critical';

export interface AlertPayload {
  level: AlertLevel;
  title: string;
  body: string;
  /** 可选附加数据,会序列化进消息体 */
  context?: Record<string, unknown>;
}

const LEVEL_PREFIX: Record<AlertLevel, string> = {
  info: '🟢',
  warning: '🟡',
  critical: '🔴'
};

/** 真实发送(可注入 fetch 用于测试) */
export async function sendFeishuAlert(
  payload: AlertPayload,
  fetchImpl: typeof fetch = fetch
): Promise<{ sent: boolean; reason?: string }> {
  const url = process.env.FEISHU_WEBHOOK_URL;
  if (!url) {
    // 没配置 — 开发 / 测试场景,降级到 console
    // eslint-disable-next-line no-console
    console.warn(`[feishu-alert ${payload.level}] ${payload.title}: ${payload.body}`);
    return { sent: false, reason: 'no_webhook_configured' };
  }
  try {
    const text = [
      `${LEVEL_PREFIX[payload.level]} ${payload.title}`,
      '',
      payload.body,
      payload.context ? '' : '',
      payload.context ? `context: ${JSON.stringify(payload.context)}` : ''
    ]
      .filter(Boolean)
      .join('\n');

    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 5_000);
    const res = await fetchImpl(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ msg_type: 'text', content: { text } }),
      signal: ctrl.signal
    });
    clearTimeout(timer);
    if (!res.ok) {
      return { sent: false, reason: `http_${res.status}` };
    }
    return { sent: true };
  } catch (err) {
    return { sent: false, reason: err instanceof Error ? err.name : 'unknown' };
  }
}
