/**
 * 「我的」页 — 设置入口
 *
 * 分组:
 *   1. 顶部:用户身份 + mascot 装饰
 *   2. 健康集成:Apple Health 快捷指令
 *   3. 数据档案:易诱炎食物 / 体检报告(占位)/ 隐私政策
 *   4. 通知:推送设置
 *   5. 账号:撤回同意 / 退出登录
 */

import { useEffect, useState } from 'react';
import { Link, useLocation } from 'wouter';
import { signOut } from '../services/auth';
import { useAuth, getCurrentAccessToken } from '../services/auth';
import { postRevoke } from '../services/consents';
import {
  detectPushSupport,
  getCurrentSubscription,
  subscribeToPush,
  unsubscribeFromPush
} from '../services/push';
import { track } from '../services/tracker';
import { asset } from '../services/assets';

export function Me() {
  const [, navigate] = useLocation();
  const { session } = useAuth();
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
    navigate('/login');
  };

  const onRevoke = async () => {
    if (!confirm('撤回同意将立即吊销 KMS 解密权限,30 天后数据永久删除。继续?')) return;
    const ok = await postRevoke();
    if (ok) {
      await signOut();
      navigate('/login');
    }
  };

  const [exporting, setExporting] = useState(false);
  const onExportCsv = async () => {
    if (exporting) return;
    setExporting(true);
    try {
      const token = await getCurrentAccessToken();
      if (!token) {
        alert('未登录');
        return;
      }
      const res = await fetch('/api/v1/users/me/export', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) {
        alert('导出失败,请稍后再试');
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `yanyan-export-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } finally {
      setExporting(false);
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

  const userIdentity = session?.user?.email ?? (session?.user?.id ? session.user.id.slice(0, 8) + '…' : '未登录');

  return (
    <main className="min-h-screen bg-paper px-5 pt-12 pb-24 max-w-md mx-auto" data-testid="me">
      <header className="mb-6 flex items-center justify-between">
        <button
          type="button"
          onClick={() => navigate('/app')}
          className="text-sm text-ink/45"
        >
          ← 返回
        </button>
        <h1 className="text-base font-medium text-ink">我的</h1>
        <div className="w-10" />
      </header>

      {/* 身份卡 — mascot + email */}
      <section className="mb-5 rounded-3xl bg-white px-5 py-5 flex items-center gap-4">
        <img
          src={asset('mascot-happy.png')}
          alt=""
          className="w-16 h-16 object-contain flex-shrink-0"
          loading="lazy"
        />
        <div className="flex-1 min-w-0">
          <p className="text-xs text-ink/45">已登录</p>
          <p className="mt-0.5 text-sm text-ink truncate font-mono">{userIdentity}</p>
        </div>
      </section>

      {/* 健康集成 */}
      <SectionTitle>健康集成</SectionTitle>
      <section className="rounded-2xl bg-white divide-y divide-paper">
        <Link
          href="/me/health-shortcut"
          className="flex items-center justify-between px-5 py-4 text-sm text-ink"
        >
          <span>🍎 Apple Health 步数同步</span>
          <span className="text-ink/30">→</span>
        </Link>
      </section>

      {/* 数据档案 */}
      <SectionTitle>数据档案</SectionTitle>
      <section className="rounded-2xl bg-white divide-y divide-paper">
        <Link
          href="/findings"
          className="flex items-center justify-between px-5 py-4 text-sm text-ink"
        >
          <span>🔥 易诱炎食物档案</span>
          <span className="text-ink/30">→</span>
        </Link>
        <button
          type="button"
          onClick={() => alert('体检报告上传:Phase 2 实施')}
          className="w-full flex items-center justify-between px-5 py-4 text-sm text-ink/55"
          data-testid="link-checkup-upload"
        >
          <span>📋 上传体检报告</span>
          <span className="text-ink/30 text-xs">Phase 2</span>
        </button>
        <button
          type="button"
          onClick={() => void onExportCsv()}
          disabled={exporting}
          className="w-full flex items-center justify-between px-5 py-4 text-sm text-ink disabled:opacity-50"
          data-testid="btn-export-csv"
        >
          <span>📥 导出我的数据(CSV)</span>
          <span className="text-ink/30 text-xs">{exporting ? '导出中…' : '↓'}</span>
        </button>
        <Link
          href="/privacy-policy"
          className="flex items-center justify-between px-5 py-4 text-sm text-ink"
        >
          <span>📜 隐私政策</span>
          <span className="text-ink/30">→</span>
        </Link>
      </section>

      {/* 通知 */}
      <SectionTitle>通知</SectionTitle>
      <section className="rounded-2xl bg-white px-5 py-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-ink">🌅 次晨打卡推送</p>
            <p className="mt-0.5 text-[11px] text-ink/45">每天早上 7:00 提醒</p>
          </div>
          <button
            type="button"
            onClick={onTogglePush}
            disabled={!pushSupported || pushBusy}
            className={`px-3.5 py-1.5 rounded-full text-xs font-medium ${
              pushOn ? 'bg-ink text-paper' : 'bg-paper text-ink/60 border border-ink/10'
            } ${!pushSupported || pushBusy ? 'opacity-50' : ''}`}
            data-testid="toggle-push"
            aria-pressed={pushOn}
          >
            {pushOn ? '已开启' : pushBusy ? '处理中…' : '开启'}
          </button>
        </div>
        {!pushSupported && (
          <p className="mt-3 text-xs text-ink/40" data-testid="push-unsupported">
            当前浏览器不支持 Web Push(iOS 用户请将本应用添加到主屏幕)。
          </p>
        )}
        {pushHint && (
          <p className="mt-3 text-xs text-fire-high" data-testid="push-hint">
            {pushHint}
          </p>
        )}
      </section>

      {/* 账号 */}
      <SectionTitle>账号</SectionTitle>
      <section className="rounded-2xl bg-white divide-y divide-paper">
        <button
          type="button"
          onClick={() => void onSignOut()}
          className="w-full text-left px-5 py-4 text-sm text-ink/65"
          data-testid="btn-signout"
        >
          退出登录
        </button>
        <button
          type="button"
          onClick={() => void onRevoke()}
          className="w-full text-left px-5 py-4 text-sm text-fire-high"
          data-testid="btn-revoke"
        >
          撤回同意 / 注销账号
        </button>
      </section>

      <p className="mt-10 text-center text-[11px] text-ink/35 leading-relaxed">
        v1 私人 beta · 控糖 × 炎症 × 次晨体感
      </p>
    </main>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="mt-5 mb-2 px-1 text-[11px] tracking-wide text-ink/45 uppercase">{children}</h2>
  );
}
