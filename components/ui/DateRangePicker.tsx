"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Calendar, ChevronLeft, ChevronRight, X } from "lucide-react";
import { useLang } from "@/components/shared/Language";
import { MONTHS, WEEKDAYS_SHORT } from "@/lib/i18n";

// Qayta ishlatiladigan sana-oralig'i tanlagich (referens: akademiya.edutizim.uz):
// CHAPDA tez tanlash tugmalari (Bugun / Kecha / Bu hafta / O'tgan hafta /
// Bu oy / O'tgan oy), o'ngda KETMA-KET IKKI OY kalendari — oraliqni ikki oy
// orasida tanlash uchun. Boshqariladigan (controlled): value + onChange.

export interface DateRange {
  start: Date | null;
  end: Date | null;
}

export interface DateRangePickerProps {
  value: DateRange;
  onChange: (range: DateRange) => void;
  placeholder?: string;
  className?: string;
}

// Oy/hafta kuni nomlari navbardagi til tanloviga qarab olinadi (lib/i18n.ts).

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}
function addDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return startOfDay(x);
}
function sameDay(a: Date | null, b: Date | null): boolean {
  return !!a && !!b && a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}
function fmt(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${String(d.getFullYear()).slice(2)}`;
}

// Preset oraliqlar (bugungi kundan). Hafta yakshanbadan boshlanadi (kalendar Su bilan).
function presets(): { key: string; label: string; range: () => DateRange }[] {
  const today = startOfDay(new Date());
  const weekStart = addDays(today, -today.getDay()); // yakshanba
  return [
    { key: "today", label: "Bugun", range: () => ({ start: today, end: today }) },
    { key: "yesterday", label: "Kecha", range: () => ({ start: addDays(today, -1), end: addDays(today, -1) }) },
    { key: "week", label: "Bu hafta", range: () => ({ start: weekStart, end: addDays(weekStart, 6) }) },
    { key: "lastweek", label: "O'tgan hafta", range: () => ({ start: addDays(weekStart, -7), end: addDays(weekStart, -1) }) },
    { key: "month", label: "Bu oy", range: () => ({ start: new Date(today.getFullYear(), today.getMonth(), 1), end: new Date(today.getFullYear(), today.getMonth() + 1, 0) }) },
    { key: "lastmonth", label: "O'tgan oy", range: () => ({ start: new Date(today.getFullYear(), today.getMonth() - 1, 1), end: new Date(today.getFullYear(), today.getMonth(), 0) }) },
  ];
}

export default function DateRangePicker({ value, onChange, placeholder = "Sana oralig'i", className = "" }: DateRangePickerProps) {
  const [lang] = useLang();
  const monthNames = MONTHS[lang];
  const weekdayNames = WEEKDAYS_SHORT[lang];
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<Date>(() => startOfDay(value.start ?? new Date()));
  const [pendingStart, setPendingStart] = useState<Date | null>(null);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const rootRef = useRef<HTMLDivElement>(null);

  // Popover trigger ostida joylashadi. `fixed` — ota-elementdagi
  // `overflow-hidden` (jadval kartasi) uni kesib qo'ymasligi uchun.
  const reposition = useCallback(() => {
    if (rootRef.current) {
      const r = rootRef.current.getBoundingClientRect();
      // Panel ~720px — o'ng chekkadan chiqib ketmasligi uchun siljitamiz.
      const left = Math.max(8, Math.min(r.left, window.innerWidth - 736));
      setPos({ top: r.bottom + 8, left });
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
      setView(startOfDay(value.start ?? new Date()));
      setPendingStart(null);
    }
  }

  // Ko'rsatiladigan oy kunlari (boshida bo'sh kataklar).
  const cellsOf = (base: Date): (Date | null)[] => {
    const year = base.getFullYear();
    const month = base.getMonth();
    const lead = new Date(year, month, 1).getDay();
    const total = new Date(year, month + 1, 0).getDate();
    const arr: (Date | null)[] = [];
    for (let i = 0; i < lead; i++) arr.push(null);
    for (let d = 1; d <= total; d++) arr.push(new Date(year, month, d));
    return arr;
  };
  // Chapda joriy oy, o'ngda keyingi oy.
  const months = useMemo(
    () => [view, new Date(view.getFullYear(), view.getMonth() + 1, 1)],
    [view],
  );

  // Ajratib ko'rsatish uchun oraliq (tanlash jarayonida — faqat boshi).
  const rangeStart = pendingStart ?? value.start;
  const rangeEnd = pendingStart ? null : value.end;

  function pickDay(day: Date) {
    if (!pendingStart) {
      setPendingStart(day);
      return;
    }
    const [s, e] = day < pendingStart ? [day, pendingStart] : [pendingStart, day];
    onChange({ start: s, end: e });
    setPendingStart(null);
    setOpen(false);
  }

  function applyPreset(range: DateRange) {
    onChange(range);
    setPendingStart(null);
    setOpen(false);
  }

  const label = value.start && value.end ? `${fmt(value.start)} - ${fmt(value.end)}` : value.start ? fmt(value.start) : "";

  return (
    <div className={`relative ${className}`} ref={rootRef}>
      <div className="flex items-center justify-between h-9 w-full rounded-lg border border-border bg-card px-3 gap-2 text-[13px]">
        <button type="button" onClick={toggleOpen} className="inline-flex items-center gap-2">
          <Calendar className="w-4 h-4 text-primary" />
          <span className={label ? "text-foreground tabular-nums" : "text-muted-foreground"}>{label || placeholder}</span>
        </button>
        {label && (
          <button type="button" onClick={() => onChange({ start: null, end: null })} className="text-muted-foreground hover:text-foreground" title="Tozalash">
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {open && (
        <div
          style={{
            position: "fixed",
            top: pos.top,
            left: pos.left,
            zIndex: 50,
            // Loyihadagi .bg-card yarim shaffof ("shishasimon") — jadval
            // ustidagi bu oynada orqa fon ko'rinib qolmasligi uchun rang
            // inline beriladi va backdrop-filter o'chiriladi.
            backgroundColor: "hsl(var(--card))",
            backdropFilter: "none",
          }}
          className="flex rounded-xl border border-border shadow-xl overflow-hidden"
        >
          {/* Presetlar — chapda */}
          <div className="border-r border-border p-2 w-40 flex flex-col gap-0.5 shrink-0">
            {presets().map((p) => (
              <button key={p.key} type="button" onClick={() => applyPreset(p.range())} className="w-full text-left px-3 py-2 rounded-md hover:bg-secondary text-[13px]">
                {p.label}
              </button>
            ))}
          </div>

          {/* Ketma-ket ikki oy */}
          {months.map((mDate, idx) => (
            // Kenglik: 7×36 katak + 6×4 oraliq + 2×12 ichki bo'shliq = 300px.
            // 280px da o'ngdagi ustun sig'may qirqilib qolardi.
            <div key={`${mDate.getFullYear()}-${mDate.getMonth()}`} className={`p-3 ${idx === 1 ? "border-l border-border" : ""}`} style={{ width: 300 }}>
              <div className="flex items-center justify-between mb-2">
                {idx === 0 ? (
                  <button type="button" onClick={() => setView(new Date(view.getFullYear(), view.getMonth() - 1, 1))} className="h-7 w-7 rounded-md hover:bg-secondary inline-flex items-center justify-center text-muted-foreground">
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                ) : <span className="h-7 w-7" />}
                <div className="text-[14px] font-semibold text-primary">{monthNames[mDate.getMonth()]} {mDate.getFullYear()}</div>
                {idx === 1 ? (
                  <button type="button" onClick={() => setView(new Date(view.getFullYear(), view.getMonth() + 1, 1))} className="h-7 w-7 rounded-md hover:bg-secondary inline-flex items-center justify-center text-muted-foreground">
                    <ChevronRight className="w-4 h-4" />
                  </button>
                ) : <span className="h-7 w-7" />}
              </div>
              <div className="grid gap-1" style={{ gridTemplateColumns: "repeat(7, 1fr)" }}>
                {weekdayNames.map((w) => (
                  <div key={w} className="h-8 flex items-center justify-center text-[11px] font-medium text-muted-foreground">{w}</div>
                ))}
                {cellsOf(mDate).map((day, i) => {
                  if (!day) return <div key={`e${idx}-${i}`} />;
                  const isStart = sameDay(day, rangeStart);
                  const isEnd = sameDay(day, rangeEnd);
                  const inRange = !!rangeStart && !!rangeEnd && day > rangeStart && day < rangeEnd;
                  const endpoint = isStart || isEnd;
                  return (
                    <button
                      key={day.toISOString()}
                      type="button"
                      onClick={() => pickDay(day)}
                      className={`h-9 w-9 mx-auto inline-flex items-center justify-center text-[13px] tabular-nums transition-colors ${
                        endpoint ? "bg-primary text-white rounded-full font-semibold" : inRange ? "bg-primary/10 text-foreground rounded-md" : "text-foreground hover:bg-secondary rounded-full"
                      }`}
                    >
                      {day.getDate()}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
