/**
 * Onboarding Step 2 — 7 维度症状频次方块矩阵
 *
 * 7 行 × 3 列(几乎没 / 偶尔 / 经常),纯打勾,无文字输入(R1)。
 * 用户可以全部跳过(symptomsFrequency 留空 → step3 显示"目前看起来很平和")。
 */

import { SYMPTOM_DIMENSIONS, SYMPTOM_FREQUENCY, type SymptomDimension, type SymptomFrequency } from '../../../services/onboarding';

const DIM_LABELS: Record<SymptomDimension, string> = {
  nasal_congestion: '鼻塞',
  acne: '起痘',
  dry_mouth: '口干',
  bowel: '大便异常',
  fatigue: '精神差 / 困倦',
  edema: '浮肿',
  throat_itch: '喉咙痒'
};

const FREQ_LABELS: Record<SymptomFrequency, string> = {
  rare: '几乎没',
  sometimes: '偶尔',
  often: '经常'
};

interface PageData {
  rows: Array<{ key: SymptomDimension; label: string; selected: SymptomFrequency | null }>;
  freqColumns: Array<{ key: SymptomFrequency; label: string }>;
}

Page<PageData, { onCellTap: (e: WechatMiniprogram.CustomEvent) => void; onNext: () => void; onSkipAll: () => void }>({
  data: {
    rows: SYMPTOM_DIMENSIONS.map((key) => ({ key, label: DIM_LABELS[key], selected: null })),
    freqColumns: SYMPTOM_FREQUENCY.map((key) => ({ key, label: FREQ_LABELS[key] }))
  },

  onCellTap(e) {
    const dim = e.currentTarget.dataset.dim as SymptomDimension;
    const freq = e.currentTarget.dataset.freq as SymptomFrequency;
    const next = this.data.rows.map((r) => (r.key === dim ? { ...r, selected: r.selected === freq ? null : freq } : r));
    this.setData({ rows: next });
  },

  onNext() {
    const summary: Partial<Record<SymptomDimension, SymptomFrequency>> = {};
    for (const r of this.data.rows) {
      if (r.selected) summary[r.key] = r.selected;
    }
    const app = getApp() as { globalData: { onboarding: { symptomsFrequency: typeof summary } } };
    app.globalData.onboarding.symptomsFrequency = summary;
    wx.navigateTo({ url: '/pages/onboarding/step3-baseline-consent/index' });
  },

  onSkipAll() {
    const app = getApp() as { globalData: { onboarding: { symptomsFrequency: Record<string, never> } } };
    app.globalData.onboarding.symptomsFrequency = {};
    wx.navigateTo({ url: '/pages/onboarding/step3-baseline-consent/index' });
  }
});
