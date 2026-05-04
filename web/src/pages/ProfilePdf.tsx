/**
 * 30 天体质档案 v0.5 打印页 (plan U13b)
 *
 * H5/PWA pivot 简化:
 *   - 服务端返回结构化数据(/profile/v05)
 *   - 此页用 CSS @media print 排版,window.print() 让用户保存为 PDF
 *   - 服务端 puppeteer + OSS 签名 URL 留到 Phase 2(原 plan 微信小程序方案)
 *
 * 累计 < 30 天:显示进度卡 "Day X / 30,还差 Y 天"
 */

import { useEffect, useState } from 'react';
import { fetchProfileV05, type FetchProfileResult, type ProfileV05Data } from '../services/profile';

function MiniBar({ point, max }: { point: { avgFireScore: number | null }; max: number }) {
  if (point.avgFireScore === null) {
    return <span className="inline-block w-1.5 mx-px h-1 bg-ink/10 align-bottom" />;
  }
  const h = Math.max(2, Math.round((point.avgFireScore / max) * 40));
  return <span className="inline-block w-1.5 mx-px bg-ink/60 align-bottom" style={{ height: `${h}px` }} />;
}

function ProfileBody({ data }: { data: ProfileV05Data }) {
  const max = Math.max(100, ...data.dailyTrend.map((p) => p.avgFireScore ?? 0));
  return (
    <article className="bg-white px-6 py-8 print:px-10 print:py-10 max-w-2xl mx-auto" data-testid="profile-body">
      <header className="mb-6">
        <p className="text-xs text-ink/40">炎炎消防队</p>
        <h1 className="mt-1 text-2xl font-semibold text-ink">{data.title}</h1>
        <p className="mt-2 text-xs text-ink/50">
          生成于 {new Date(data.generatedAt).toLocaleDateString('zh-CN')} · 累计打卡 {data.cumulativeCheckinDays} 天
        </p>
      </header>

      <section className="mb-6" data-testid="trend-section">
        <h2 className="text-sm font-medium text-ink mb-3">30 天 Yan-Score 趋势</h2>
        <div className="flex items-end h-12 border-b border-ink/10" aria-label="30 天趋势条形图">
          {data.dailyTrend.map((p) => (
            <MiniBar key={p.date} point={p} max={max} />
          ))}
        </div>
        <div className="mt-2 grid grid-cols-4 text-xs text-ink/50">
          <span>发 {data.faCounts.faTotal}</span>
          <span>温和 {data.faCounts.mildTotal}</span>
          <span>平 {data.faCounts.calmTotal}</span>
          <span>未识别 {data.faCounts.unknownTotal}</span>
        </div>
      </section>

      <section className="mb-6" data-testid="common-fa-section">
        <h2 className="text-sm font-medium text-ink mb-3">群体常见发物(参考)</h2>
        <ul className="space-y-1 text-sm text-ink">
          {data.commonFaFoods.map((f) => (
            <li key={f.name}>
              <span>{f.name}</span>
              {f.citations[0] && (
                <span className="ml-2 text-xs text-ink/40">— {f.citations[0].reference}</span>
              )}
            </li>
          ))}
        </ul>
      </section>

      <section className="mb-6" data-testid="checkup-section">
        <h2 className="text-sm font-medium text-ink mb-3">体检报告对照</h2>
        <p className="text-xs text-ink/40">
          未上传体检报告。Phase 2 OCR 上线后,可在「我的 → 上传体检报告」自动比对。
        </p>
      </section>

      <section className="mb-2" data-testid="disclaimers-section">
        <h2 className="text-sm font-medium text-ink mb-3">免责声明</h2>
        <ol className="space-y-1.5 text-xs text-ink/60 list-decimal pl-5">
          {data.disclaimers.map((d) => (
            <li key={d}>{d}</li>
          ))}
        </ol>
      </section>
    </article>
  );
}

function NotEligibleCard({ days, required }: { days: number; required: number }) {
  const remaining = Math.max(0, required - days);
  const pct = Math.min(100, Math.round((days / required) * 100));
  return (
    <main className="min-h-screen bg-paper px-5 pt-12 pb-24" data-testid="profile-not-eligible">
      <header className="mb-6">
        <h1 className="text-xl font-medium text-ink">30 天体质档案</h1>
      </header>
      <section className="rounded-2xl bg-white px-6 py-6">
        <p className="text-sm text-ink">Day {days} / {required},还差 {remaining} 天</p>
        <div className="mt-4 h-2 rounded-full bg-paper overflow-hidden">
          <div className="h-full bg-ink" style={{ width: `${pct}%` }} />
        </div>
        <p className="mt-4 text-xs text-ink/50 leading-relaxed">
          坚持次晨打卡满 30 天,系统会自动为你生成第一份体质档案 v0.5。
          v0.5 是群体先验版本,Phase 2 上线后会平滑替换为基于你个体数据的 Bayesian 回归版。
        </p>
      </section>
    </main>
  );
}

export function ProfilePdf() {
  const [state, setState] = useState<FetchProfileResult | null>(null);

  useEffect(() => {
    let mounted = true;
    void fetchProfileV05().then((r) => {
      if (mounted) setState(r);
    });
    return () => {
      mounted = false;
    };
  }, []);

  if (!state) {
    return (
      <main className="min-h-screen bg-paper px-5 pt-12" data-testid="profile-loading">
        <p className="text-sm text-ink/40">加载中…</p>
      </main>
    );
  }
  if (state.kind === 'error') {
    return (
      <main className="min-h-screen bg-paper px-5 pt-12" data-testid="profile-error">
        <p className="text-sm text-fire-high">{state.message}</p>
      </main>
    );
  }
  if (state.kind === 'not_eligible') {
    return <NotEligibleCard days={state.cumulativeCheckinDays} required={state.required} />;
  }

  return (
    <main className="min-h-screen bg-paper py-8 print:py-0" data-testid="profile-eligible">
      <div className="max-w-2xl mx-auto mb-4 px-6 print:hidden">
        <button
          type="button"
          onClick={() => window.print()}
          className="px-4 py-2 rounded-full bg-ink text-white text-sm"
          data-testid="btn-print"
        >
          下载 / 打印为 PDF
        </button>
      </div>
      <ProfileBody data={state.data} />
    </main>
  );
}
