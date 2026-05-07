/**
 * 抗炎指数趋势折线
 *
 * Y 轴语义反转:高 = 健康(顶部 ★5),低 = 提醒(底部 ★2)
 * 内部仍以后端 fireScore (0-100) 计算 y(0=顶,100=底),
 * 节点标注与 tooltip 走 score-display 模块。
 */

import { useMemo } from 'react';
import type { YanScoreHistoryEntry } from '../services/yanScoreHistory';
import { scoreToStars } from '../services/score-display';
import { palette } from '../theme/palette';

interface Props {
  entries: YanScoreHistoryEntry[];
  height?: number;
  onSelectDate?: (date: string) => void;
  selectedDate?: string | null;
}

export function InflammationTrendChart({ entries, height = 140, onSelectDate, selectedDate }: Props) {
  const points = useMemo(() => {
    if (entries.length === 0) return [];
    const w = 600;
    const h = height;
    const pad = { top: 8, right: 12, bottom: 18, left: 22 };
    const drawW = w - pad.left - pad.right;
    const drawH = h - pad.top - pad.bottom;
    const stepX = entries.length > 1 ? drawW / (entries.length - 1) : 0;
    return entries.map((e, i) => {
      const x = pad.left + i * stepX;
      // 反转:fireScore 越小 = 抗炎指数越高 = y 越靠顶
      const y =
        e.total === null
          ? null
          : pad.top + (Math.max(0, Math.min(100, e.total)) / 100) * drawH;
      return { x, y, total: e.total, date: e.date, level: e.level };
    });
  }, [entries, height]);

  const w = 600;
  const h = height;
  const pad = { top: 8, right: 12, bottom: 18, left: 22 };
  const drawW = w - pad.left - pad.right;
  const drawH = h - pad.top - pad.bottom;

  // 数据不足 2 个有效点 → 渲染一条占位直线 + 提示;不再返回"还没有足够数据"文字块
  const validCount = entries.filter((e) => e.total !== null).length;
  if (validCount < 2) {
    const midY = pad.top + drawH / 2;
    return (
      <div data-testid="inflammation-trend-chart">
        <svg viewBox={`0 0 ${w} ${h}`} className="w-full">
          <line
            x1={pad.left}
            y1={midY}
            x2={pad.left + drawW}
            y2={midY}
            stroke={palette.inkGrid}
            strokeWidth="2"
            strokeLinecap="round"
          />
        </svg>
        <p className="mt-1 text-[10px] text-ink/30 text-center">
          还需多打卡几天才能看到趋势
        </p>
      </div>
    );
  }

  const pathD: string[] = [];
  let inSegment = false;
  for (const p of points) {
    if (p.y === null) {
      inSegment = false;
      continue;
    }
    pathD.push(
      inSegment ? `L ${p.x.toFixed(1)} ${p.y.toFixed(1)}` : `M ${p.x.toFixed(1)} ${p.y.toFixed(1)}`
    );
    inSegment = true;
  }

  // 阈值线:fireScore 25 / 50 / 75 ⇄ 抗炎指数 ★4 / ★3 / ★2 边界
  const yFor = (v: number) => pad.top + (v / 100) * drawH;
  const thresholds = [
    { v: 25, label: '★4', color: '#7BA56A' },
    { v: 50, label: '★3', color: '#C9A227' },
    { v: 75, label: '★2', color: '#D9762C' }
  ];

  const tickIdx =
    entries.length === 1
      ? [0]
      : entries.length <= 7
      ? entries.map((_, i) => i)
      : [0, Math.floor(entries.length / 2), entries.length - 1];

  const lastValid = [...points].reverse().find((p) => p.y !== null);

  return (
    <div data-testid="inflammation-trend-chart">
      <svg viewBox={`0 0 ${w} ${h}`} className="w-full">
        <defs>
          {/* 0% 在 y1=100%(底),100% 在 y2=0%(顶):底=橙/红,顶=绿 */}
          <linearGradient id="trend-grad" x1="0%" y1="100%" x2="0%" y2="0%">
            <stop offset="0%" stopColor={palette.fireMid} />
            <stop offset="35%" stopColor={palette.fireMild} />
            <stop offset="70%" stopColor={palette.firePingLight} />
            <stop offset="100%" stopColor={palette.firePing} />
          </linearGradient>
        </defs>
        {thresholds.map((t) => (
          <g key={t.v}>
            <line
              x1={pad.left}
              x2={pad.left + drawW}
              y1={yFor(t.v)}
              y2={yFor(t.v)}
              stroke={palette.inkGrid}
              strokeDasharray="3 4"
            />
            <text x={pad.left - 4} y={yFor(t.v) + 3} fontSize="9" textAnchor="end" fill={palette.inkAxis}>
              {t.label}
            </text>
          </g>
        ))}
        {pathD.length > 0 && (
          <path
            d={pathD.join(' ')}
            fill="none"
            stroke="url(#trend-grad)"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        )}
        {points.map((p, i) => {
          if (p.y === null) return null;
          const isLast = i === points.length - 1;
          const isSelected = selectedDate === p.date;
          const r = isSelected ? 5 : isLast ? 4 : 2.2;
          return (
            <g key={i}>
              {onSelectDate && (
                <circle
                  cx={p.x}
                  cy={p.y}
                  r={12}
                  fill="transparent"
                  style={{ cursor: 'pointer' }}
                  onClick={() => onSelectDate(p.date)}
                  data-testid={`trend-point-${p.date}`}
                />
              )}
              <circle
                cx={p.x}
                cy={p.y}
                r={r}
                fill={isSelected ? palette.inkSolid : '#fff'}
                stroke={palette.inkSolid}
                strokeWidth={isSelected ? 2 : isLast ? 1.4 : 0.6}
                pointerEvents="none"
              />
            </g>
          );
        })}
        {lastValid && lastValid.total !== null && (
          <text
            x={lastValid.x}
            y={lastValid.y! - 8}
            fontSize="11"
            textAnchor="middle"
            fill={palette.inkSolid}
            fontWeight="600"
          >
            ★{scoreToStars(lastValid.total)}
          </text>
        )}
        {tickIdx.map((i) => {
          const p = points[i];
          const md = entries[i].date.slice(5);
          return (
            <text key={i} x={p.x} y={h - 4} fontSize="9" textAnchor="middle" fill={palette.inkTick}>
              {md}
            </text>
          );
        })}
      </svg>
      <p className="mt-1 text-[10px] text-ink/30 text-right pr-2">↑ 越高越清气</p>
    </div>
  );
}
