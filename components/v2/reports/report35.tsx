"use client";

import { useState, type ReactNode } from "react";
import type { DateRange } from "@/components/ui/DateRangePicker";
import V2DateRange from "@/components/v2/ui/V2DateRange";
import { isoOf } from "./reportFormat";

// HISOBOTLAR (35-qism) — yangi yetti hisobot uchun umumiy bo'laklar: kunlar oralig'i (sukut — oy boshidan
// bugungacha), qatordagi chiziq (ulush), segmentli chiziq, ichki karta.

export function useDayRange(): { range: DateRange; setRange: (r: DateRange) => void; from: string; to: string } {
  const [range, setRange] = useState<DateRange>(() => {
    const n = new Date();
    return { start: new Date(n.getFullYear(), n.getMonth(), 1), end: n };
  });
  const s = range.start ?? new Date();
  return { range, setRange, from: isoOf(s), to: isoOf(range.end ?? s) };
}

export function DayRangeFilter({ range, setRange }: { range: DateRange; setRange: (r: DateRange) => void }) {
  return <V2DateRange value={range} onChange={setRange} allowAll={false} align="start" />;
}

export function Meter({ pct, tone = "bg-v2-brand", w = "w-full" }: { pct: number; tone?: string; w?: string }) {
  return (
    <span className={`block h-1.5 overflow-hidden rounded-full bg-v2-surface-2 ${w}`}>
      <span className={`block h-full rounded-full ${tone}`} style={{ width: `${Math.max(0, Math.min(100, pct))}%` }} />
    </span>
  );
}

export function StackBar({ parts, h = "h-2" }: { parts: { v: number; c: string }[]; h?: string }) {
  const total = parts.reduce((a, p) => a + p.v, 0) || 1;
  return (
    <span className={`flex overflow-hidden rounded-full bg-v2-surface-2 ${h}`}>
      {parts.map((p, i) => (p.v > 0 ? <span key={i} className={p.c} style={{ width: `${(p.v / total) * 100}%` }} /> : null))}
    </span>
  );
}

export function Panel({ title, sub, right, children, className = "" }: { title: ReactNode; sub?: ReactNode; right?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`overflow-hidden rounded-v2-lg border border-v2-border bg-v2-surface shadow-v2-sm ${className}`}>
      <div className="flex flex-wrap items-start justify-between gap-2 px-4 pt-3.5 pb-2.5">
        <div className="min-w-0">
          <h2 className="text-v2-body font-semibold text-v2-text">{title}</h2>
          {sub && <p className="text-v2-small text-v2-text-2">{sub}</p>}
        </div>
        {right}
      </div>
      {children}
    </section>
  );
}

export function Callout({ tone = "info", icon, title, children, action }: { tone?: "info" | "warning"; icon: ReactNode; title: ReactNode; children: ReactNode; action?: ReactNode }) {
  const cls = tone === "warning" ? "border-v2-warning/40 bg-v2-warning-bg" : "border-v2-info/30 bg-v2-info-bg";
  return (
    <section className={`flex flex-wrap items-center gap-3 rounded-v2-lg border px-4 py-3 ${cls}`}>
      <span className={tone === "warning" ? "text-v2-warning" : "text-v2-info"}>{icon}</span>
      <div className="min-w-0 flex-1">
        <div className="font-semibold text-v2-text">{title}</div>
        <div className="text-v2-small text-v2-text-2">{children}</div>
      </div>
      {action}
    </section>
  );
}

export const pct = (a: number, b: number) => (b > 0 ? Math.round((a / b) * 100) : 0);
