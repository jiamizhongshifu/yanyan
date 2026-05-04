/**
 * Onboarding Step 4 — 完成引导,首次拍照 CTA
 *
 * Post-pivot:取消"微信运动授权"屏(浏览器无 wx.authorize;Web Health API 几乎不可用)。
 * 取而代之只做"首次拍照引导" — 保持 4 屏完整结构。
 *
 * 完成后 navigate('/') → 主屏(U10);U6 拍照页未上线前主屏只占位。
 */

import { useLocation } from 'wouter';
import { useOnboarding } from '../../store/onboarding';

export function Step4Welcome() {
  const [, navigate] = useLocation();
  const { initialFireLevel } = useOnboarding();

  return (
    <main className="min-h-screen bg-paper px-7 pt-12 pb-10">
      <header className="mb-3 text-xs text-ink/50">4 / 4</header>

      <h1 className="text-2xl font-semibold text-ink">就绪了。</h1>
      {initialFireLevel && (
        <p className="mt-3 text-sm text-ink/70 leading-relaxed">
          系统已为你建好初始档案,首份火分:<span className="font-medium text-ink">{initialFireLevel}</span>。
        </p>
      )}

      <section className="mt-12 rounded-2xl bg-white px-6 py-7">
        <h2 className="text-lg font-medium text-ink">中午吃饭时,拍一张</h2>
        <p className="mt-3 text-sm text-ink/60 leading-relaxed">
          这一刻是产品最重要的瞬间 — 你拍的第一张餐照,会得到一个红/黄/绿的中医语言判断,以及今晚 / 明早可以避开什么。
        </p>
        <button
          type="button"
          onClick={() => navigate('/app')}
          className="mt-6 w-full rounded-full bg-ink text-white py-3 text-base font-medium"
        >
          完成,稍后我会拍第一张
        </button>
      </section>

      <p className="mt-8 text-xs text-ink/40 text-center leading-relaxed">
        v1 阶段健康数据(步数 / 心率)接入推迟到 Phase 2;<br />
        当前火分仅基于饮食 + 体感打卡 + 环境。
      </p>
    </main>
  );
}
