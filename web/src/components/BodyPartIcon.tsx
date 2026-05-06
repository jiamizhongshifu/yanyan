/**
 * 身体 4 Part 图标 — 纯 SVG(替代 body-{food,symptom,env,activity}.png)
 *
 *   - food     饭碗 + 筷子(暖橘色调)
 *   - symptom  人物简笔(蓝绿色调,坐姿冥想感)
 *   - env      云 + 太阳(浅蓝调)
 *   - activity 脚印 + 草叶(暖绿调)
 *
 * 用法:`<BodyPartIcon variant="food" className="w-16 h-16" />`
 */

export type BodyPartVariant = 'food' | 'symptom' | 'env' | 'activity';

interface Props {
  variant: BodyPartVariant;
  className?: string;
}

export function BodyPartIcon({ variant, className = 'w-16 h-16' }: Props) {
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden="true">
      {variant === 'food' && <FoodIcon />}
      {variant === 'symptom' && <SymptomIcon />}
      {variant === 'env' && <EnvIcon />}
      {variant === 'activity' && <ActivityIcon />}
    </svg>
  );
}

function FoodIcon() {
  return (
    <g>
      <defs>
        <radialGradient id="bp-food" cx="40%" cy="35%" r="65%">
          <stop offset="0%" stopColor="#FFF8E0" />
          <stop offset="100%" stopColor="#E8C896" />
        </radialGradient>
      </defs>
      {/* 米饭饭碗 */}
      <path
        d="M 12 36 Q 32 22 52 36 L 50 50 Q 32 56 14 50 Z"
        fill="url(#bp-food)"
        stroke="#A07440"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
      {/* 米饭顶部纹理 */}
      <ellipse cx="32" cy="34" rx="18" ry="3" fill="#FFFFFF" opacity="0.7" />
      <circle cx="24" cy="32" r="1.2" fill="#A07440" opacity="0.4" />
      <circle cx="32" cy="30" r="1.2" fill="#A07440" opacity="0.4" />
      <circle cx="40" cy="32" r="1.2" fill="#A07440" opacity="0.4" />
      {/* 筷子 */}
      <line x1="40" y1="14" x2="56" y2="40" stroke="#9D6F2A" strokeWidth="2.2" strokeLinecap="round" />
      <line x1="44" y1="12" x2="60" y2="38" stroke="#9D6F2A" strokeWidth="2.2" strokeLinecap="round" />
      {/* 顶上小橘子(品牌点缀) */}
      <circle cx="14" cy="20" r="5" fill="#E8954E" stroke="#8B4D1A" strokeWidth="1" />
      <path d="M 12 16 Q 16 12 18 18" fill="none" stroke="#7BA56A" strokeWidth="1.4" strokeLinecap="round" />
    </g>
  );
}

function SymptomIcon() {
  return (
    <g>
      <defs>
        <radialGradient id="bp-symptom" cx="50%" cy="40%" r="60%">
          <stop offset="0%" stopColor="#FFE5D0" />
          <stop offset="100%" stopColor="#F4B89A" />
        </radialGradient>
      </defs>
      {/* 光环 */}
      <circle cx="32" cy="32" r="26" fill="none" stroke="#B5D4C2" strokeWidth="1.2" opacity="0.6" />
      <circle cx="32" cy="32" r="22" fill="none" stroke="#B5D4C2" strokeWidth="1.2" opacity="0.4" />
      {/* 头 */}
      <circle cx="32" cy="22" r="6" fill="url(#bp-symptom)" stroke="#A07050" strokeWidth="1.2" />
      {/* 身体(坐姿冥想) */}
      <path
        d="M 22 50 Q 22 38 32 32 Q 42 38 42 50 Z"
        fill="url(#bp-symptom)"
        stroke="#A07050"
        strokeWidth="1.2"
        strokeLinejoin="round"
      />
      {/* 双手合十 */}
      <path
        d="M 32 36 L 30 44 L 32 46 L 34 44 Z"
        fill="#FFF0E0"
        stroke="#A07050"
        strokeWidth="0.8"
        strokeLinejoin="round"
      />
      {/* 头顶橘子(品牌点缀) */}
      <circle cx="32" cy="14" r="3.5" fill="#E8954E" stroke="#8B4D1A" strokeWidth="0.8" />
      {/* 闭眼 */}
      <path d="M 28 22 Q 30 23 31 22" fill="none" stroke="#5A3A2A" strokeWidth="0.8" strokeLinecap="round" />
      <path d="M 33 22 Q 35 23 36 22" fill="none" stroke="#5A3A2A" strokeWidth="0.8" strokeLinecap="round" />
    </g>
  );
}

function EnvIcon() {
  return (
    <g>
      <defs>
        <radialGradient id="bp-env-cloud" cx="50%" cy="50%" r="55%">
          <stop offset="0%" stopColor="#FFFFFF" />
          <stop offset="100%" stopColor="#C8DDE8" />
        </radialGradient>
      </defs>
      {/* 太阳 */}
      <circle cx="20" cy="22" r="9" fill="#F5D27A" stroke="#C99046" strokeWidth="1.2" />
      {/* 太阳光线 */}
      <line x1="20" y1="6" x2="20" y2="11" stroke="#C99046" strokeWidth="1.6" strokeLinecap="round" />
      <line x1="20" y1="33" x2="20" y2="38" stroke="#C99046" strokeWidth="1.6" strokeLinecap="round" />
      <line x1="4" y1="22" x2="9" y2="22" stroke="#C99046" strokeWidth="1.6" strokeLinecap="round" />
      <line x1="31" y1="22" x2="36" y2="22" stroke="#C99046" strokeWidth="1.6" strokeLinecap="round" />
      <line x1="9" y1="11" x2="12.5" y2="14.5" stroke="#C99046" strokeWidth="1.6" strokeLinecap="round" />
      <line x1="27.5" y1="29.5" x2="31" y2="33" stroke="#C99046" strokeWidth="1.6" strokeLinecap="round" />
      {/* 云 */}
      <path
        d="M 26 44 Q 26 36 34 36 Q 38 32 44 36 Q 54 34 56 44 Q 58 52 50 52 L 28 52 Q 22 52 26 44 Z"
        fill="url(#bp-env-cloud)"
        stroke="#7B98AC"
        strokeWidth="1.2"
        strokeLinejoin="round"
      />
    </g>
  );
}

function ActivityIcon() {
  return (
    <g>
      <defs>
        <radialGradient id="bp-act" cx="40%" cy="35%" r="65%">
          <stop offset="0%" stopColor="#FAEAA0" />
          <stop offset="100%" stopColor="#E0A642" />
        </radialGradient>
      </defs>
      {/* 草叶(右后) */}
      <path d="M 50 12 Q 56 18 54 28" fill="none" stroke="#7BA56A" strokeWidth="2" strokeLinecap="round" />
      <path d="M 54 14 Q 60 20 58 30" fill="none" stroke="#7BA56A" strokeWidth="2" strokeLinecap="round" />
      {/* 大脚印 */}
      <ellipse cx="22" cy="40" rx="8" ry="11" fill="url(#bp-act)" stroke="#7C5615" strokeWidth="1.2" />
      {/* 4 个小脚趾 */}
      <circle cx="16" cy="28" r="2" fill="url(#bp-act)" stroke="#7C5615" strokeWidth="1" />
      <circle cx="20" cy="25" r="2" fill="url(#bp-act)" stroke="#7C5615" strokeWidth="1" />
      <circle cx="24" cy="25" r="2" fill="url(#bp-act)" stroke="#7C5615" strokeWidth="1" />
      <circle cx="28" cy="28" r="2" fill="url(#bp-act)" stroke="#7C5615" strokeWidth="1" />
      {/* 小脚印(右前) */}
      <ellipse cx="46" cy="46" rx="5" ry="7" fill="url(#bp-act)" stroke="#7C5615" strokeWidth="1" opacity="0.85" />
      <circle cx="42" cy="38" r="1.3" fill="url(#bp-act)" stroke="#7C5615" strokeWidth="0.8" opacity="0.85" />
      <circle cx="45" cy="36" r="1.3" fill="url(#bp-act)" stroke="#7C5615" strokeWidth="0.8" opacity="0.85" />
      <circle cx="48" cy="36" r="1.3" fill="url(#bp-act)" stroke="#7C5615" strokeWidth="0.8" opacity="0.85" />
      <circle cx="51" cy="38" r="1.3" fill="url(#bp-act)" stroke="#7C5615" strokeWidth="0.8" opacity="0.85" />
    </g>
  );
}
