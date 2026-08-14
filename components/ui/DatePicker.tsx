"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Calendar, ChevronLeft, ChevronRight } from "lucide-react";
import { useLang } from "@/components/shared/Language";
import { MONTHS, WEEKDAYS_SHORT } from "@/lib/i18n";

// Qayta ishlatiladigan YAKKA sana tanlagich (DateRangePicker'ning oraliq
// emas, bitta kun tanlaydigan varianti — Moliya → Tushum rejasi skrinshotidagi
// kabi: oddiy oy kalendari, presetlarsiz). Boshqariladigan: value + onChange.

export interface DatePickerProps {
  value: Date | null;
  onChange: (date: Date) => void;
  className?: string;
}

// Oy/hafta kuni nomlari navbardagi til tanloviga qarab olinadi (lib/i18n.ts).
// Ilgari ular shu yerda inglizcha qattiq yozilgan edi.

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}
function sameDay(a: Date | null, b: Date | null): boolean {
  return !!a && !!b && a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}
function fmt(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${String(d.getFullYear()).slice(2)}`;
}

export default function DatePicker({ value, onChange, className = "" }: DatePickerProps) {
  const [lang] = useLang();
  const monthNames = MONTHS[lang];
  const weekdayNames = WEEKDAYS_SHORT[lang];
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<Date>(() => startOfDay(value ?? new Date()));
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const rootRef = useRef<HTMLDivElement>(null);

  const reposition = useCallback(() => {
    if (rootRef.current) {
      const r = rootRef.current.getBoundingClientRect();
      setPos({ top: r.bottom + 8, left: r.left });
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    window.addEventListener("scroll", reposition, true);
    window.addEventListener("resize", reposition);
    return () => {
      document.removeEventListener("mousedown", onDown);
      window.removeEventListener("scroll", reposition, true);
      window.removeEventListener("resize", reposition);
    };
  }, [open, reposition]);

  function toggleOpen() {
    const next = !open;
    setOpen(next);
    if (next) {
      reposition();
      setView(startOfDay(value ?? new Date()));
    }
  }

  const cells = useMemo(() => {
    const year = view.getFullYear();
    const month = view.getMonth();
    const lead = new Date(year, month, 1).getDay();
    const total = new Date(year, month + 1, 0).getDate();
    const arr: (Date | null)[] = [];
    for (let i = 0; i < lead; i++) arr.push(null);
    for (let d = 1; d <= total; d++) arr.push(new Date(year, month, d));
    return arr;
  }, [view]);

  function pickDay(day: Date) {
    onChange(day);
    setOpen(false);
  }

  return (
    <div className={`relative ${className}`} ref={rootRef}>
      <button type="button" onClick={toggleOpen} className="inline-flex items-center h-9 rounded-lg border border-border bg-card px-3 gap-2 text-[13px]">
        <Calendar className="w-4 h-4 text-primary" />
        <span className={value ? "text-foreground tabular-nums" : "text-muted-foreground"}>{value ? fmt(value) : "Sana"}</span>
      </button>

      {open && (
        <div style={{ position: "fixed", top: pos.top, left: pos.left, zIndex: 50 }} className="rounded-xl border border-border bg-card shadow-xl overflow-hidden p-3" >
          <div className="flex items-center justify-between mb-2" style={{ width: 254 }}>
            <button type="button" onClick={() => setView(new Date(view.getFullYear(), view.getMonth() - 1, 1))} className="h-7 w-7 rounded-md hover:bg-secondary inline-flex items-center justify-center text-muted-foreground">
              <ChevronLeft className="w-4 h-4" />
            </button>
            <div className="text-[14px] font-semibold text-primary">{monthNames[view.getMonth()]} {view.getFullYear()}</div>
            <button type="button" onClick={() => setView(new Date(view.getFullYear(), view.getMonth() + 1, 1))} className="h-7 w-7 rounded-md hover:bg-secondary inline-flex items-center justify-center text-muted-foreground">
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
          <div className="grid gap-1" style={{ gridTemplateColumns: "repeat(7, 1fr)" }}>
            {weekdayNames.map((w) => (
              <div key={w} className="h-8 flex items-center justify-center text-[11px] font-medium text-muted-foreground">{w}</div>
            ))}
            {cells.map((day, i) => {
              if (!day) return <div key={`e${i}`} />;
              const selected = sameDay(day, value);
              return (
                <button
                  key={day.toISOString()}
                  type="button"
                  onClick={() => pickDay(day)}
                  className={`h-9 w-9 mx-auto inline-flex items-center justify-center text-[13px] tabular-nums transition-colors rounded-full ${
                    selected ? "bg-primary text-white font-semibold" : "text-foreground hover:bg-secondary"
                  }`}
                >
                  {day.getDate()}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
