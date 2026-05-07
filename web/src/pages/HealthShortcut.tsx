/**
 * iOS 快捷指令配置页 — 教用户从 Apple Health 自动同步步数到 Soak
 *
 * 现实约束:Web App 无法直接读 HealthKit;唯一靠谱路径是用户用「快捷指令」app
 * 配一条自动化(每天某时刻执行),从健康 app 读 today steps 后 POST 到我们的 API。
 */

import { Link, useLocation } from 'wouter';
import { LevelIcon } from '../components/LevelIcon';
import { getCurrentAccessToken } from '../services/auth';
import { useEffect, useState } from 'react';

const API_URL = '/api/v1/users/me/health/steps';

export function HealthShortcut() {
  const [, navigate] = useLocation();
  const [token, setToken] = useState<string | null>(null);

  useEffect(() => {
    void getCurrentAccessToken().then(setToken);
  }, []);

  const cfgSnippet = `# 快捷指令"获取健康数据"输出 → 字典:
{
  "date":  当前日期 → 格式化为 YYYY-MM-DD,
  "steps": 健康数据·步数·今天总和 → 整数,
  "source": "shortcut"
}

# "获取 URL 内容"动作:
URL:    ${typeof window !== 'undefined' ? window.location.origin : 'https://web-psi-topaz-58.vercel.app'}${API_URL}
方式:   POST
请求体: 上方字典(JSON)
头部:
  Content-Type: application/json
  Authorization: Bearer <把下方 token 粘到这里>`;

  return (
    <main className="min-h-screen bg-paper px-6 pt-12 pb-24 max-w-md mx-auto" data-testid="health-shortcut">
      <button
        type="button"
        onClick={() => navigate('/app')}
        className="text-sm text-ink/50 mb-4"
      >
        ← 返回今天
      </button>

      <header className="mb-6">
        <h1 className="text-2xl font-semibold text-ink">Apple Health 自动同步</h1>
        <p className="mt-2 text-sm text-ink/50 leading-relaxed">
          用一条 iOS 快捷指令,每天早上自动从「健康」app 读取昨日 / 当日步数,推送到 Soak。
          省去手动录入。
        </p>
      </header>

      <section className="rounded-3xl bg-white px-6 py-6 mb-5">
        <h2 className="text-base font-medium text-ink mb-3">三步配置</h2>
        <ol className="space-y-4 text-sm text-ink/70 leading-relaxed">
          <li>
            <span className="font-medium text-ink">① 打开 iOS「快捷指令」app</span>,
            点右上 + 新建一条快捷指令
          </li>
          <li>
            <span className="font-medium text-ink">② 添加两个动作:</span>
            <div className="mt-2 rounded-xl bg-paper px-3 py-3 text-xs whitespace-pre-wrap font-mono text-ink/70">
              {cfgSnippet}
            </div>
          </li>
          <li>
            <span className="font-medium text-ink">③ 点底部「自动化」</span>,选「每天 08:00」
            → 运行刚才那条快捷指令。完成。
          </li>
        </ol>
      </section>

      <section className="rounded-3xl bg-white px-6 py-6 mb-5">
        <h2 className="text-base font-medium text-ink mb-3">你的同步 token(Bearer)</h2>
        <p className="text-xs text-ink/50 mb-3 leading-relaxed">
          把下面这段粘到快捷指令的 Authorization 头里。token 当前会话有效;
          快捷指令推送失败时回到这页重新拷贝即可。
        </p>
        <textarea
          readOnly
          rows={3}
          value={token ?? '加载中…'}
          className="w-full text-[10px] font-mono p-3 rounded-xl border border-ink/15 bg-paper resize-none"
          onFocus={(e) => e.currentTarget.select()}
        />
        <p className="mt-2 text-[11px] text-ink/30">
          安全提示:不要把 token 转发给他人。只贴到自己的快捷指令里。
        </p>
      </section>

      <section className="rounded-3xl bg-white px-6 py-6">
        <h2 className="text-base font-medium text-ink mb-3">手动录入也能用</h2>
        <p className="text-sm text-ink/70 leading-relaxed">
          没装快捷指令也没关系 — 在「今天」页步数输入框直接填数字也会同步到 server,
          换设备也能看到。Apple Health / 微信运动 / Garmin 等更深度集成在 Phase 3 计划。
        </p>
        <Link
          href="/app"
          className="mt-5 block w-full text-center rounded-full bg-ink text-white py-3 text-sm font-medium"
        >
          回到今天
        </Link>
      </section>

      <div className="mt-8 flex items-center gap-3 opacity-50">
        <LevelIcon level="平" className="w-12 h-12" />
        <LevelIcon level="微火" className="w-12 h-12" />
        <LevelIcon level="中火" className="w-12 h-12" />
        <LevelIcon level="大火" className="w-12 h-12" />
      </div>
    </main>
  );
}
