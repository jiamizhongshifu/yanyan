/**
 * 重力橘子瓶 — matter.js 物理引擎 + DeviceOrientation
 *
 * 瓶子里只放每天点亮的橘子(perfect/great/nice 三档),反映指定月份的累计成就。
 * 控糖成就不再混入瓶子(改在 Today / Insights 控糖卡里独立展示)。
 *
 * 行为:
 *   - 橘子作为 matter 动态体落进瓶子
 *   - DeviceOrientation 改 gravity.x,手机倾斜橘子会滑动
 *   - iOS 13+ 第一次进入时弹按钮请求权限
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import Matter from 'matter-js';
import { orangeIconDataUrl } from './OrangeIcon';

interface Props {
  monthLabel: string;
  perfect: number;
  great: number;
  nice: number;
}

interface BadgeSpec {
  iconUrl: string;
  size: number;
}

const ORIENT_PERM_KEY = 'soak.orient.permitted.v1';

/** iOS 13+ DeviceOrientation 权限封装 */
function isIosNeedsPermission(): boolean {
  type Ext = typeof DeviceOrientationEvent & { requestPermission?: () => Promise<string> };
  const E = (typeof DeviceOrientationEvent !== 'undefined'
    ? (DeviceOrientationEvent as Ext)
    : null);
  return !!E && typeof E.requestPermission === 'function';
}

async function requestOrientPermission(): Promise<boolean> {
  type Ext = typeof DeviceOrientationEvent & { requestPermission?: () => Promise<string> };
  const E = DeviceOrientationEvent as Ext;
  if (typeof E.requestPermission === 'function') {
    try {
      const r = await E.requestPermission();
      return r === 'granted';
    } catch {
      return false;
    }
  }
  return true;
}

export function AchievementJarPhysics({
  monthLabel,
  perfect,
  great,
  nice
}: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const engineRef = useRef<Matter.Engine | null>(null);
  const renderRef = useRef<Matter.Render | null>(null);
  const runnerRef = useRef<Matter.Runner | null>(null);
  const [needsPerm, setNeedsPerm] = useState(false);

  // 全部要进瓶子的勋章 specs(图片 url + 大小)
  // 都用 SVG dataURL(64×64 viewBox)。sprite scale = size / 64
  const badges = useMemo<BadgeSpec[]>(() => {
    const list: BadgeSpec[] = [];
    for (let i = 0; i < perfect; i++) list.push({ iconUrl: orangeIconDataUrl('perfect'), size: 64 });
    for (let i = 0; i < great; i++) list.push({ iconUrl: orangeIconDataUrl('great'), size: 56 });
    for (let i = 0; i < nice; i++) list.push({ iconUrl: orangeIconDataUrl('nice'), size: 50 });
    return list.slice(0, 24);
  }, [perfect, great, nice]);

  useEffect(() => {
    if (!canvasRef.current || !containerRef.current) return;

    const W = containerRef.current.clientWidth;
    const H = containerRef.current.clientHeight;

    const engine = Matter.Engine.create({ gravity: { x: 0, y: 1, scale: 0.001 } });
    engineRef.current = engine;

    const render = Matter.Render.create({
      canvas: canvasRef.current,
      engine,
      options: {
        width: W,
        height: H,
        wireframes: false,
        background: 'transparent',
        pixelRatio: window.devicePixelRatio || 1
      }
    });
    renderRef.current = render;

    // 瓶身静态壁 — 与 SVG JarSvg 形状一致
    // SVG path: 瓶口 70-210, 瓶肩 70→230 / 210→230 在 70-100 之间, 瓶身 50-230, 底 340
    // viewBox 280×360 与 W×H 等比例,直接用 px 值
    const wallOpts: Matter.IChamferableBodyDefinition = {
      isStatic: true,
      render: { visible: false }
    };
    const wallT = 6;
    // 瓶身左右壁(竖直,瓶身段:y 100-340)
    const bodyTopY = (H * 100) / 360;
    const bodyBotY = (H * 340) / 360;
    const bodyLeftX = (W * 50) / 280;
    const bodyRightX = (W * 230) / 280;
    const bodyHeight = bodyBotY - bodyTopY;
    const bodyCenterY = (bodyTopY + bodyBotY) / 2;

    const left = Matter.Bodies.rectangle(bodyLeftX - wallT / 2, bodyCenterY, wallT, bodyHeight, wallOpts);
    const right = Matter.Bodies.rectangle(bodyRightX + wallT / 2, bodyCenterY, wallT, bodyHeight, wallOpts);
    const bottom = Matter.Bodies.rectangle(W / 2, bodyBotY + wallT / 2, W * 0.65, wallT, wallOpts);

    // 瓶肩斜壁(瓶口 70-210 收到瓶身 50-230,y 70-100)
    const shoulderLeftX = (W * 60) / 280;
    const shoulderRightX = (W * 220) / 280;
    const shoulderY = (H * 85) / 360;
    const shoulderL = Matter.Bodies.rectangle(shoulderLeftX, shoulderY, 30, wallT, {
      ...wallOpts,
      angle: Math.PI / 4 // 45° 斜
    });
    const shoulderR = Matter.Bodies.rectangle(shoulderRightX, shoulderY, 30, wallT, {
      ...wallOpts,
      angle: -Math.PI / 4
    });

    Matter.Composite.add(engine.world, [left, right, bottom, shoulderL, shoulderR]);

    // 鼠标拖拽
    const mouse = Matter.Mouse.create(canvasRef.current);
    const mouseConstraint = Matter.MouseConstraint.create(engine, {
      mouse,
      constraint: { stiffness: 0.2, render: { visible: false } }
    });
    Matter.Composite.add(engine.world, mouseConstraint);
    render.mouse = mouse;

    Matter.Render.run(render);
    const runner = Matter.Runner.create();
    runnerRef.current = runner;
    Matter.Runner.run(runner, engine);

    // 把每个 badge 加进世界(交错下落,看着自然)
    // 投放范围:瓶口宽度 70-210(在 viewBox 280 中)
    const dropLeft = (W * 80) / 280;
    const dropRight = (W * 200) / 280;
    badges.forEach((b, i) => {
      setTimeout(() => {
        const x = dropLeft + Math.random() * (dropRight - dropLeft);
        const y = (H * 90) / 360 + Math.random() * 10; // 瓶肩稍下方掉入
        const body = Matter.Bodies.circle(x, y, b.size / 2, {
          restitution: 0.4,
          friction: 0.05,
          density: 0.0009,
          render: {
            sprite: {
              texture: b.iconUrl,
              // SVG dataURL 的 natural size 是 viewBox 的 64;sprite scale = display / natural
              xScale: b.size / 64,
              yScale: b.size / 64
            }
          }
        });
        Matter.Composite.add(engine.world, body);
      }, i * 90);
    });

    // 设备方向 → gravity.x
    const handleOrient = (ev: DeviceOrientationEvent) => {
      const gamma = ev.gamma; // -90..90
      if (gamma === null) return;
      engine.gravity.x = Math.max(-2, Math.min(2, gamma / 60));
    };

    if (isIosNeedsPermission() && localStorage.getItem(ORIENT_PERM_KEY) !== 'granted') {
      setNeedsPerm(true);
    } else {
      window.addEventListener('deviceorientation', handleOrient);
    }

    return () => {
      window.removeEventListener('deviceorientation', handleOrient);
      Matter.Render.stop(render);
      Matter.Runner.stop(runner);
      Matter.World.clear(engine.world, false);
      Matter.Engine.clear(engine);
      render.canvas.replaceWith(render.canvas.cloneNode(true) as HTMLCanvasElement);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [badges]);

  const askPermission = async () => {
    const ok = await requestOrientPermission();
    if (ok) {
      localStorage.setItem(ORIENT_PERM_KEY, 'granted');
      setNeedsPerm(false);
      // 重新挂监听(组件 effect 已结束;触发一次重渲染会重挂)
      // 简单起见直接 reload effect:
      window.dispatchEvent(new Event('orient-perm-granted'));
    }
  };

  return (
    <section className="rounded-3xl bg-white px-5 py-5" data-testid="achievement-jar">
      <div className="flex items-baseline justify-between mb-3">
        <h2 className="text-base font-medium text-ink">{monthLabel} · 勋章瓶</h2>
        <span className="text-xs text-ink/45">本月 {perfect + great + nice} 枚</span>
      </div>
      <div ref={containerRef} className="relative mx-auto" style={{ width: 280, height: 360 }}>
        {/* SVG 玻璃瓶轮廓(默认空瓶,只有玻璃 + 金色盖子) */}
        <JarSvg className="absolute inset-0 w-full h-full pointer-events-none" />
        {/* 物理 canvas */}
        <canvas
          ref={canvasRef}
          width={280}
          height={360}
          className="absolute inset-0 w-full h-full"
        />
        {/* 高光层(canvas 之上,确保玻璃光反射感) */}
        <JarHighlight className="absolute inset-0 w-full h-full pointer-events-none" />
        {needsPerm && (
          <button
            type="button"
            onClick={askPermission}
            className="absolute bottom-2 left-1/2 -translate-x-1/2 px-3 py-1.5 rounded-full bg-ink text-paper text-xs"
            data-testid="orient-perm-btn"
          >
            轻摇手机让橘子动起来 →
          </button>
        )}
      </div>
    </section>
  );
}

/** 纯 SVG 玻璃瓶 — 默认空瓶,玻璃透明 + 金色盖子 + 标签 */
function JarSvg({ className = '' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 280 360"
      className={className}
      aria-hidden="true"
      preserveAspectRatio="xMidYMid meet"
    >
      <defs>
        {/* 玻璃渐变(竖向轻微深浅) */}
        <linearGradient id="jar-glass" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#F5F1E6" stopOpacity="0.55" />
          <stop offset="50%" stopColor="#E8E2D2" stopOpacity="0.30" />
          <stop offset="100%" stopColor="#D5CDB8" stopOpacity="0.45" />
        </linearGradient>
        {/* 金色盖子渐变 */}
        <linearGradient id="jar-lid" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#E8B96B" />
          <stop offset="50%" stopColor="#C99046" />
          <stop offset="100%" stopColor="#A87432" />
        </linearGradient>
      </defs>

      {/* 瓶口收缩(窄)— 14% 高度 */}
      {/* 瓶肩过渡(梯形)— 4% 高度 */}
      {/* 瓶身(矩形,圆角)— 80% 高度 */}
      {/* 瓶底圆角(自然终止) */}

      {/* 玻璃瓶身 */}
      <path
        d="
          M 70 70
          L 70 60
          Q 70 52 78 52
          L 202 52
          Q 210 52 210 60
          L 210 70
          L 230 100
          L 230 320
          Q 230 340 210 340
          L 70 340
          Q 50 340 50 320
          L 50 100
          Z
        "
        fill="url(#jar-glass)"
        stroke="#A89E84"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />

      {/* 金色盖子 */}
      <rect
        x="60"
        y="20"
        width="160"
        height="38"
        rx="4"
        fill="url(#jar-lid)"
        stroke="#7B5320"
        strokeWidth="1.2"
      />
      {/* 盖子顶面凹槽 */}
      <line x1="64" y1="32" x2="216" y2="32" stroke="#9D6F2A" strokeWidth="0.8" opacity="0.5" />
      <line x1="64" y1="46" x2="216" y2="46" stroke="#9D6F2A" strokeWidth="0.8" opacity="0.5" />
    </svg>
  );
}

/** 玻璃高光 — 叠在 canvas 上方,加强 "玻璃感" */
function JarHighlight({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 280 360" className={className} aria-hidden="true" preserveAspectRatio="xMidYMid meet">
      {/* 左上长高光 */}
      <path
        d="M 75 110 Q 60 200 75 290"
        fill="none"
        stroke="#FFFFFF"
        strokeWidth="6"
        strokeLinecap="round"
        opacity="0.55"
      />
      {/* 右上小高光 */}
      <path
        d="M 215 95 Q 222 130 215 165"
        fill="none"
        stroke="#FFFFFF"
        strokeWidth="3"
        strokeLinecap="round"
        opacity="0.45"
      />
    </svg>
  );
}
