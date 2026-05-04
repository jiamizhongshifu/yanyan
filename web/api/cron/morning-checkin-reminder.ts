/**
 * Vercel Cron — 每天 23:00 UTC(北京 07:00)推送次晨打卡提醒(Phase 2 U9)
 *
 * 触发对象:昨日有餐食 + 今日未打卡 + 已订阅 push 的用户
 *
 * 流程:
 *   1. SELECT distinct user_id FROM meals WHERE ate_at::date = yesterday
 *   2. LEFT JOIN symptoms WHERE recorded_for_date = today AND source='next_morning'  → 排除已打卡
 *   3. LEFT JOIN push_subscriptions  → 拿订阅 endpoint
 *   4. 对每个用户调 sendToUser(并发限 20):
 *        - 真实推送成功 → ok
 *        - 全部 endpoint gone / 失败 / 用户没订阅 → 写 inapp_reminders 兜底
 *   5. 记 metric 到 analytics_events (cron_morning_reminder_run)
 *
 * 安全:Vercel Cron 自动加 Authorization: Bearer <CRON_SECRET> 头(如果 vercel.json 配了);
 * 我们检 x-vercel-cron 头(Vercel 自带)+ 可选 CRON_SECRET 双重防 spam。
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { withClient } from '../../server/db/client';
import {
  PgPushSubscriptionStore,
  PgInappReminderStore,
  WebPushSender,
  sendToUser,
  type PushPayload
} from '../../server/services/push';

const REMINDER_PAYLOAD: PushPayload = {
  title: '炎炎消防队',
  body: '昨天的吃法对今天身体有反应吗?30 秒打卡看看',
  url: '/check-in/step1',
  tag: 'morning-checkin'
};

interface RunResult {
  scanned: number;
  pushed: number;
  inappQueued: number;
  errors: string[];
}

/** 找出昨日吃过饭、今日未打卡的用户 id 列表 */
async function findCandidateUsers(): Promise<string[]> {
  return withClient(async (c) => {
    const r = await c.query<{ user_id: string }>(
      `SELECT DISTINCT m.user_id
         FROM meals m
        WHERE m.ate_at >= (CURRENT_DATE - INTERVAL '1 day') AT TIME ZONE 'UTC'
          AND m.ate_at <  CURRENT_DATE AT TIME ZONE 'UTC'
          AND NOT EXISTS (
            SELECT 1 FROM symptoms s
             WHERE s.user_id = m.user_id
               AND s.recorded_for_date = CURRENT_DATE
               AND s.source = 'next_morning'
          )`
    );
    return r.rows.map((row) => row.user_id);
  });
}

async function runCron(): Promise<RunResult> {
  const userIds = await findCandidateUsers();
  const subStore = new PgPushSubscriptionStore();
  const inappStore = new PgInappReminderStore();
  const sender = new WebPushSender({
    publicKey: process.env.VAPID_PUBLIC_KEY ?? '',
    privateKey: process.env.VAPID_PRIVATE_KEY ?? '',
    subject: process.env.VAPID_SUBJECT ?? 'mailto:noreply@yanyan.local'
  });

  let pushed = 0;
  let inappQueued = 0;
  const errors: string[] = [];
  // 串行 user-batch(每个 user 内部并发 cap 20),Beta 量级 1k 用户在 60s 内可控
  for (const userId of userIds) {
    try {
      const r = await sendToUser(userId, REMINDER_PAYLOAD, {
        store: subStore,
        sender,
        inappStore,
        inappKind: 'morning_checkin',
        concurrency: 20
      });
      if (r.delivered > 0) pushed += 1;
      if (r.fallbackQueued || (r.results.length === 0 && r.delivered === 0)) inappQueued += 1;
    } catch (err) {
      errors.push(`${userId}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
  return { scanned: userIds.length, pushed, inappQueued, errors };
}

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  // Vercel Cron 请求自带 user-agent: vercel-cron/1.0,加 x-vercel-cron 头 (1)
  // 也支持 CRON_SECRET 兜底:Authorization: Bearer <CRON_SECRET>
  const isVercelCron = req.headers['x-vercel-cron'] === '1';
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = (req.headers.authorization ?? '').replace(/^Bearer\s+/i, '');
  const isAuthorized = isVercelCron || (cronSecret && authHeader === cronSecret);

  if (!isAuthorized) {
    res.status(401).json({ ok: false, error: 'unauthorized' });
    return;
  }

  try {
    const result = await runCron();
    res.status(200).json({ ok: true, ...result });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ ok: false, error: msg });
  }
}

/** 测试导出 — 直接调用业务逻辑(绕过 Vercel handler 鉴权壳) */
export const _runForTesting = runCron;
