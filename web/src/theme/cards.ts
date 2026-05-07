/**
 * 卡片 / 按钮 视觉 token — 文档化卡片三档 + 按钮三态
 *
 * 设计基线(基于 8px 网格):
 *
 * 卡片 3 档(根据信息密度选用):
 *   - CARD_SM  小卡 / 子卡 / 列表项     rounded-xl  px-4 py-3
 *   - CARD_MD  默认内容卡 / CTA / 数据  rounded-2xl px-5 py-4
 *   - CARD_LG  Hero / 仪表盘 / 横幅      rounded-3xl px-5 py-5
 *
 * 按钮 3 态(action 强弱):
 *   - BTN_PRIMARY    主操作:深底白字 rounded-full bg-ink text-paper
 *   - BTN_SECONDARY  次操作:浅底深字 rounded-full bg-paper text-ink
 *   - BTN_TERTIARY   三级:文字链/边框 rounded-full border border-ink/15 text-ink
 *
 * 卡片底色统一 bg-white(中性,与 paper 主背景区分);
 * 强调卡(如打卡 CTA)用 bg-ink + text-paper(反色)。
 *
 * 内部数据卡(StatTile 等)可继承 CARD_SM 但去掉 bg-white 改 bg-paper,体现层级。
 *
 * ⚠️ 不要为了"复用"硬把所有卡片塞进这 3 档;只在新增组件 / 重构时优先采用。
 *    存量代码若已 work,不做 sed 大改避免视觉回归。
 */

export const CARD_SM = 'rounded-xl bg-white px-4 py-3';
export const CARD_MD = 'rounded-2xl bg-white px-5 py-4';
export const CARD_LG = 'rounded-3xl bg-white px-5 py-5';

/** Hero 类外层(Onboarding / Landing 大留白)— 例外档,不归 3 标准 */
export const CARD_HERO = 'rounded-3xl bg-white px-6 py-8';

/** 反色卡(强 CTA 横幅,e.g. 今天还没打卡) */
export const CARD_INVERSE = 'rounded-2xl bg-ink text-paper px-5 py-4';

/** 浅强调卡(暖橙底,提示类,e.g. 明早打个卡) */
export const CARD_HINT = 'rounded-2xl bg-fire-ping/10 px-4 py-4';

// ── 按钮 ─────────────────────────────────────

export const BTN_PRIMARY = 'rounded-full bg-ink text-paper py-3 text-base font-medium active:opacity-80 disabled:opacity-40 disabled:cursor-not-allowed';
export const BTN_SECONDARY = 'rounded-full bg-paper text-ink py-3 text-base font-medium active:opacity-80 disabled:opacity-40 disabled:cursor-not-allowed';
export const BTN_TERTIARY = 'rounded-full border-2 border-ink/15 text-ink py-3 text-sm active:bg-ink/5 disabled:opacity-40 disabled:cursor-not-allowed';

/** 内联紧凑按钮(用在卡片内的小操作) */
export const BTN_COMPACT_PRIMARY = 'rounded-full bg-ink text-paper px-4 py-1.5 text-xs font-medium active:opacity-80';
export const BTN_COMPACT_GHOST = 'rounded-full px-3 py-1.5 text-xs text-ink/70 active:bg-ink/5';

// ── 间距尺度(8px 网格)─────────────────────────
//   优先用这套,避免 mb-3 / mb-5 / mb-7 等不规整值
//   space-2 = 8px / space-3 = 12px / space-4 = 16px / space-6 = 24px / space-8 = 32px
//   tailwind 已自带,这里只是约定文档
