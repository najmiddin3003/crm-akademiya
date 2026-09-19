"use client";

import { useState } from "react";
import { useT } from "@/components/shared/Language";

export interface DailyPoint {
  date: string; // "YYYY-MM-DD"
  label: string; // "DD.MM"
  income: number;
  expense: number;
}

const W = 900;
const H = 260;
const PAD = 30;

function fmtUZS(n: number): string {
  return Math.round(n).toLocaleString("ru-RU") + " UZS";
}

// Kirim/Chiqim kunlik qiymatlarini chizadi — kutubxonasiz, oddiy SVG.
// `variant="area"` (default) to'ldirilgan egri chiziq, `variant="bar"` esa
// har kun uchun yonma-yon ikkita ustun (referens saytdagi almashtirgich).
export default function DailyAreaChart({
  points,
  variant = "area",
}: {
  points: DailyPoint[];
  variant?: "area" | "bar";
}) {
  const { t } = useT();
  const [hover, setHover] = useState<number | null>(null);
  if (points.length === 0) {
    return <div className="py-16 text-center text-sm text-muted-foreground">{t("Ma'lumot topilmadi")}</div>;
  }

  const maxVal = Math.max(1, ...points.map((p) => Math.max(p.income, p.expense)));
  const stepX = points.length > 1 ? (W - PAD * 2) / (points.length - 1) : 0;

  function xAt(i: number) {
    return PAD + i * stepX;
  }
  function yAt(v: number) {
    return H - PAD - (v / maxVal) * (H - PAD * 2);
  }

  function areaPath(values: number[]) {
    const top = values.map((v, i) => `${i === 0 ? "M" : "L"} ${xAt(i)} ${yAt(v)}`).join(" ");
    return `${top} L ${xAt(values.length - 1)} ${H - PAD} L ${xAt(0)} ${H - PAD} Z`;
  }

  const incomeValues = points.map((p) => p.income);
  const expenseValues = points.map((p) => p.expense);
  const barW = Math.max(2, Math.min(stepX * 0.35, 18));

  return (
    <div className="relative">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: H }}>
        <line x1={PAD} y1={H - PAD} x2={W - PAD} y2={H - PAD} stroke="var(--border)" strokeWidth={1} />
        {variant === "area" ? (
          <>
            <path d={areaPath(expenseValues)} fill="#f87171" fillOpacity={0.35} stroke="#f87171" strokeWidth={1.5} />
            <path d={areaPath(incomeValues)} fill="#22c55e" fillOpacity={0.35} stroke="#22c55e" strokeWidth={1.5} />
          </>
        ) : (
          points.map((p, i) => (
            <g key={`bar-${p.date}`}>
              <rect x={xAt(i) - barW - 1} y={yAt(p.income)} width={barW} height={H - PAD - yAt(p.income)} fill="#22c55e" rx={2} />
              <rect x={xAt(i) + 1} y={yAt(p.expense)} width={barW} height={H - PAD - yAt(p.expense)} fill="#f87171" rx={2} />
            </g>
          ))
        )}
        {points.map((p, i) => (
          <rect
            key={p.date}
            x={xAt(i) - stepX / 2}
            y={0}
            width={Math.max(stepX, 1)}
            height={H}
            fill="transparent"
            onMouseEnter={() => setHover(i)}
            onMouseLeave={() => setHover((h) => (h === i ? null : h))}
          />
        ))}
        {hover != null && <line x1={xAt(hover)} y1={0} x2={xAt(hover)} y2={H - PAD} stroke="var(--muted-foreground)" strokeWidth={1} strokeDasharray="3 3" />}
      </svg>
      {hover != null && (
        <div
          className="absolute z-10 rounded-md bg-neutral-900 text-white text-[11px] px-2.5 py-1.5 shadow-lg pointer-events-none"
          style={{ left: `${(xAt(hover) / W) * 100}%`, top: 4, transform: "translateX(-50%)" }}
        >
          <div className="font-semibold">{points[hover].label}</div>
          <div className="text-emerald-400">+{fmtUZS(points[hover].income)}</div>
          <div className="text-rose-400">-{fmtUZS(points[hover].expense)}</div>
        </div>
      )}
      <div className="flex justify-between text-[10px] text-muted-foreground mt-1 px-1">
        <span>{points[0].label}</span>
        {points.length > 2 && <span>{points[Math.floor(points.length / 2)].label}</span>}
        <span>{points[points.length - 1].label}</span>
      </div>
    </div>
  );
}
