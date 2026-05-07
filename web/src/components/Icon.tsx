/**
 * 站内 SVG 图标库 — 替代 emoji。
 *
 * 全部 24×24 viewBox monoline 风格,默认 currentColor stroke,
 * 调用方通过 className 控制大小 + 颜色:
 *   <Icon name="meal" className="w-5 h-5 text-ink/50" />
 *
 * 风格统一:
 *   - 1.6-1.8 stroke-width
 *   - round line cap + round join
 *   - 不填实(fill="none")让线条主义清晰
 */

interface Props {
  name: IconName;
  className?: string;
}

export type IconName =
  | 'meal'        // 拍餐 lunchbox
  | 'sugar'      // 控糖 candy
  | 'drop'       // 喝水 / 水
  | 'moon'       // 次晨打卡 / 睡眠
  | 'steps'      // 步数 footprints
  | 'camera'     // 拍照
  | 'download'   // 下载导出
  | 'document'   // 隐私政策 / 文档
  | 'lock'       // 未解锁 / 锁定
  | 'sun'        // 完美一天 / today tab
  | 'cloud-sun'  // 美好一天
  | 'cloud'      // 奈斯一天
  | 'body'       // 身体 tab
  | 'sparkle'    // 洞悉 tab / 装饰
  | 'check'      // 已完成
  | 'logout'     // 登出
  | 'bell'       // 通知
  | 'user';      // 个人中心 / 我的

const PATHS: Record<IconName, JSX.Element> = {
  meal: (
    <>
      {/* 中式餐盒(lunchbox)俯视:外框 + 中线 + 一勺 */}
      <rect x="3" y="6" width="18" height="13" rx="2" />
      <path d="M3 11h18" />
      <path d="M9 15h6" />
      <path d="M12 3v3" />
    </>
  ),
  sugar: (
    <>
      {/* 棒棒糖:圆头 + 螺旋 + 木棒 */}
      <circle cx="9" cy="9" r="6" />
      <path d="M5 9a4 4 0 0 1 8 0" />
      <path d="M13.5 13.5l6 6" />
    </>
  ),
  drop: (
    <>
      {/* 水滴 */}
      <path d="M12 3 c 0 0 -7 8 -7 13 a 7 7 0 0 0 14 0 c 0 -5 -7 -13 -7 -13 z" />
    </>
  ),
  moon: (
    <>
      {/* 弯月 */}
      <path d="M21 12.8 A 9 9 0 1 1 11.2 3 a 7 7 0 0 0 9.8 9.8 z" />
    </>
  ),
  steps: (
    <>
      {/* 双脚印 */}
      <path d="M6 4 c -2 0 -3 2 -3 4 c 0 2 1 3 3 3 c 1.5 0 2.5 -1 2.5 -2.5 V 6.5 C 8.5 5 7.5 4 6 4 z" />
      <path d="M5 13 v 3 a 1 1 0 0 0 2 0 v -1" />
      <path d="M16 9 c -2 0 -3 2 -3 4 c 0 2 1 3 3 3 c 1.5 0 2.5 -1 2.5 -2.5 v -2 C 18.5 10 17.5 9 16 9 z" />
      <path d="M15 18 v 2 a 1 1 0 0 0 2 0 v -1" />
    </>
  ),
  camera: (
    <>
      {/* 相机 */}
      <path d="M3 8 a 2 2 0 0 1 2 -2 h 2.5 l 1.5 -2 h 6 l 1.5 2 H 19 a 2 2 0 0 1 2 2 v 9 a 2 2 0 0 1 -2 2 H 5 a 2 2 0 0 1 -2 -2 z" />
      <circle cx="12" cy="13" r="3.5" />
    </>
  ),
  download: (
    <>
      {/* 下载箭头 */}
      <path d="M12 4 v 11" />
      <path d="M7 10 l 5 5 l 5 -5" />
      <path d="M5 19 h 14" />
    </>
  ),
  document: (
    <>
      {/* 文档(卷起一角) */}
      <path d="M14 3 H 6 a 2 2 0 0 0 -2 2 v 14 a 2 2 0 0 0 2 2 h 12 a 2 2 0 0 0 2 -2 V 9 z" />
      <path d="M14 3 v 6 h 6" />
      <path d="M8 13 h 8" />
      <path d="M8 17 h 5" />
    </>
  ),
  lock: (
    <>
      <rect x="5" y="11" width="14" height="10" rx="2" />
      <path d="M8 11 V 7 a 4 4 0 1 1 8 0 v 4" />
    </>
  ),
  sun: (
    <>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2 v 2 M 12 20 v 2 M 4.93 4.93 l 1.41 1.41 M 17.66 17.66 l 1.41 1.41 M 2 12 h 2 M 20 12 h 2 M 4.93 19.07 l 1.41 -1.41 M 17.66 6.34 l 1.41 -1.41" />
    </>
  ),
  'cloud-sun': (
    <>
      <circle cx="7" cy="7" r="2.5" />
      <path d="M7 1.5 v 1.5 M 1.5 7 h 1.5 M 11 4 l 1 -1 M 4 11 l -1 1" />
      <path d="M9 15 a 4 4 0 0 1 7.5 -1.5 a 3 3 0 0 1 0.5 6 H 10 a 3.5 3.5 0 0 1 -1 -4.5 z" />
    </>
  ),
  cloud: (
    <>
      <path d="M5 17 a 3.5 3.5 0 0 1 1 -6.5 a 5 5 0 0 1 9.5 1 a 3 3 0 0 1 0 6 H 5 z" />
    </>
  ),
  body: (
    <>
      {/* 身体半月 (Yin-yang 简化:左半实 / 右半虚) */}
      <circle cx="12" cy="12" r="9" />
      <path d="M12 3 a 9 9 0 0 0 0 18 a 4.5 4.5 0 0 1 0 -9 a 4.5 4.5 0 0 0 0 -9 z" fill="currentColor" stroke="none" />
    </>
  ),
  sparkle: (
    <>
      <path d="M12 3 l 1.8 5.4 L 19 10 l -5.2 1.6 L 12 17 l -1.8 -5.4 L 5 10 l 5.2 -1.6 z" />
      <path d="M19 4 l 0.6 1.8 L 21 6 l -1.4 0.5 L 19 8 l -0.6 -1.5 L 17 6 l 1.4 -0.2 z" />
    </>
  ),
  check: (
    <>
      <path d="M5 13 l 4 4 L 19 7" />
    </>
  ),
  logout: (
    <>
      <path d="M9 21 H 5 a 2 2 0 0 1 -2 -2 V 5 a 2 2 0 0 1 2 -2 h 4" />
      <path d="M16 17 l 5 -5 l -5 -5" />
      <path d="M21 12 H 9" />
    </>
  ),
  bell: (
    <>
      <path d="M6 8 a 6 6 0 0 1 12 0 c 0 7 3 9 3 9 H 3 s 3 -2 3 -9 z" />
      <path d="M10 21 a 2 2 0 0 0 4 0" />
    </>
  ),
  user: (
    <>
      {/* 头 + 肩膀外圈 */}
      <circle cx="12" cy="9" r="4" />
      <path d="M4 21 c 0 -4 4 -7 8 -7 s 8 3 8 7" />
    </>
  )
};

// sun / sparkle / lock 已经是 outline-only,统一所有用 fill=none + stroke
export function Icon({ name, className = 'w-5 h-5' }: Props) {
  const isFilled = name === 'body'; // 身体那个半月需要部分填充
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill={isFilled ? 'none' : 'none'}
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {PATHS[name]}
    </svg>
  );
}
