/**
 * 水豚泡澡场景 — 纯 SVG 绘制(替代 mascot PNG 在 Body 抗炎指数 dial 中央)
 *
 * 视觉参考(2026-05-08 用户给的截图):
 *   - 水豚坐在浅蓝水面上,只露上半身
 *   - 头顶橘子(brand ID)+ 闭眼微笑 + 粉脸蛋
 *   - 两只黄色小鸭子伴左右
 *   - 全部黑色外描边,卡通矢量风
 *
 * 不传 background — 只画水豚 + 鸭子 + 水面;贴在任何 bg 都 OK。
 */

interface Props {
  className?: string;
}

export function CapybaraScene({ className = 'w-32 h-32' }: Props) {
  return (
    <svg viewBox="0 0 200 200" className={className} aria-hidden="true">
      {/* 水面 — 浅蓝椭圆 */}
      <ellipse
        cx="100"
        cy="170"
        rx="78"
        ry="13"
        fill="#A8D8E8"
        stroke="#1A1A1A"
        strokeWidth="2"
      />
      {/* 水面波纹高光 */}
      <path
        d="M 50 167 Q 60 165, 70 167"
        fill="none"
        stroke="#FFFFFF"
        strokeWidth="1.5"
        strokeLinecap="round"
        opacity="0.7"
      />
      <path
        d="M 130 167 Q 140 165, 150 167"
        fill="none"
        stroke="#FFFFFF"
        strokeWidth="1.5"
        strokeLinecap="round"
        opacity="0.7"
      />

      {/* 水豚身体(蛋形,坐姿,下半身没入水中)*/}
      <path
        d="M 100 50
           C 60 50, 50 100, 62 138
           Q 68 158, 80 162
           L 120 162
           Q 132 158, 138 138
           C 150 100, 140 50, 100 50 Z"
        fill="#C99966"
        stroke="#1A1A1A"
        strokeWidth="2.2"
        strokeLinejoin="round"
      />

      {/* 左耳 */}
      <path
        d="M 72 60 Q 64 52, 64 68 Q 70 72, 78 66 Z"
        fill="#C99966"
        stroke="#1A1A1A"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      {/* 左耳内粉 */}
      <path
        d="M 70 62 Q 67 60, 67 67 Q 71 68, 75 65 Z"
        fill="#E8A8A0"
      />

      {/* 右耳 */}
      <path
        d="M 128 60 Q 136 52, 136 68 Q 130 72, 122 66 Z"
        fill="#C99966"
        stroke="#1A1A1A"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      {/* 右耳内粉 */}
      <path
        d="M 130 62 Q 133 60, 133 67 Q 129 68, 125 65 Z"
        fill="#E8A8A0"
      />

      {/* 闭眼(微笑曲线)— 左眼 */}
      <path
        d="M 80 95 Q 85 100, 90 95"
        fill="none"
        stroke="#1A1A1A"
        strokeWidth="2.4"
        strokeLinecap="round"
      />
      {/* 闭眼 — 右眼 */}
      <path
        d="M 110 95 Q 115 100, 120 95"
        fill="none"
        stroke="#1A1A1A"
        strokeWidth="2.4"
        strokeLinecap="round"
      />

      {/* 粉脸蛋 */}
      <ellipse cx="76" cy="110" rx="7" ry="4.5" fill="#FFB7B7" opacity="0.85" />
      <ellipse cx="124" cy="110" rx="7" ry="4.5" fill="#FFB7B7" opacity="0.85" />

      {/* 鼻子 */}
      <ellipse cx="100" cy="113" rx="5" ry="3" fill="#5C3A1F" stroke="#1A1A1A" strokeWidth="1.4" />

      {/* 嘴(向下分叉的浅微笑)*/}
      <path
        d="M 100 117 Q 100 124, 94 126"
        fill="none"
        stroke="#1A1A1A"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <path
        d="M 100 117 Q 100 124, 106 126"
        fill="none"
        stroke="#1A1A1A"
        strokeWidth="1.8"
        strokeLinecap="round"
      />

      {/* 头顶橘子 — 圆 + 高光 + 叶 */}
      <circle cx="100" cy="42" r="14" fill="#FFA928" stroke="#1A1A1A" strokeWidth="1.8" />
      <ellipse cx="93" cy="36" rx="3.5" ry="2.5" fill="#FFFFFF" opacity="0.55" />
      {/* 橘子脐点 */}
      <circle cx="100" cy="48" r="1.2" fill="#1A1A1A" opacity="0.4" />
      {/* 叶子 */}
      <path
        d="M 100 28 Q 112 22, 117 30 Q 107 33, 100 30 Z"
        fill="#7BC074"
        stroke="#1A1A1A"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />

      {/* 左侧小黄鸭 */}
      <g transform="translate(34,160)">
        {/* 身体 */}
        <ellipse cx="0" cy="0" rx="11" ry="6.5" fill="#FFD93D" stroke="#1A1A1A" strokeWidth="1.6" />
        {/* 头 */}
        <circle cx="-6" cy="-5" r="5.5" fill="#FFD93D" stroke="#1A1A1A" strokeWidth="1.6" />
        {/* 喙 */}
        <path
          d="M -11 -4 L -16 -4 L -13 -1 Z"
          fill="#FF8533"
          stroke="#1A1A1A"
          strokeWidth="1.2"
          strokeLinejoin="round"
        />
        {/* 眼 */}
        <circle cx="-6" cy="-6" r="0.9" fill="#1A1A1A" />
        {/* 翅膀小线 */}
        <path
          d="M 1 -1 Q 5 -3, 8 -1"
          fill="none"
          stroke="#1A1A1A"
          strokeWidth="1.2"
          strokeLinecap="round"
        />
      </g>

      {/* 右侧小黄鸭(镜像)*/}
      <g transform="translate(166,160) scale(-1, 1)">
        <ellipse cx="0" cy="0" rx="11" ry="6.5" fill="#FFD93D" stroke="#1A1A1A" strokeWidth="1.6" />
        <circle cx="-6" cy="-5" r="5.5" fill="#FFD93D" stroke="#1A1A1A" strokeWidth="1.6" />
        <path
          d="M -11 -4 L -16 -4 L -13 -1 Z"
          fill="#FF8533"
          stroke="#1A1A1A"
          strokeWidth="1.2"
          strokeLinejoin="round"
        />
        <circle cx="-6" cy="-6" r="0.9" fill="#1A1A1A" />
        <path
          d="M 1 -1 Q 5 -3, 8 -1"
          fill="none"
          stroke="#1A1A1A"
          strokeWidth="1.2"
          strokeLinecap="round"
        />
      </g>
    </svg>
  );
}
