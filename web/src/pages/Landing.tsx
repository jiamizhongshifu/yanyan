/**
 * Landing 落地页(公开,无 RequireAuth)
 *
 * 漏斗顶部:首屏 hero + 价值主张 + CTA "30 秒测炎症指数"
 * 不引导登录;登录在 quiz 后才出现。
 */

import { Link } from 'wouter';
import { asset } from '../services/assets';

export function Landing() {
  return (
    <main className="min-h-screen bg-paper" data-testid="landing">
      <section className="px-6 pt-12 pb-8 max-w-2xl mx-auto">
        <img
          src={asset('soak-wordmark.png')}
          alt="Soak"
          className="h-9 w-auto object-contain"
          loading="eager"
        />
        <p className="sr-only">Soak</p>

        <h1 className="mt-4 text-3xl font-semibold text-ink leading-snug">
          每餐拍一张,
          <br />
          看身体的炎症与糖
        </h1>

        <p className="mt-5 text-base text-ink/70 leading-relaxed">
          不是又一个减肥 app,也不是又一个卡路里 app。
          <br />
          每餐拍一张,告诉你今天吃了多少糖、哪些食物在让身体发炎,第二天早上看到答案。
        </p>
      </section>

      <section className="px-4 pb-8 max-w-3xl mx-auto">
        <img
          src={asset('landing-hero.png')}
          alt="拍照 → 炎症指数 → 30 天体质档案三步流程"
          className="w-full rounded-2xl shadow-sm"
          loading="eager"
          data-testid="landing-hero-img"
        />
      </section>

      <section className="px-6 pb-12 max-w-2xl mx-auto">
        <Link
          href="/quiz/step1"
          className="block w-full text-center rounded-full bg-ink text-white py-4 text-base font-medium"
          data-testid="cta-quiz"
        >
          30 秒测一下你当前的炎症指数 →
        </Link>
        <p className="mt-3 text-xs text-ink/40 text-center">
          不需要注册。完成后给你一份初步评估。
        </p>
      </section>

      <section className="px-6 py-10 max-w-2xl mx-auto">
        <h2 className="text-base font-medium text-ink mb-4">这个产品是给谁的</h2>
        <ul className="space-y-3 text-sm text-ink/70 leading-relaxed">
          <li>• 体检报告里有 1-2 项异常(血糖偏高 / 尿酸 / 鼻炎),意识到要改但不知道从哪下手</li>
          <li>• 想真的知道自己每天吃了多少糖,而不是凭感觉"少吃甜的"</li>
          <li>• 想找出哪几样食物在让自己身体发炎,而不是泛泛少吃这少吃那</li>
        </ul>
      </section>

      <section className="px-6 py-10 max-w-2xl mx-auto">
        <h2 className="text-base font-medium text-ink mb-6 text-center">它怎么工作</h2>
        <div className="space-y-6">
          <div className="flex items-center gap-4 rounded-3xl bg-white px-5 py-4">
            <img src={asset('landing-step-photo.png')} alt="" className="w-20 h-20 object-contain flex-shrink-0" loading="lazy" />
            <div>
              <p className="text-sm font-medium text-ink">① 每餐拍一张照</p>
              <p className="mt-1.5 text-xs text-ink/60 leading-relaxed">
                AI 识别食物,估算这一餐的添加糖与碳水,标三档反应程度,给当餐炎症分。
              </p>
            </div>
          </div>
          <div className="flex items-center gap-4 rounded-3xl bg-white px-5 py-4">
            <img src={asset('landing-step-checkin.png')} alt="" className="w-20 h-20 object-contain flex-shrink-0" loading="lazy" />
            <div>
              <p className="text-sm font-medium text-ink">② 次日早晨 30 秒打卡</p>
              <p className="mt-1.5 text-xs text-ink/60 leading-relaxed">
                7 维度:鼻塞 / 起痘 / 口干 / 大便 / 精神 / 浮肿 / 喉咙痒。
              </p>
            </div>
          </div>
          <div className="flex items-center gap-4 rounded-3xl bg-white px-5 py-4">
            <img src={asset('landing-step-archive.png')} alt="" className="w-20 h-20 object-contain flex-shrink-0" loading="lazy" />
            <div>
              <p className="text-sm font-medium text-ink">③ 14-30 天累积</p>
              <p className="mt-1.5 text-xs text-ink/60 leading-relaxed">
                系统统计你的减糖累计,回归出哪几样食物对你这个体质最容易引发反应。
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="px-6 py-10 pb-20 max-w-2xl mx-auto border-t border-ink/5">
        <p className="text-xs text-ink/40 leading-relaxed">
          本工具仅作生活方式参考,不构成医疗建议、不替代诊疗、不涉及任何疾病诊断或治疗承诺。
          若有任何不适,请就医并咨询执业医师 / 注册营养师。
          <Link href="/privacy-policy" className="ml-2 underline">
            隐私政策
          </Link>
        </p>
      </section>
    </main>
  );
}
