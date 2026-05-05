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
        <p className="text-xs text-ink/40 tracking-widest">炎炎消防队</p>

        <h1 className="mt-4 text-3xl font-semibold text-ink leading-snug">
          每餐拍一张,
          <br />
          看身体在不在「上火」
        </h1>

        <p className="mt-5 text-base text-ink/70 leading-relaxed">
          不是又一个减肥 app。不是又一个卡路里 app。
          <br />
          用中医「发物 / 寒热 / 上火」语言,告诉你哪些食物正在让你身体发炎 — 在第二天早上就能看到。
        </p>
      </section>

      <section className="px-4 pb-8 max-w-3xl mx-auto">
        <img
          src={asset('landing-hero.png')}
          alt="拍照 → 火分 → 30 天发物档案三步流程"
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
          <li>• 想知道自己「发物」到底是哪几样,而不是泛泛地"少吃发物"</li>
          <li>• 听过妈妈讲发物、对中医语言有共鸣的中产</li>
        </ul>
      </section>

      <section className="px-6 py-10 max-w-2xl mx-auto">
        <h2 className="text-base font-medium text-ink mb-4">它怎么工作</h2>
        <ol className="space-y-4 text-sm text-ink/70 leading-relaxed">
          <li>
            <span className="font-medium text-ink">每餐拍一张照</span>
            <br />
            <span className="text-ink/60">AI 识别食物,标「发 / 温和 / 平」三档,出当餐火分。</span>
          </li>
          <li>
            <span className="font-medium text-ink">次日早晨 30 秒打卡</span>
            <br />
            <span className="text-ink/60">7 维度:鼻塞 / 起痘 / 口干 / 大便 / 精神 / 浮肿 / 喉咙痒。</span>
          </li>
          <li>
            <span className="font-medium text-ink">14-30 天累积</span>
            <br />
            <span className="text-ink/60">系统帮你回归出哪几样食物,对你这个体质最容易引发反应。</span>
          </li>
        </ol>
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
