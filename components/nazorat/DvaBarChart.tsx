"use client";

import { DVA_COLORS, DVA_LABELS } from "@/constants/davomatAnalytics";
import type { DvaDay } from "@/lib/davomatAnalytics";

// Ported from crm-akademiya/src/app.js renderDvaChart() (~line 28479) —
// kunlik stacked-bar (SVG, kutubxonasiz). niceMax har doim 500ga
// yaxlitlanadi (manbadagidek), lekin haqiqiy maksimal shundan oshib ketsa
// (500 dan katta bo'lsa) 100ga yaxlitlab kattalashtiriladi.
export default function DvaBarChart({ days }: { days: DvaDay[] }) {
  if (days.length === 0) {
    return <div className="py-16 text-center text-sm text-muted-foreground">Ma&apos;lumot topilmadi</div>;
  }

  const N = days.length;
  const W = Math.max(900, N * 56);
  const H = 460;
  const pad = { l: 50, r: 16, t: 16, b: 70 };
  const innerW = W - pad.l - pad.r;
  const innerH = H - pad.t - pad.b;

  const maxTotal = Math.max(...days.map((d) => d.vals.reduce((s, v) => s + v, 0)));
  const niceMax = Math.max(500, Math.ceil(maxTotal / 100) * 100);

  const xStep = innerW / N;
  const barW = Math.min(30, xStep * 0.6);
  const gridStep = niceMax <= 600 ? 50 : 100;

  const gridLines: number[] = [];
  for (let v = 0; v <= niceMax; v += gridStep) gridLines.push(v);

  return (
    <div className="w-full overflow-x-auto">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ minWidth: W, height: H }}>
        {gridLines.map((v) => {
          const y = pad.t + innerH - (v / niceMax) * innerH;
          return (
            <g key={v}>
              <line x1={pad.l} y1={y} x2={pad.l + innerW} y2={y} stroke="currentColor" strokeOpacity={0.06} />
              <text x={pad.l - 8} y={y + 3} textAnchor="end" fill="currentColor" style={{ fontSize: 10, opacity: 0.55 }}>{v}</text>
            </g>
          );
        })}

        {days.map((d, i) => {
          const cx = pad.l + i * xStep + xStep / 2;
          const x = cx - barW / 2;
          let cursorY = pad.t + innerH;
          const lastNonZero = d.vals.reduce((acc, v, k) => (v !== 0 ? k : acc), -1);
          return (
            <g key={d.label}>
              {d.vals.map((v, k) => {
                if (v === 0) return null;
                const segH = (v / niceMax) * innerH;
                cursorY -= segH;
                return (
                  <rect
                    key={k}
                    x={x}
                    y={cursorY}
                    width={barW}
                    height={segH}
                    fill={DVA_COLORS[k]}
                    rx={k === lastNonZero ? 3 : 0}
                    ry={k === lastNonZero ? 3 : 0}
                  >
                    <title>{`${d.label} — ${DVA_LABELS[k]}: ${v}`}</title>
                  </rect>
                );
              })}
            </g>
          );
        })}

        {days.map((d, i) => {
          const cx = pad.l + i * xStep + xStep / 2;
          const y = H - pad.b + 16;
          return (
            <text
              key={d.label}
              x={cx}
              y={y}
              textAnchor="end"
              fill="currentColor"
              style={{ fontSize: 10, opacity: 0.6 }}
              transform={`rotate(-40, ${cx}, ${y})`}
            >
              {d.label}
            </text>
          );
        })}
      </svg>
    </div>
  );
}
