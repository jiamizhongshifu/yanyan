/**
 * 餐食结果页 — 识别卡(食物名 + 抗炎指数)+ 食物分析与评价
 *
 * Hero 区:
 *   - SVG 装饰底纹(草本叶子 + 圆点)
 *   - 食物名大标题(单餐 1 项时显示具体名;2+ 时 顿号连接)
 *   - 5 颗星 + 等级标签
 *   - 抗炎指数 0-100 大数字
 *   - mascot + 陪伴语
 *
 * 下方:每条食物的 FoodItemCard(成分分析 + 评价)
 */

import { useEffect, useState } from 'react';
import { useLocation } from 'wouter';
import { FoodItemCard } from '../components/FoodItemCard';
import { Stars } from '../components/InflammationDial';
import {
  postMealFeedback,
  updateMealItems,
  type FireLevel,
  type MealFeedbackKind,
  type ScoreBreakdown
} from '../services/meals';
import { useLastMeal } from '../store/lastMeal';
import { asset } from '../services/assets';
import {
  LEVEL_TO_ENCOURAGEMENT,
  LEVEL_TO_LABEL,
  LEVEL_TO_STARS,
  scoreToAntiInflam
} from '../services/score-display';

const LEVEL_COLOR: Record<FireLevel, string> = {
  平: 'text-fire-ping',
  微火: 'text-fire-ping',
  中火: 'text-fire-mild',
  大火: 'text-fire-mid'
};

const LEVEL_DECOR_COLOR: Record<FireLevel, string> = {
  平: 'text-fire-ping/15',
  微火: 'text-fire-ping/15',
  中火: 'text-fire-mild/15',
  大火: 'text-fire-mid/15'
};

/** 4 档独立的水豚表情(gpt-image-2 生成):欢呼 / 满足 / 思考 / 关切 */
const LEVEL_MASCOT: Record<FireLevel, string> = {
  平: 'mascot-cheer.png', // ★5 双手举起欢呼,星星爱心环绕
  微火: 'mascot-content.png', // ★4 双爪交叠,平静微笑,眼神弯月
  中火: 'mascot-pensive.png', // ★3 托腮思考,温和提醒
  大火: 'mascot-caring.png' // ★2 双爪贴胸,关切共情(非焦虑非难过)
};

export function MealResult() {
  const [, navigate] = useLocation();
  const result = useLastMeal((s) => s.result);
  const setLastMeal = useLastMeal((s) => s.set);
  const [savingIdx, setSavingIdx] = useState<number | null>(null);
  const [showAlgorithm, setShowAlgorithm] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  useEffect(() => {
    if (!result) {
      navigate('/camera');
    }
  }, [result, navigate]);

  if (!result) return null;

  const antiInflam = scoreToAntiInflam(result.fireScore);
  const titleText =
    result.items.length === 0
      ? '这一餐'
      : result.items.length === 1
      ? result.items[0].name
      : result.items.map((i) => i.name).join('、');

  const handleFlag = async (itemName: string, kind: MealFeedbackKind, note?: string) => {
    await postMealFeedback(result.mealId, itemName, kind, note);
  };

  const handleEditIngredients = async (itemIdx: number, newIngredients: string[]) => {
    if (savingIdx !== null) return;
    setSavingIdx(itemIdx);
    setEditError(null);
    const newItems = result.items.map((it, i) => ({
      name: it.name,
      confidence: it.confidence,
      ingredients: i === itemIdx ? newIngredients : it.ingredients
    }));
    const updated = await updateMealItems(result.mealId, newItems);
    if (updated) {
      setLastMeal(updated);
    } else {
      setEditError('保存失败,请重试。');
    }
    setSavingIdx(null);
  };

  return (
    <main className="min-h-screen bg-paper px-6 pt-10 pb-10 max-w-md mx-auto">
      {/* 识别结果 Hero 卡 */}
      <section
        className="relative rounded-3xl bg-white px-6 pt-9 pb-7 mb-4 overflow-hidden"
        data-testid="meal-hero"
      >
        <TitleDecor className={`absolute inset-0 w-full h-full pointer-events-none ${LEVEL_DECOR_COLOR[result.level]}`} />
        <div className="relative">
          <p className="text-[11px] text-ink/45 text-center tracking-[0.25em]">这 一 餐</p>
          <h1
            className="mt-4 text-2xl font-medium text-center text-ink leading-snug px-2 break-words"
            data-testid="meal-title"
          >
            {titleText}
          </h1>
          <div className="mt-4 flex items-center justify-center gap-2 text-sm">
            <Stars filled={LEVEL_TO_STARS[result.level]} className="text-base" testId="fire-stars" />
            <span
              className={`font-medium ${LEVEL_COLOR[result.level]}`}
              data-testid="fire-level"
            >
              {LEVEL_TO_LABEL[result.level]}
            </span>
          </div>
          <p className="mt-3 text-center leading-none">
            <span className="text-[11px] text-ink/45 mr-1.5">抗炎指数</span>
            <span
              className={`text-5xl font-light ${LEVEL_COLOR[result.level]}`}
              data-testid="fire-score"
            >
              {antiInflam}
            </span>
            <span className="text-xs text-ink/40 ml-1">/ 100</span>
            <button
              type="button"
              onClick={() => setShowAlgorithm(true)}
              className="ml-2 inline-flex items-center justify-center w-5 h-5 rounded-full bg-ink/8 text-ink/55 text-[11px] active:bg-ink/15 align-middle"
              aria-label="查看抗炎指数算法"
              data-testid="algorithm-btn"
            >
              ?
            </button>
          </p>
          {result.breakdown && (
            <p
              className="mt-2 text-center text-[11px] text-ink/45 leading-relaxed px-3"
              data-testid="score-breakdown"
            >
              {formatBreakdown(result.breakdown)}
            </p>
          )}
        </div>
      </section>

      {/* mascot + 陪伴对话气泡 */}
      <section className="mb-5 px-1 flex items-center gap-2.5">
        <img
          src={asset(LEVEL_MASCOT[result.level])}
          alt=""
          className="w-14 h-14 object-contain flex-shrink-0"
          loading="lazy"
          data-testid="meal-mascot"
        />
        <div className="relative flex-1 rounded-2xl bg-white px-4 py-3">
          {/* 气泡尾部三角 */}
          <span
            aria-hidden="true"
            className="absolute -left-1.5 top-1/2 -translate-y-1/2 w-3 h-3 bg-white rotate-45"
          />
          <p className="relative text-sm text-ink/75 leading-relaxed">
            {LEVEL_TO_ENCOURAGEMENT[result.level]}
          </p>
        </div>
      </section>

      {/* 食物分析与评价 */}
      <section>
        <h2 className="text-sm font-medium text-ink/70 mb-3">
          食物分析 · {result.items.length} 项
        </h2>
        {result.items.map((item, idx) => (
          <FoodItemCard
            key={`${item.name}-${idx}`}
            item={item}
            onSendFeedback={(name, kind, note) => void handleFlag(name, kind, note)}
            onSubmitIngredients={(newIngredients) => void handleEditIngredients(idx, newIngredients)}
            isSaving={savingIdx === idx}
          />
        ))}
        {editError && (
          <p className="mt-2 text-xs text-fire-mid" role="alert">
            {editError}
          </p>
        )}
      </section>

      {result.unrecognizedNames.length > 0 && (
        <section className="mt-4 rounded-xl bg-ink/5 px-4 py-3">
          <h3 className="text-xs text-ink/60 mb-1">未收录食物(已加入回填队列)</h3>
          <p className="text-sm text-ink/70">{result.unrecognizedNames.join('、')}</p>
        </section>
      )}

      <footer className="mt-10 flex gap-3">
        <button
          type="button"
          onClick={() => navigate('/camera')}
          className="flex-1 rounded-full border-2 border-ink/15 text-ink py-3 text-sm"
        >
          再拍一张
        </button>
        <button
          type="button"
          onClick={() => navigate('/app')}
          className="flex-1 rounded-full bg-ink text-white py-3 text-sm font-medium"
        >
          回主页
        </button>
      </footer>

      {showAlgorithm && (
        <AlgorithmSheet onClose={() => setShowAlgorithm(false)} />
      )}
    </main>
  );
}

/**
 * 抗炎指数算法说明弹层(底部 sheet 风格)
 */
function AlgorithmSheet({ onClose }: { onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40"
      onClick={onClose}
      role="dialog"
      aria-label="抗炎指数算法说明"
    >
      <div
        className="w-full max-w-md rounded-t-3xl bg-paper px-6 pt-6 pb-8 max-h-[85vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between mb-3">
          <h2 className="text-lg font-medium text-ink">抗炎指数算法</h2>
          <button
            type="button"
            onClick={onClose}
            className="text-ink/45 active:text-ink text-sm"
            aria-label="关闭"
          >
            ✕
          </button>
        </div>

        <p className="text-sm text-ink/70 leading-relaxed">
          每一餐我们综合 <span className="font-medium text-ink">5 个信号</span> 联合打分,
          折算出 0-100 的抗炎指数,数字越高代表这一餐对身体越清气。
        </p>

        <h3 className="mt-5 text-sm font-medium text-ink">第 1 步:为每条食物找分类</h3>
        <ul className="mt-2 text-xs text-ink/65 leading-relaxed space-y-1 pl-4 list-disc">
          <li>菜名直接命中 DB(如"白米饭")→ 用该条目数据</li>
          <li>复合菜(如"野生菌火锅")→ LLM 返回主料数组,逐个查 DB,投票合成 TCM 标签;DII / GI / 添加糖等数值取均值</li>
          <li>仍未匹配 → 标"未收录",入回填队列,后续人工补录</li>
        </ul>

        <h3 className="mt-5 text-sm font-medium text-ink">第 2 步:每条食物的火分(0-100)</h3>
        <p className="mt-2 text-xs text-ink/65 leading-relaxed">5 个信号叠加:</p>
        <ul className="mt-1.5 text-[11px] text-ink/65 leading-relaxed space-y-0.5 pl-4 list-disc">
          <li>
            <span className="font-medium">中医标签</span>:发 +55、温和 +22、平 0
          </li>
          <li>
            <span className="font-medium">DII 膳食炎症指数</span>:&gt; +0.5 才加分,最高 +25
          </li>
          <li>
            <span className="font-medium">GI 升糖指数</span>:≥70 +10、≥55 +3
          </li>
          <li>
            <span className="font-medium">添加糖</span>:每 1g +1.2,封顶 +30
          </li>
          <li>
            <span className="font-medium">AGEs 高级糖化终产物</span>:&gt;5000 起加,封顶 +15
          </li>
          <li>
            <span className="font-medium">主料未匹配率</span>:每 100% 未识别 +12(数据缺失带的小惩罚)
          </li>
        </ul>

        <h3 className="mt-5 text-sm font-medium text-ink">第 3 步:整餐均值 → 抗炎指数</h3>
        <p className="mt-2 text-xs text-ink/65 leading-relaxed">
          fireScore = 所有 item 的均值;抗炎指数 = 100 − fireScore。未识别条目计 +12。
        </p>
        <ul className="mt-2 text-[11px] text-ink/55 leading-relaxed space-y-0.5">
          <li>★★★★★ 平 — 抗炎 75-100,这一餐很清气</li>
          <li>★★★★ 轻盈 — 抗炎 50-75,整体不错</li>
          <li>★★★ 微暖 — 抗炎 25-50,稍微浓一点</li>
          <li>★★ 留心 — 抗炎 0-25,下一餐换轻盈的</li>
        </ul>

        <h3 className="mt-5 text-sm font-medium text-ink">数据来源</h3>
        <ul className="mt-2 text-[11px] text-ink/55 leading-relaxed space-y-0.5">
          <li>• 发物分类:《本草纲目》《中华本草》等典籍</li>
          <li>• DII:Shivappa et al. 2014 膳食炎症指数公式</li>
          <li>• GI / AGEs / 营养:USDA FoodData Central + 中国食物成分表 2018</li>
        </ul>

        <p className="mt-6 text-[11px] text-ink/40 leading-relaxed">
          本指数是生活方式参考,不构成医疗建议。识别有偏差时点 👎 告诉我们。
        </p>
      </div>
    </div>
  );
}

const BREAKDOWN_LABELS: Array<{ key: keyof ScoreBreakdown; label: string }> = [
  { key: 'tcmLabel', label: '中医' },
  { key: 'tcmProperty', label: '性味' },
  { key: 'dii', label: 'DII' },
  { key: 'gi', label: '升糖' },
  { key: 'sugar', label: '糖' },
  { key: 'ages', label: 'AGEs' },
  { key: 'unmatched', label: '未识别' },
  { key: 'baseline', label: '基线' }
];

function formatBreakdown(b: ScoreBreakdown): string {
  // 仅显示绝对值 ≥ 1 的分量,用「+」前缀,负值用「−」(DII 抗炎奖励)
  const parts = BREAKDOWN_LABELS.flatMap(({ key, label }) => {
    const v = b[key];
    if (Math.abs(v) < 1) return [];
    const sign = v < 0 ? '−' : '+';
    const abs = Math.abs(v);
    return [`${sign}${abs % 1 === 0 ? abs.toFixed(0) : abs.toFixed(1)} ${label}`];
  });
  if (parts.length === 0) return '基线 0(完美无瑕)';
  return `构成:${parts.join(' · ')}`;
}

/**
 * 标题装饰底纹 — 4 片叶子 + 5 个圆点 + 2 圈空心圆,
 * 全 currentColor,父层用 text-fire-xxx/15 控制透明度。
 */
function TitleDecor({ className = '' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 400 240"
      preserveAspectRatio="xMidYMid slice"
      className={className}
      aria-hidden="true"
    >
      {/* 左上叶子 */}
      <path
        d="M30 38 Q40 20 60 26 Q66 44 48 56 Q32 56 30 38 Z"
        fill="currentColor"
      />
      {/* 右上叶子 */}
      <path
        d="M340 30 Q360 14 372 32 Q364 50 348 50 Q336 44 340 30 Z"
        fill="currentColor"
      />
      {/* 左下叶子 */}
      <path
        d="M16 198 Q34 188 46 204 Q42 222 24 220 Q12 214 16 198 Z"
        fill="currentColor"
      />
      {/* 右下叶子 */}
      <path
        d="M348 196 Q368 186 378 204 Q372 222 354 222 Q344 214 348 196 Z"
        fill="currentColor"
      />
      {/* 圆点散落 */}
      <circle cx="90" cy="22" r="3" fill="currentColor" />
      <circle cx="310" cy="78" r="2.5" fill="currentColor" />
      <circle cx="76" cy="172" r="2.5" fill="currentColor" />
      <circle cx="318" cy="184" r="3" fill="currentColor" />
      <circle cx="200" cy="14" r="1.8" fill="currentColor" />
      {/* 空心圆 */}
      <circle cx="380" cy="120" r="14" fill="none" stroke="currentColor" strokeWidth="1" />
      <circle cx="20" cy="118" r="10" fill="none" stroke="currentColor" strokeWidth="1" />
    </svg>
  );
}
