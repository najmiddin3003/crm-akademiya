"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { Calendar, ChevronLeft, ChevronRight } from "lucide-react";
import { useLang, useT } from "@/components/shared/Language";
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

/** "YYYY-MM" (native <input type="month"> formati) → qiymat; noto'g'ri bo'lsa null. */
export function monthYearFromIso(s: string | null | undefined): MonthYearValue | null {
  const m = /^(\d{4})-(\d{2})$/.exec(String(s ?? ""));
  return m ? { year: Number(m[1]), month: Number(m[2]) } : null;
}

/** Qiymat → "YYYY-MM". */
export function monthYearToIso(v: MonthYearValue): string {
  return `${v.year}-${String(v.month).padStart(2, "0")}`;
}

/**
 * KO'P OY TANLASH (21.11.2026, Kirim → «Bir nechta oy»; so'rov 04.10: "oy tanlashda bosib
 * oylar ochilganda yuqorida bir nechta oy deb bir checkbox tursin, uni yoqilsa bir necha oyni
 * tanlashi kerak bo'ladi"). Berilsa ochiladigan oynaning tepasida katakcha chiqadi; yoqilganda
 * oy bosilsa tanlovga qo'shiladi/olinadi va oyna yopilmaydi. Holat chaqiruvchida
 * (components/finance/useKirimForm.ts → monthMode, monthSel, toggleMonth).
 */
export interface MonthYearMulti {
  on: boolean;
  onToggle: (on: boolean) => void;
  /** Tanlangan oylar, "YYYY-MM". */
  selected: string[];
  onPick: (key: string) => void;
}

export interface MonthYearPickerProps {
  value: MonthYearValue | null;
  onChange: (value: MonthYearValue) => void;
  placeholder?: string;
  className?: string;
  multi?: MonthYearMulti;
}

export default function MonthYearPicker({ value, onChange, placeholder, className = "", multi }: MonthYearPickerProps) {
  const [lang] = useLang();
  const { t } = useT();
  const MONTH_LABELS = MONTHS_SHORT[lang];
  const [open, setOpen] = useState(false);
  const [viewYear, setViewYear] = useState(() => value?.year ?? new Date().getFullYear());
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const rootRef = useRef<HTMLDivElement>(null);
  const popupRef = useRef<HTMLDivElement>(null);

  const reposition = useCallback(() => {
    if (!rootRef.current) return;
    const r = rootRef.current.getBoundingClientRect();
    // Oyna `position: fixed` — ya'ni ota blokning chegarasi uni ushlab
    // qolmaydi. Tanlagich ekranning o'ng chekkasiga yaqin turganda (masalan
    // o'ngdan chiqadigan Kirim oynasida) 288px kenglik ekrandan chiqib
    // ketardi va oylarning uchinchi ustuni — Mar/Iyn/Sen/Dek — ko'rinmasdi.
    // Shu sababli chap chekka ekran ichiga siqiladi.
    const left = Math.max(8, Math.min(r.left, window.innerWidth - POPUP_WIDTH - 8));
    // Pastda joy yetmasa (telefon, oynaning pastki qismi) — tepaga ochiladi; aks holda
    // oxirgi qatordagi oylar ekrandan chiqib qolardi (oyna `fixed`, aylantirib bo'lmaydi).
    const h = popupRef.current?.offsetHeight ?? 260;
    const below = r.bottom + 8;
    const top = below + h > window.innerHeight - 8 && r.top - 8 - h >= 8 ? r.top - 8 - h : below;
    setPos({ top, left });
  }, []);

  // Oyna chizilgach haqiqiy balandligi bilan qayta joylash (katakcha yoqilganda ham).
  useLayoutEffect(() => {
    if (open) reposition();
  }, [open, reposition, multi?.on]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    // Esc avval shu oynani yopsin, ota Modal'ni emas (capture — Modal window'da tinglaydi).
    // Ko'p oy rejimida oyna oy bosilganda yopilmaydi, Esc bilan chiqish tabiiy.
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.stopPropagation();
      e.preventDefault();
      setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    window.addEventListener("keydown", onKey, true);
    window.addEventListener("scroll", reposition, true);
    window.addEventListener("resize", reposition);
    return () => {
      document.removeEventListener("mousedown", onDown);
      window.removeEventListener("keydown", onKey, true);
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
    if (multi?.on) {
      multi.onPick(monthYearToIso({ month: m, year: viewYear }));
      return;
    }
    onChange({ month: m, year: viewYear });
    setOpen(false);
  }
  const multiOn = !!multi?.on;
  const shown = multiOn
    ? multi!.selected.map((k) => `${k.slice(5, 7)}/${k.slice(0, 4)}`).join(", ")
    : value
      ? `${String(value.month).padStart(2, "0")}/${value.year}`
      : "";

  return (
    <div className={`relative ${className}`} ref={rootRef}>
      <button type="button" onClick={toggleOpen} className="w-full inline-flex items-center h-10 rounded-lg border border-border bg-card px-3 gap-2 text-sm justify-between">
        <span className={`min-w-0 truncate ${shown ? "text-foreground tabular-nums" : "text-muted-foreground"}`}>
          {shown || (placeholder ?? t("Oy/yil"))}
        </span>
        <Calendar className="w-4 h-4 text-muted-foreground shrink-0" />
      </button>

      {open && (
        <div ref={popupRef} style={{ position: "fixed", top: pos.top, left: pos.left, zIndex: 120 }} className="w-72 rounded-xl border border-border bg-card shadow-xl p-4">
          {multi && (
            <label className="mb-3 flex cursor-pointer items-center gap-2 border-b border-border pb-3 text-[13px] font-medium">
              <input type="checkbox" checked={multi.on} onChange={(e) => multi.onToggle(e.target.checked)} className="h-4 w-4 rounded accent-primary" />
              {t("Bir nechta oy")}
            </label>
          )}
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
              const active = multiOn
                ? multi!.selected.includes(monthYearToIso({ month: m, year: viewYear }))
                : value?.month === m && value?.year === viewYear;
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
