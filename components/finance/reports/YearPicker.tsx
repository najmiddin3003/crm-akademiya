"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Calendar, ChevronLeft, ChevronRight } from "lucide-react";

// Moliya → Moliya hisobotlari (P&L) yil tanlagichi — o'nlab yillik panjara
// (skrinshotdagi kabi), oldinga/orqaga o'nlab yilga o'tish bilan.
export default function YearPicker({ value, onChange }: { value: number; onChange: (year: number) => void }) {
  const [open, setOpen] = useState(false);
  const [decadeStart, setDecadeStart] = useState(() => Math.floor(value / 10) * 10);
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
      setDecadeStart(Math.floor(value / 10) * 10);
    }
  }

  const years = Array.from({ length: 10 }, (_, i) => decadeStart - 1 + i);

  return (
    <div className={"relative"} ref={rootRef}>
      <button type="button" onClick={toggleOpen} className="inline-flex items-center h-9 rounded-lg border border-border bg-card px-3 gap-2 text-[13px] w-28">
        <Calendar className="w-4 h-4 text-primary" />
        <span className="tabular-nums">{value}</span>
      </button>

      {open && (
        <div style={{ position: "fixed", top: pos.top, left: pos.left, zIndex: 50 }} className="rounded-xl border border-border bg-card shadow-xl overflow-hidden p-3" >
          <div className="flex items-center justify-between mb-2" style={{ width: 220 }}>
            <button type="button" onClick={() => setDecadeStart((d) => d - 10)} className="h-7 w-7 rounded-md hover:bg-secondary inline-flex items-center justify-center text-muted-foreground"><ChevronLeft className="w-4 h-4" /></button>
            <div className="text-[14px] font-semibold text-primary">{decadeStart}-{decadeStart + 9}</div>
            <button type="button" onClick={() => setDecadeStart((d) => d + 10)} className="h-7 w-7 rounded-md hover:bg-secondary inline-flex items-center justify-center text-muted-foreground"><ChevronRight className="w-4 h-4" /></button>
          </div>
          <div className="grid grid-cols-3 gap-1" style={{ width: 220 }}>
            {years.map((y) => {
              const dim = y < decadeStart || y > decadeStart + 9;
              const selected = y === value;
              return (
                <button
                  key={y}
                  type="button"
                  onClick={() => { onChange(y); setOpen(false); }}
                  className={`h-10 rounded-md text-[13px] tabular-nums font-medium ${selected ? "bg-primary text-white" : dim ? "text-muted-foreground/50 hover:bg-secondary" : "hover:bg-secondary"}`}
                >
                  {y}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
