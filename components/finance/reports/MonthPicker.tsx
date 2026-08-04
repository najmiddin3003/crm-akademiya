"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Calendar, ChevronLeft, ChevronRight, X } from "lucide-react";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

// Moliya → Moliya hisobotlari (P&L) "Oyni tanlang" — bitta oyni tanlab
// jadvalni shu oyga toraytiradi (tanlanmasa — barcha 12 oy + Jami ustuni).
export default function MonthPicker({
  year,
  value,
  onChange,
}: {
  year: number;
  value: number | null;
  onChange: (month: number | null, year: number) => void;
}) {
  const [open, setOpen] = useState(false);
  const [viewYear, setViewYear] = useState(year);
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
    if (next) { reposition(); setViewYear(year); }
  }

  return (
    <div className="relative" ref={rootRef}>
      <button type="button" onClick={toggleOpen} className="inline-flex items-center h-9 rounded-lg border border-border bg-card px-3 gap-2 text-[13px] w-40">
        <Calendar className="w-4 h-4 text-primary" />
        <span className={value ? "text-foreground" : "text-muted-foreground"}>{value ? `${MONTHS[value - 1]} ${viewYear}` : "Oyni tanlang"}</span>
        {value && (
          <button type="button" onClick={(e) => { e.stopPropagation(); onChange(null, year); }} className="ml-auto text-muted-foreground hover:text-foreground">
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </button>

      {open && (
        <div style={{ position: "fixed", top: pos.top, left: pos.left, zIndex: 50 }} className="rounded-xl border border-border bg-card shadow-xl overflow-hidden p-3">
          <div className="flex items-center justify-between mb-2" style={{ width: 220 }}>
            <button type="button" onClick={() => setViewYear((y) => y - 1)} className="h-7 w-7 rounded-md hover:bg-secondary inline-flex items-center justify-center text-muted-foreground"><ChevronLeft className="w-4 h-4" /></button>
            <div className="text-[14px] font-semibold text-primary">{viewYear}</div>
            <button type="button" onClick={() => setViewYear((y) => y + 1)} className="h-7 w-7 rounded-md hover:bg-secondary inline-flex items-center justify-center text-muted-foreground"><ChevronRight className="w-4 h-4" /></button>
          </div>
          <div className="grid grid-cols-3 gap-1" style={{ width: 220 }}>
            {MONTHS.map((m, i) => {
              const selected = value === i + 1 && viewYear === year;
              return (
                <button
                  key={m}
                  type="button"
                  onClick={() => { onChange(i + 1, viewYear); setOpen(false); }}
                  className={`h-10 rounded-md text-[13px] font-medium ${selected ? "bg-primary text-white" : "hover:bg-secondary"}`}
                >
                  {m}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
