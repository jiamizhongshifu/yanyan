/**
 * 重力勋章瓶 — matter.js 物理引擎 + DeviceOrientation
 *
 * 与原 AchievementJar 接口兼容(perfect/great/nice + sugarBadges),
 * 行为差异:
 *   - 勋章不再 absolute 定位,变成 matter 动态体落进瓶子
 *   - DeviceOrientation 改 gravity.x,手机倾斜勋章会滑动
 *   - 默认无勋章时瓶子是空的(背景图自带玻璃感)
 *   - iOS 13+ 第一次进入时弹按钮请求权限
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import Matter from 'matter-js';
import { asset } from '../services/assets';

const TIER_TO_ICON: Record<'perfect' | 'great' | 'nice', string> = {
  perfect: 'tier-perfect.png',
  great: 'tier-great.png',
  nice: 'tier-nice.png'
};

interface SugarBadgeInput {
  emoji: string;
  label: string;
  count: number;
  iconFile: string;
}

interface Props {
  monthLabel: string;
  perfect: number;
  great: number;
  nice: number;
  sugarBadges: SugarBadgeInput[];
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
  nice,
  sugarBadges
}: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const engineRef = useRef<Matter.Engine | null>(null);
  const renderRef = useRef<Matter.Render | null>(null);
  const runnerRef = useRef<Matter.Runner | null>(null);
  const [needsPerm, setNeedsPerm] = useState(false);

  // 全部要进瓶子的勋章 specs(图片 url + 大小)
  const badges = useMemo<BadgeSpec[]>(() => {
    const list: BadgeSpec[] = [];
    for (let i = 0; i < perfect; i++) list.push({ iconUrl: asset(TIER_TO_ICON.perfect), size: 36 });
    for (let i = 0; i < great; i++) list.push({ iconUrl: asset(TIER_TO_ICON.great), size: 32 });
    for (let i = 0; i < nice; i++) list.push({ iconUrl: asset(TIER_TO_ICON.nice), size: 28 });
    for (const sb of sugarBadges) {
      for (let i = 0; i < sb.count; i++) {
        list.push({ iconUrl: asset(sb.iconFile), size: 30 });
      }
    }
    // 限 24 防止 N=200 灾难
    return list.slice(0, 24);
  }, [perfect, great, nice, sugarBadges]);

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

    // 瓶身静态壁:左右 + 底 + 瓶口窄缩
    const wallOpts: Matter.IChamferableBodyDefinition = {
      isStatic: true,
      render: { visible: false }
    };
    const wallT = 18;
    const neckW = W * 0.45; // 瓶口宽
    const bodyW = W * 0.85; // 瓶身宽
    const bottomY = H - wallT;
    const neckTopY = H * 0.18; // 瓶颈起始
    const shoulderY = H * 0.32; // 瓶肩

    const left = Matter.Bodies.rectangle((W - bodyW) / 2 - wallT / 2, H / 2, wallT, H, wallOpts);
    const right = Matter.Bodies.rectangle(W - (W - bodyW) / 2 + wallT / 2, H / 2, wallT, H, wallOpts);
    const bottom = Matter.Bodies.rectangle(W / 2, bottomY + wallT / 2, W, wallT, wallOpts);
    // 肩缩(让瓶口看着窄一点)
    const shoulderL = Matter.Bodies.rectangle((W - neckW) / 2 - wallT / 2, shoulderY, wallT, neckTopY * 0.8, wallOpts);
    const shoulderR = Matter.Bodies.rectangle(W - (W - neckW) / 2 + wallT / 2, shoulderY, wallT, neckTopY * 0.8, wallOpts);

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
    badges.forEach((b, i) => {
      setTimeout(() => {
        const x = (W - neckW) / 2 + Math.random() * neckW;
        const y = -b.size;
        const body = Matter.Bodies.circle(x, y, b.size / 2, {
          restitution: 0.4,
          friction: 0.05,
          density: 0.0009,
          render: {
            sprite: {
              texture: b.iconUrl,
              xScale: b.size / 256,
              yScale: b.size / 256
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
        {/* 瓶身背景图 */}
        <img
          src={asset('achievement-jar.png')}
          alt="勋章瓶"
          className="absolute inset-0 w-full h-full object-contain pointer-events-none"
          loading="lazy"
        />
        {/* 物理 canvas */}
        <canvas
          ref={canvasRef}
          width={280}
          height={360}
          className="absolute inset-0 w-full h-full"
        />
        {needsPerm && (
          <button
            type="button"
            onClick={askPermission}
            className="absolute bottom-2 left-1/2 -translate-x-1/2 px-3 py-1.5 rounded-full bg-ink text-paper text-xs"
            data-testid="orient-perm-btn"
          >
            轻摇手机让勋章动起来 →
          </button>
        )}
      </div>

      {sugarBadges.length > 0 && (
        <div className="mt-4 rounded-2xl bg-paper px-5 py-4">
          <p className="text-xs text-ink/50 mb-2">控糖勋章</p>
          <div className="grid grid-cols-2 gap-3">
            {sugarBadges.map((b, i) => (
              <div key={i} className="flex items-center gap-2.5">
                <img src={asset(b.iconFile)} alt={b.label} className="w-9 h-9 object-contain" />
                <div className="text-sm">
                  <span className="text-ink">{b.label}</span>
                  <span className="ml-1 text-ink/45">×{b.count}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
