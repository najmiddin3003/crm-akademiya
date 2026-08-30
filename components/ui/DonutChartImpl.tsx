"use client";

import { Cell, Pie, PieChart, Tooltip } from "recharts";
import type { PieLabelRenderProps } from "recharts";

// Qayta ishlatiladigan donut diagramma — recharts (haqiqiy kutubxona) asosida.
// Ilgari qo'lda SVG <circle> stroke-dasharray bilan chizilgan edi; endi Pie
// (innerRadius bilan donut) + Cell (segment ranglari) ishlatiladi, shu bilan
// bepul hover tooltip ham qo'shildi. Tashqi interfeys (slices/centerLabel/
// size/showLabels) o'zgarmagan — barcha chaqiruvchi joylar tegilmasdan ishlaydi.
export interface DonutSlice {
  label: string;
  value: number;
  color: string;
}

export default function DonutChart({
  slices,
  centerLabel,
  size = 220,
  showLabels = true,
  valueFormatter = (v: number) => v.toLocaleString("ru-RU"),
}: {
  slices: DonutSlice[];
  centerLabel: string;
  size?: number;
  showLabels?: boolean;
  valueFormatter?: (value: number) => string;
}) {
  const STROKE = Math.round(size * (34 / 220));
  const outerRadius = size / 2;
  const innerRadius = Math.max(outerRadius - STROKE, 0);
  const total = slices.reduce((s, x) => s + x.value, 0);
  const data = slices.filter((s) => s.value > 0);

  // Foiz yorlig'i — faqat >=8% ulushga ega segmentlarga (kichiklari
  // ustma-ust tushib chalkashmasligi uchun, aniq qiymatlar jadvalda bor).
  function renderLabel(props: PieLabelRenderProps) {
    const percent = typeof props.percent === "number" ? props.percent : 0;
    if (percent < 0.08) return null;
    const x = Number(props.x);
    const y = Number(props.y);
    return (
      <text x={x} y={y} textAnchor="middle" dominantBaseline="central" className="fill-white text-[11px] font-semibold pointer-events-none">
        {(percent * 100).toFixed(percent * 100 < 10 ? 1 : 0)}%
      </text>
    );
  }

  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <PieChart width={size} height={size}>
        {total > 0 ? (
          <Pie
            data={data}
            dataKey="value"
            nameKey="label"
            cx="50%"
            cy="50%"
            innerRadius={innerRadius}
            outerRadius={outerRadius}
            paddingAngle={data.length > 1 ? 2 : 0}
            startAngle={90}
            endAngle={-270}
            stroke="none"
            isAnimationActive={false}
            label={showLabels ? renderLabel : false}
            labelLine={false}
          >
            {data.map((s) => (
              <Cell key={s.label} fill={s.color} />
            ))}
          </Pie>
        ) : (
          <Pie
            data={[{ label: "", value: 1 }]}
            dataKey="value"
            cx="50%"
            cy="50%"
            innerRadius={innerRadius}
            outerRadius={outerRadius}
            stroke="none"
            isAnimationActive={false}
          >
            <Cell fill="hsl(var(--secondary))" opacity={0.4} />
          </Pie>
        )}
        {total > 0 && (
          <Tooltip
            formatter={(value, name) => [valueFormatter(Number(value)), String(name)]}
            contentStyle={{ borderRadius: 8, border: "1px solid hsl(var(--border))", background: "hsl(var(--card))", fontSize: 12 }}
          />
        )}
      </PieChart>
      {centerLabel && (
        <div className="absolute inset-0 flex items-center justify-center text-center pointer-events-none" style={{ padding: size < 100 ? 2 : 24 }}>
          <span className="font-semibold tabular-nums" style={{ fontSize: size < 100 ? 9 : 18 }}>{centerLabel}</span>
        </div>
      )}
    </div>
  );
}
