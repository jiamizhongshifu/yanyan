/**
 * 「我的」页(plan U10 设置入口)
 *
 * v1:
 *   - 体检报告上传入口(R31 — 后置入口,U13b 后接入)
 *   - 隐私政策 / 撤回同意
 *   - 推送设置开关(U11)
 *   - 登出
 */

import { useEffect, useState } from 'react';
import { Link } from 'wouter';
import { signOut } from '../services/auth';
import { postRevoke } from '../services/consents';
import {
  detectPushSupport,
  getCurrentSubscription,
  subscribeToPush,
  unsubscribeFromPush
} from '../services/push';
import { track } from '../services/tracker';

export function Me() {
  const [pushSupported, setPushSupported] = useState(true);
  const [pushOn, setPushOn] = useState(false);
  const [pushBusy, setPushBusy] = useState(false);
  const [pushHint, setPushHint] = useState<string | null>(null);

  useEffect(() => {
    const sup = detectPushSupport();
    setPushSupported(sup.supported);
    if (!sup.supported) return;
    void getCurrentSubscription().then((s) => setPushOn(!!s));
  }, []);

  const onSignOut = async () => {
    await signOut();
    window.location.assign('/login');
  };

  const onRevoke = async () => {
    if (!confirm('撤回同意将立即吊销 KMS 解密权限,30 天后数据永久删除。继续?')) return;
    const ok = await postRevoke();
    if (ok) {
      await signOut();
      window.location.assign('/login');
    }
  };

  const onTogglePush = async () => {
    if (pushBusy) return;
    setPushBusy(true);
    setPushHint(null);
    try {
      if (pushOn) {
        await unsubscribeFromPush();
        setPushOn(false);
        track('push_unsubscribed');
      } else {
        const r = await subscribeToPush();
        if (r.ok) {
          setPushOn(true);
          track('push_subscribed');
        } else if (r.reason === 'permission_denied') {
          setPushHint('浏览器拒绝了通知权限,请到系统设置中允许后重试。');
        } else if (r.reason === 'no_pushmanager' || r.reason === 'no_serviceworker' || r.reason === 'no_notification') {
          setPushHint('当前浏览器不支持 Web Push。iOS 用户请「添加到主屏幕」后再试。');
        } else {
          setPushHint('开启失败,请稍后再试。');
        }
      }
    } finally {
      setPushBusy(false);
    }
  };

  return (
    <main className="min-h-screen bg-paper px-5 pt-12 pb-24 max-w-md mx-auto" data-testid="me">
      <header className="mb-6">
        <h1 className="text-xl font-medium text-ink">我的</h1>
      </header>

      <section className="rounded-2xl bg-white divide-y divide-paper">
        <Link href="/privacy-policy" className="block px-5 py-4 text-sm text-ink">
          隐私政策
        </Link>
        <button
          type="button"
          onClick={() => alert('体检报告上传:U13b 阶段实施')}
          className="w-full text-left px-5 py-4 text-sm text-ink/60"
          data-testid="link-checkup-upload"
        >
          上传体检报告(后置入口,Phase 2)
        </button>

        <div className="px-5 py-4">
          <div className="flex items-center justify-between">
            <span className="text-sm text-ink">打卡推送设置</span>
            <button
              type="button"
              onClick={onTogglePush}
              disabled={!pushSupported || pushBusy}
              className={`px-3 py-1 rounded-full text-xs ${
                pushOn ? 'bg-ink text-paper' : 'bg-paper text-ink/60 border border-ink/10'
              } ${!pushSupported || pushBusy ? 'opacity-50' : ''}`}
              data-testid="toggle-push"
              aria-pressed={pushOn}
            >
              {pushOn ? '已开启' : pushBusy ? '处理中…' : '开启'}
            </button>
          </div>
          {!pushSupported && (
            <p className="mt-2 text-xs text-ink/40" data-testid="push-unsupported">
              当前浏览器不支持 Web Push(iOS 用户请将本应用添加到主屏幕)。
            </p>
          )}
          {pushHint && (
            <p className="mt-2 text-xs text-fire-high" data-testid="push-hint">
              {pushHint}
            </p>
          )}
        </div>
      </section>

      <section className="mt-6 rounded-2xl bg-white divide-y divide-paper">
        <button
          type="button"
          onClick={onRevoke}
          className="w-full text-left px-5 py-4 text-sm text-fire-high"
          data-testid="btn-revoke"
        >
          撤回同意 / 注销账号
        </button>
        <button
          type="button"
          onClick={onSignOut}
          className="w-full text-left px-5 py-4 text-sm text-ink/60"
          data-testid="btn-signout"
        >
          退出登录
        </button>
      </section>
    </main>
  );
}
