/**
 * 隐私政策页(占位 — ce-work 阶段法务审核后替换)
 */

const PRIVACY_POLICY_BODY = `炎炎消防队隐私政策(占位文本,正式发布前由法务审核替换)

数据采集范围:
1. 健康生理信息 — 仅在你授权后读取每日步数,精度日级。
2. 医疗体检数据 — 你主动上传体检报告时,系统 OCR 解析血糖/尿酸/CRP/血脂/鼻炎记录用于长程改善验证;原始报告图片存储于 Supabase 私有 bucket,30 天后自动删除。
3. 食物照片 — 你拍摄的餐食照片送入境内多模态模型(豆包/Qwen-VL)识别,识别完成后图片仅在你的账号下保留;不出境、不用于训练第三方模型。
4. 所在城市 — 仅城市级,用于查询当地 PM2.5 与花粉指数。
5. 推送 — 用于 7:30 次晨打卡提醒,可在设置中关闭。

存储与加密:
- v1 阶段数据存储于 Supabase 境外 region(此为公开 beta 限制,正式版本前迁阿里云华东 region)。
- 敏感字段(食物识别结果、症状打卡)在数据库层做应用层 AES-256-GCM 加密(envelope encryption)。

撤回与删除:
- 你可随时在「我的 → 撤回同意」立即撤回;撤回触发 KMS 立即吊销 DEK 解密权限。
- 撤回 30 天后,所有数据将被永久硬删除,DEK 被销毁。

详见正式版本(法务审核后发布)。`;

export function PrivacyPolicy() {
  const onCopy = () => {
    void navigator.clipboard.writeText(PRIVACY_POLICY_BODY);
  };

  return (
    <main className="min-h-screen bg-paper px-7 pt-10 pb-12">
      <h1 className="text-xl font-semibold text-ink mb-6">隐私政策</h1>
      <pre className="text-sm text-ink leading-relaxed whitespace-pre-wrap font-sans select-text">
        {PRIVACY_POLICY_BODY}
      </pre>
      <button
        type="button"
        onClick={onCopy}
        className="mt-8 px-4 py-2 rounded-full border border-ink/20 text-sm text-ink"
      >
        复制全文
      </button>
    </main>
  );
}
