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
import { asset } from '../../services/assets';
import { LEVEL_TO_LABEL } from '../../services/score-display';
import { Button } from '../../components/Button';

export function Step4Welcome() {
  const [, navigate] = useLocation();
  const { initialFireLevel } = useOnboarding();

  return (
    <main className="min-h-screen bg-paper px-7 pt-12 pb-10 max-w-md mx-auto">
      <header className="mb-3 text-xs text-ink/50">4 / 4</header>

      <div className="flex justify-center mb-2">
        <img src={asset('achievement-unlock.png')} alt="" className="w-40 h-40 object-contain" loading="lazy" />
      </div>
      <h1 className="text-2xl font-semibold text-ink text-center">就绪了。</h1>
      {initialFireLevel && (
        <p className="mt-3 text-sm text-ink/70 leading-relaxed text-center">
          系统已为你建好初始档案,首份抗炎指数:
          <span className="font-medium text-ink">{LEVEL_TO_LABEL[initialFireLevel]}</span>。
        </p>
      )}

      <section className="mt-10 rounded-3xl bg-white px-6 py-6 flex items-start gap-4">
        <img
          src={asset('mascot-happy.png')}
          alt=""
          className="w-20 h-20 object-contain flex-shrink-0"
          loading="lazy"
        />
        <div className="flex-1">
          <h2 className="text-base font-medium text-ink">中午吃饭时,拍一张</h2>
          <p className="mt-2 text-sm text-ink/70 leading-relaxed">
            你拍的第一张餐照,会得到当餐抗炎指数(★1-5) + 添加糖估算,以及一句轻量陪伴语。
          </p>
        </div>
      </section>

      <Button block onClick={() => navigate('/camera')} className="mt-6">
        现在就拍第一张 →
      </Button>
      <Button variant="secondary" size="md" block onClick={() => navigate('/app')} className="mt-3">
        稍后再拍
      </Button>

      <p className="mt-8 text-xs text-ink/30 text-center leading-relaxed">
        步数 / 心率 接入需 iOS 快捷指令;抗炎指数当前基于饮食 + 体感打卡。
      </p>
    </main>
  );
}
