/**
 * 「我的」页(plan U10 设置入口)
 *
 * v1 占位:
 *   - 体检报告上传入口(R31 — 后置入口,U13b 后接入)
 *   - 隐私政策 / 撤回同意
 *   - 推送设置开关(U11 接入)
 *   - 登出
 */

import { Link } from 'wouter';
import { signOut } from '../services/auth';
import { postRevoke } from '../services/consents';

export function Me() {
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

  return (
    <main className="min-h-screen bg-paper px-5 pt-12 pb-24" data-testid="me">
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
        <button
          type="button"
          onClick={() => alert('推送设置:U11 阶段接入')}
          className="w-full text-left px-5 py-4 text-sm text-ink/60"
          data-testid="link-push-settings"
        >
          打卡推送设置
        </button>
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
