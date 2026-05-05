/**
 * 炎症指数趋势折线 — Grow App 风格小图
 *
 * 输入:过去 N 天的 [{date, total}],null 视为缺失(不连线,断点)
 * 视觉:浅灰背景刻度线(25/50/75 阈),分数走渐变 stroke;今日 dot 高亮
 */

import { useMemo } from 'react';
import type { YanScoreHistoryEntry } from '../services/yanScoreHistory';

interface Props {
  entries: YanScoreHistoryEntry[];
  /** 高度,默认 140 */
  height?: number;
  /** 点击点 → 回调当日 date(YYYY-MM-DD);未传则不可点 */
  onSelectDate?: (date: string) => void;
  /** 高亮选中日期 */
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
      const y = e.total === null ? null : pad.top + drawH - (Math.max(0, Math.min(100, e.total)) / 100) * drawH;
      return { x, y, total: e.total, date: e.date, level: e.level };
    });
  }, [entries, height]);

  if (entries.length === 0) {
    return (
      <div className="text-center text-sm text-ink/45 py-10" data-testid="trend-empty">
        还没有足够的历史数据。
      </div>
    );
  }

  const w = 600;
  const h = height;
  const pad = { top: 8, right: 12, bottom: 18, left: 22 };
  const drawW = w - pad.left - pad.right;

  // 把连续非 null 段拼成 path
  const pathD: string[] = [];
  let inSegment = false;
  for (const p of points) {
    if (p.y === null) {
      inSegment = false;
      continue;
    }
    pathD.push(inSegment ? `L ${p.x.toFixed(1)} ${p.y.toFixed(1)}` : `M ${p.x.toFixed(1)} ${p.y.toFixed(1)}`);
    inSegment = true;
  }

  // 阈值线 25 / 50 / 75
  const yFor = (v: number) => pad.top + (h - pad.top - pad.bottom) - (v / 100) * (h - pad.top - pad.bottom);
  const thresholds = [
    { v: 25, label: '25', color: '#4A8B6F' },
    { v: 50, label: '50', color: '#C9A227' },
    { v: 75, label: '75', color: '#D9762C' }
  ];

  // 横轴 tick:首/中/末
  const tickIdx = entries.length === 1 ? [0] : entries.length <= 7 ? entries.map((_, i) => i) : [0, Math.floor(entries.length / 2), entries.length - 1];

  const lastValid = [...points].reverse().find((p) => p.y !== null);

  return (
    <div data-testid="inflammation-trend-chart">
      <svg viewBox={`0 0 ${w} ${h}`} className="w-full">
        <defs>
          <linearGradient id="trend-grad" x1="0%" y1="100%" x2="0%" y2="0%">
            <stop offset="0%" stopColor="#4A8B6F" />
            <stop offset="40%" stopColor="#C9A227" />
            <stop offset="70%" stopColor="#D9762C" />
            <stop offset="100%" stopColor="#B43A30" />
          </linearGradient>
        </defs>
        {thresholds.map((t) => (
          <g key={t.v}>
            <line
              x1={pad.left}
              x2={pad.left + drawW}
              y1={yFor(t.v)}
              y2={yFor(t.v)}
              stroke="#0001"
              strokeDasharray="3 4"
            />
            <text x={pad.left - 6} y={yFor(t.v) + 3} fontSize="9" textAnchor="end" fill="#0006">
              {t.label}
            </text>
          </g>
        ))}
        {pathD.length > 0 && (
          <path d={pathD.join(' ')} fill="none" stroke="url(#trend-grad)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        )}
        {points.map((p, i) => {
          if (p.y === null) return null;
          const isLast = i === points.length - 1;
          const isSelected = selectedDate === p.date;
          const r = isSelected ? 5 : isLast ? 4 : 2.2;
          return (
            <g key={i}>
              {/* 隐形大点击区域,扩大命中 */}
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
                fill={isSelected ? '#222' : '#fff'}
                stroke="#222"
                strokeWidth={isSelected ? 2 : isLast ? 1.4 : 0.6}
                pointerEvents="none"
              />
            </g>
          );
        })}
        {lastValid && (
          <text x={lastValid.x} y={lastValid.y! - 8} fontSize="11" textAnchor="middle" fill="#222" fontWeight="600">
            {lastValid.total}
          </text>
        )}
        {tickIdx.map((i) => {
          const p = points[i];
          const md = entries[i].date.slice(5); // MM-DD
          return (
            <text key={i} x={p.x} y={h - 4} fontSize="9" textAnchor="middle" fill="#0007">
              {md}
            </text>
          );
        })}
      </svg>
    </div>
  );
}
