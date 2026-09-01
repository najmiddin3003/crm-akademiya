"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Calendar, ChevronLeft, ChevronRight } from "lucide-react";
import { useLang } from "@/components/shared/Language";
import { MONTHS_SHORT } from "@/lib/i18n";

// Oy+yil tanlagich ("MM/YYYY" ko'rinishida) — MonthPicker'dan farqi: yil
// ham qiymatga kiradi (Kassalar → Chiqim oynasidagi "Oyni tanlang" maydoni
// uchun, referens skrinshotda "08/2026" ko'rinishida).
export interface MonthYearValue {
  month: number; // 1-12
  year: number;
}

// Qisqa oy nomlari navbardagi til tanloviga qarab olinadi (lib/i18n.ts).

/** Ochiladigan oynaning kengligi (`w-72`) — joylashuvni hisoblashda kerak. */
const POPUP_WIDTH = 288;

export interface MonthYearPickerProps {
  value: MonthYearValue | null;
  onChange: (value: MonthYearValue) => void;
  placeholder?: string;
  className?: string;
}

export default function MonthYearPicker({ value, onChange, placeholder = "Oy/yil", className = "" }: MonthYearPickerProps) {
  const [lang] = useLang();
  const MONTH_LABELS = MONTHS_SHORT[lang];
  const [open, setOpen] = useState(false);
  const [viewYear, setViewYear] = useState(() => value?.year ?? new Date().getFullYear());
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const rootRef = useRef<HTMLDivElement>(null);

  const reposition = useCallback(() => {
    if (!rootRef.current) return;
    const r = rootRef.current.getBoundingClientRect();
    // Oyna `position: fixed` — ya'ni ota blokning chegarasi uni ushlab
    // qolmaydi. Tanlagich ekranning o'ng chekkasiga yaqin turganda (masalan
    // o'ngdan chiqadigan Kirim oynasida) 288px kenglik ekrandan chiqib
    // ketardi va oylarning uchinchi ustuni — Mar/Iyn/Sen/Dek — ko'rinmasdi.
    // Shu sababli chap chekka ekran ichiga siqiladi.
    const left = Math.max(8, Math.min(r.left, window.innerWidth - POPUP_WIDTH - 8));
    setPos({ top: r.bottom + 8, left });
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
      setViewYear(value?.year ?? new Date().getFullYear());
    }
  }

  function pickMonth(m: number) {
    onChange({ month: m, year: viewYear });
    setOpen(false);
  }

  return (
    <div className={`relative ${className}`} ref={rootRef}>
      <button type="button" onClick={toggleOpen} className="w-full inline-flex items-center h-10 rounded-lg border border-border bg-card px-3 gap-2 text-sm justify-between">
        <span className={value ? "text-foreground tabular-nums" : "text-muted-foreground"}>
          {value ? `${String(value.month).padStart(2, "0")}/${value.year}` : placeholder}
        </span>
        <Calendar className="w-4 h-4 text-muted-foreground shrink-0" />
      </button>

      {open && (
        <div style={{ position: "fixed", top: pos.top, left: pos.left, zIndex: 120 }} className="w-72 rounded-xl border border-border bg-card shadow-xl p-4">
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
              const active = value?.month === m && value?.year === viewYear;
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
