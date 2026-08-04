"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Calendar, ChevronLeft, ChevronRight, X } from "lucide-react";

// Faqat oy tanlash uchun qayta ishlatiladigan tanlagich (Mavsumiy baholash
// skrinshotidagi kabi: yil navigatsiyasi + 12 oylik 3x4 katakcha). Qiymat —
// oy raqami (1-12), yil faqat panelni ko'rib chiqish uchun (tanlangan
// qiymatga kirmaydi — manba ilovada ham shunday: URL faqat ?month= saqlaydi).

const MONTH_LABELS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export interface MonthPickerProps {
  value: number | null;
  onChange: (month: number) => void;
  onClear?: () => void;
  placeholder?: string;
  className?: string;
}

export default function MonthPicker({ value, onChange, onClear, placeholder = "Oy", className = "" }: MonthPickerProps) {
  const [open, setOpen] = useState(false);
  const [viewYear, setViewYear] = useState(() => new Date().getFullYear());
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
    if (next) reposition();
  }

  function pickMonth(m: number) {
    onChange(m);
    setOpen(false);
  }

  return (
    <div className={`relative ${className}`} ref={rootRef}>
      <div className="inline-flex items-center h-9 w-full rounded-lg border border-border bg-card px-3 gap-2 text-[13px]">
        <button type="button" onClick={toggleOpen} className="flex-1 text-left">
          <span className={value ? "text-foreground tabular-nums" : "text-muted-foreground"}>
            {value ? String(value).padStart(2, "0") : placeholder}
          </span>
        </button>
        {value && onClear && (
          <button type="button" onClick={onClear} className="text-muted-foreground hover:text-foreground" title="Tozalash">
            <X className="w-3.5 h-3.5" />
          </button>
        )}
        <button type="button" onClick={toggleOpen} className="text-muted-foreground">
          <Calendar className="w-4 h-4" />
        </button>
      </div>

      {open && (
        <div style={{ position: "fixed", top: pos.top, left: pos.left, zIndex: 50 }} className="w-72 rounded-xl border border-border bg-card shadow-xl p-4">
          <div className="flex items-center justify-between mb-4">
            <button type="button" onClick={() => setViewYear((y) => y - 1)} className="h-7 w-7 rounded-md hover:bg-secondary inline-flex items-center justify-center text-muted-foreground">
              <ChevronLeft className="w-4 h-4" />
            </button>
            <div className="text-[14px] font-semibold">{viewYear}</div>
            <button type="button" onClick={() => setViewYear((y) => y + 1)} className="h-7 w-7 rounded-md hover:bg-secondary inline-flex items-center justify-center text-muted-foreground">
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
          <div className="grid grid-cols-3 gap-x-4 gap-y-3">
            {MONTH_LABELS.map((label, i) => {
              const m = i + 1;
              const active = value === m;
              return (
                <button
                  key={label}
                  type="button"
                  onClick={() => pickMonth(m)}
                  className={`h-9 rounded-lg text-[13px] font-medium transition-colors ${active ? "bg-primary text-white" : "hover:bg-secondary text-foreground"}`}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
