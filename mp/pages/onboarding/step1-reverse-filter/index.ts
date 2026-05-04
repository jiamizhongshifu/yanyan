/**
 * Onboarding Step 1 — 反向定位筛选
 *
 * 5 选 1 单选;选项措辞为占位,ce-work 阶段用户访谈替换。
 * 严守 R3:不出现"减肥/卡路里"字样。
 */

import { REVERSE_FILTER_CHOICES, type ReverseFilterChoice } from '../../../services/onboarding';

const CHOICE_LABELS: Record<ReverseFilterChoice, string> = {
  rhinitis: '想改鼻炎',
  blood_sugar: '想改血糖',
  uric_acid: '想改尿酸',
  checkup_abnormal: '想改体检异常',
  curious: '看看而已'
};

interface PageData {
  choices: Array<{ key: ReverseFilterChoice; label: string }>;
  selected: ReverseFilterChoice | null;
}

Page<PageData, { onSelect: (e: WechatMiniprogram.CustomEvent) => void; onNext: () => void }>({
  data: {
    choices: REVERSE_FILTER_CHOICES.map((key) => ({ key, label: CHOICE_LABELS[key] })),
    selected: null
  },

  onSelect(e) {
    const key = e.currentTarget.dataset.choice as ReverseFilterChoice;
    this.setData({ selected: key });
  },

  onNext() {
    if (!this.data.selected) {
      wx.showToast({ title: '请先选一项', icon: 'none' });
      return;
    }
    const app = getApp() as { globalData: { onboarding: { reverseFilterChoice: ReverseFilterChoice | null } } };
    app.globalData.onboarding.reverseFilterChoice = this.data.selected;
    wx.navigateTo({ url: '/pages/onboarding/step2-symptoms-grid/index' });
  }
});
