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
import { badgeIconDataUrl } from './BadgeIcon';
import { pickShape, tierOfShape, type Tier } from '../services/badgePicker';

interface DayEntry {
  date: string; // YYYY-MM-DD
  tier: Tier;   // 'nice' | 'great' | 'perfect'(none 由调用方过滤掉)
}

interface Props {
  monthLabel: string;
  /** 当月达成 tier ≠ none 的所有日子(包含乐观今日)— 每条决定一枚勋章的形状 */
  days: DayEntry[];
}

/** 按 tier 决定 sprite 大小,perfect 最大、nice 最小 */
const SIZE_BY_TIER: Record<Tier, number> = {
  perfect: 64,
  great: 56,
  nice: 50
};

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

/**
 * 同会话内"上次见过的瓶子状态"缓存:防止反复进出 Insights 反复看到掉落动画。
 * 关闭浏览器 / 切账号会清(sessionStorage 语义),不污染跨用户数据。
 */
const JAR_SEEN_KEY = 'yanyan.jar.lastSeen';
const JAR_SEEN_TTL_MS = 60 * 60 * 1000; // 1 小时内同样的瓶子状态视为"已见过",直接落底不动画

interface JarSeenState {
  sig: string;
  ts: number;
}
function shouldSkipDropAnimation(sig: string): boolean {
  if (typeof sessionStorage === 'undefined') return false;
  try {
    const raw = sessionStorage.getItem(JAR_SEEN_KEY);
    if (!raw) return false;
    const s = JSON.parse(raw) as JarSeenState;
    return s.sig === sig && Date.now() - s.ts < JAR_SEEN_TTL_MS;
  } catch {
    return false;
  }
}
function markJarSeen(sig: string) {
  if (typeof sessionStorage === 'undefined') return;
  try {
    sessionStorage.setItem(JAR_SEEN_KEY, JSON.stringify({ sig, ts: Date.now() }));
  } catch {
    // 配额满 / 隐私模式 — 不影响主流程
  }
}

export function AchievementJarPhysics({ monthLabel, days }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const engineRef = useRef<Matter.Engine | null>(null);
  const renderRef = useRef<Matter.Render | null>(null);
  const runnerRef = useRef<Matter.Runner | null>(null);
  /** 已加进世界的橘子 body — 切换月份重建橘子时,只清这些不动瓶壁 */
  const orangeBodiesRef = useRef<Matter.Body[]>([]);
  /** 还没释放的延时 timer(切月/卸载时清掉,避免对已 dispose 引擎写入) */
  const dropTimersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const [needsPerm, setNeedsPerm] = useState(false);

  // 每个 day → 一枚 badge sprite(形状由 pickShape 决定,大小按 tier)
  const badges = useMemo<BadgeSpec[]>(() => {
    return days.slice(0, 24).map((d) => {
      const shape = pickShape(d.date, d.tier);
      const size = SIZE_BY_TIER[tierOfShape(shape)];
      return { iconUrl: badgeIconDataUrl(shape), size };
    });
  }, [days]);

  // ─── Effect A:引擎 / 瓶壁 / runner 只在挂载时 setup 一次 ───
  // 之前 deps=[badges],导致每次月份切换 / 数据 fetch 完成都把引擎销毁重建,
  // 加上每枚橘子 90ms 错开下落,看着像"重新加载",现改成只跑一次。
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
      // 清掉还没触发的下落 timer,避免之后对已 dispose 引擎 add body
      for (const t of dropTimersRef.current) clearTimeout(t);
      dropTimersRef.current = [];
      orangeBodiesRef.current = [];
      window.removeEventListener('deviceorientation', handleOrient);
      Matter.Render.stop(render);
      Matter.Runner.stop(runner);
      Matter.World.clear(engine.world, false);
      Matter.Engine.clear(engine);
      render.canvas.replaceWith(render.canvas.cloneNode(true) as HTMLCanvasElement);
      engineRef.current = null;
      renderRef.current = null;
      runnerRef.current = null;
    };
  }, []);

  // ─── Effect B:badges 变化时只增减橘子 body,不重建引擎 ───
  useEffect(() => {
    const engine = engineRef.current;
    const container = containerRef.current;
    if (!engine || !container) return;

    const W = container.clientWidth;
    const H = container.clientHeight;

    // 先清掉上一批橘子(切月或重渲染时)
    for (const t of dropTimersRef.current) clearTimeout(t);
    dropTimersRef.current = [];
    if (orangeBodiesRef.current.length > 0) {
      Matter.Composite.remove(engine.world, orangeBodiesRef.current);
      orangeBodiesRef.current = [];
    }

    // 投放范围:瓶口宽度 70-210(在 viewBox 280 中)
    const dropLeft = (W * 80) / 280;
    const dropRight = (W * 200) / 280;

    // 同会话内同样的瓶子状态见过 → 跳过掉落动画,直接放到瓶底
    // 状态变化(用户拿到新勋章 / 切月)→ 还是会播一次 cascade,celebrate 新进展
    const sig = `${monthLabel}|${days.map((d) => `${d.date}:${d.tier}`).join(',')}`;
    const skipAnim = shouldSkipDropAnimation(sig);
    const STAGGER_MS = skipAnim ? 0 : 25;

    badges.forEach((b, i) => {
      const placeBody = () => {
        if (!engineRef.current) return; // effect 已 cleanup
        const x = dropLeft + Math.random() * (dropRight - dropLeft);
        // 跳过动画时,把橘子直接散放到瓶子下半段(瓶底)而不是从瓶口落
        const y = skipAnim
          ? (H * 250) / 360 + Math.random() * (H * 80) / 360
          : (H * 90) / 360 + Math.random() * 10;
        const body = Matter.Bodies.circle(x, y, b.size / 2, {
          restitution: 0.4,
          friction: 0.05,
          density: 0.0009,
          render: {
            sprite: {
              texture: b.iconUrl,
              xScale: b.size / 64,
              yScale: b.size / 64
            }
          }
        });
        Matter.Composite.add(engine.world, body);
        orangeBodiesRef.current.push(body);
      };
      if (skipAnim) {
        placeBody(); // 同步立即放置,无 setTimeout
      } else {
        const timer = setTimeout(placeBody, i * STAGGER_MS);
        dropTimersRef.current.push(timer);
      }
    });

    // 标记本会话已见过这个状态;再进同月 + 同 tier 计数 → 跳过动画
    markJarSeen(sig);
  }, [badges, monthLabel, days]);

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
        <span className="text-xs text-ink/50">本月 {days.length} 枚</span>
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
