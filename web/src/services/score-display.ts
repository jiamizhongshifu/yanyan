/**
 * 单一映射点 — server 内部值 → 用户看到的文案/星级。
 *
 * 后端契约保持 0-100 fireScore + 4 档 FireLevel('平'|'微火'|'中火'|'大火'),
 * 前端把它们映射成「抗炎指数」(分数越高越健康)+ 5 星 + 正向陪伴语。
 *
 * 任何页面/组件**不要**自己拼分数文案,统一从这里取。
 */

import type { FireLevel, MealItem } from './meals';

export const SCORE_LABEL = '抗炎指数';

/** 4 档 server 枚举 → 5 星制(1 星预留极端,日常 2-5) */
export const LEVEL_TO_STARS: Record<FireLevel, number> = {
  平: 5,
  微火: 4,
  中火: 3,
  大火: 2
};

/** server 枚举 → 用户看到的中文标签(去火字隐喻,保留东方色彩) */
export const LEVEL_TO_LABEL: Record<FireLevel, string> = {
  平: '平',
  微火: '轻盈',
  中火: '微暖',
  大火: '留心'
};

/** 单餐结果页 hero 区下方的 4 行陪伴语 */
export const LEVEL_TO_ENCOURAGEMENT: Record<FireLevel, string> = {
  平: '这一餐很清气,身体会喜欢。',
  微火: '整体不错,继续这样的节奏。',
  中火: '稍微浓一点,下一餐换点轻盈的就好。',
  大火: '今天给身体留点空间,下一餐清淡一点会更舒服。'
};

/** Home dial 下方的 4 行总览语 */
export const LEVEL_TO_HOME_ENCOURAGEMENT: Record<FireLevel, string> = {
  平: '状态平稳,继续这样保持就好。',
  微火: '整体清气,身体在向好状态走。',
  中火: '略温和一点,多喝水多休息。',
  大火: '今天给身体一点空间,清淡一餐会很舒服。'
};

/** 0-100 fireScore → 1-5 stars(用于趋势图等连续场景) */
export function scoreToStars(fireScore: number): number {
  const inv = 100 - fireScore;
  return Math.max(1, Math.min(5, Math.round((inv / 100) * 4 + 1)));
}

interface RatedLabel {
  text: string;
  tone: 'good' | 'mild' | 'neutral';
}

/** DII 数值 → 文字带方向 */
export function diiToLabel(dii: number | null): RatedLabel | null {
  if (dii === null) return null;
  if (dii < -2) return { text: '强抗炎', tone: 'good' };
  if (dii < -0.5) return { text: '轻度抗炎', tone: 'good' };
  if (dii <= 0.5) return { text: '中性', tone: 'neutral' };
  if (dii <= 2) return { text: '轻度促炎', tone: 'mild' };
  return { text: '促炎略明显', tone: 'mild' };
}

/** GI 数值 → 低/中/高 */
export function giToLabel(gi: number | null): RatedLabel | null {
  if (gi === null) return null;
  if (gi < 55) return { text: 'GI 低', tone: 'good' };
  if (gi < 70) return { text: 'GI 中', tone: 'neutral' };
  return { text: 'GI 高', tone: 'mild' };
}

/** 单条食物的模板化正向评价(零 LLM 成本) */
export function foodCommentary(c: NonNullable<MealItem['classification']>): string {
  const parts: string[] = [];

  // 1. DII 优先句(如足够强)
  if (c.diiScore !== null) {
    if (c.diiScore < -2) parts.push('抗炎信号很强');
    else if (c.diiScore < -0.5) parts.push('略偏抗炎');
    else if (c.diiScore > 2) parts.push('促炎略明显,下次少一点');
    else if (c.diiScore > 0.5) parts.push('略偏促炎,搭配点蔬菜更好');
  }

  // 2. GI 句
  if (c.gi !== null) {
    if (c.gi < 55) parts.push('升糖较慢');
    else if (c.gi >= 70) parts.push('升糖偏快,可搭配蛋白质');
  }

  // 3. 性味句(凉/寒)
  if (c.tcmProperty === '寒' || c.tcmProperty === '凉') {
    parts.push('性偏凉,搭温食物更平衡');
  }

  // 4. 发物提示(中性正向语气)
  if (c.tcmLabel === '发') {
    parts.push('记下来,看次晨体感的反应');
  }

  if (parts.length === 0) {
    // 全是 null + 平 + 温和 — 给一句兜底
    return '常见食材,正常吃就好。';
  }
  return parts.join(',') + '。';
}
