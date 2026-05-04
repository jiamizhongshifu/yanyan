/**
 * Scope 同意复选框 — Consent 页 / Onboarding step3 共用
 */

import type { ConsentScope } from '../services/consents';

interface ScopeCheckboxProps {
  scope: ConsentScope;
  label: string;
  description: string;
  checked: boolean;
  onChange: (scope: ConsentScope) => void;
}

export function ScopeCheckbox({ scope, label, description, checked, onChange }: ScopeCheckboxProps) {
  return (
    <label className="flex items-start gap-3 py-3 cursor-pointer select-none border-b border-paper last:border-b-0">
      <input
        type="checkbox"
        checked={checked}
        onChange={() => onChange(scope)}
        className="mt-1 h-5 w-5 accent-ink"
        aria-label={label}
      />
      <div className="flex-1">
        <div className="font-medium text-ink">{label}</div>
        <div className="text-sm text-ink/70 mt-1 leading-relaxed">{description}</div>
      </div>
    </label>
  );
}

export const SCOPE_COPY: Record<ConsentScope, { label: string; description: string }> = {
  health_data: {
    label: '健康生理信息',
    description: '步数、心率、血氧、睡眠等手机健康数据 — 用于综合判断你的火分。'
  },
  medical_report: {
    label: '医疗体检数据',
    description: '体检报告中的血糖、尿酸、CRP、血脂等 — 用于长程改善验证。'
  },
  photo_ai: {
    label: '食物照片 AI 识别',
    description: '你拍摄的食物照片送入境内 AI 模型识别食材,用于火分计算。照片仅在你的账号下保留,不出境。'
  },
  location: {
    label: '所在城市(空气与花粉)',
    description: '获取你所在城市的 PM2.5 与花粉数据,精度仅到城市级,不存储精确位置。'
  },
  subscribe_push: {
    label: '次晨打卡推送',
    description: '每天 7:30 提醒你完成 30 秒身体反应打卡。可在设置中随时关闭。'
  }
};
