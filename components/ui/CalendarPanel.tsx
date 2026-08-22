"use client";

import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useLang } from "@/components/shared/Language";
import { MONTHS, WEEKDAYS_SHORT } from "@/lib/i18n";

// Bitta oy kalendari — sana tanlanadigan barcha joylar shu paneldan
// foydalanadi (components/ui/DatePicker.tsx — kompakt tugma varianti,
// components/ui/DateField.tsx — forma maydoni varianti). Ilgari kalendar
// faqat DatePicker ichida edi va qayta ishlatib bo'lmasdi.
//
// Oy/hafta kuni nomlari navbardagi til tanloviga qarab olinadi (lib/i18n.ts).

export function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}
export function sameDay(a: Date | null, b: Date | null): boolean {
  return !!a && !!b && a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

export interface CalendarPanelProps {
  value: Date | null;
  onPick: (date: Date) => void;
  /** Panel ochilganda ko'rinadigan oy (odatda `value` yoki bugun). */
  initialView?: Date | null;
}

export default function CalendarPanel({ value, onPick, initialView }: CalendarPanelProps) {
  const [lang] = useLang();
  const monthNames = MONTHS[lang];
  const weekdayNames = WEEKDAYS_SHORT[lang];
  const [view, setView] = useState<Date>(() => startOfDay(initialView ?? value ?? new Date()));

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

  const today = startOfDay(new Date());

  return (
    <>
      <div className="flex items-center justify-between mb-2" style={{ width: 254 }}>
        <button
          type="button"
          onClick={() => setView(new Date(view.getFullYear(), view.getMonth() - 1, 1))}
          className="h-7 w-7 rounded-md hover:bg-secondary inline-flex items-center justify-center text-muted-foreground"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        <div className="text-[14px] font-semibold text-primary">
          {monthNames[view.getMonth()]} {view.getFullYear()}
        </div>
        <button
          type="button"
          onClick={() => setView(new Date(view.getFullYear(), view.getMonth() + 1, 1))}
          className="h-7 w-7 rounded-md hover:bg-secondary inline-flex items-center justify-center text-muted-foreground"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
      <div className="grid gap-1" style={{ gridTemplateColumns: "repeat(7, 1fr)" }}>
        {weekdayNames.map((w) => (
          <div key={w} className="h-8 flex items-center justify-center text-[11px] font-medium text-muted-foreground">
            {w}
          </div>
        ))}
        {cells.map((day, i) => {
          if (!day) return <div key={`e${i}`} />;
          const selected = sameDay(day, value);
          const isToday = !selected && sameDay(day, today);
          return (
            <button
              key={day.toISOString()}
              type="button"
              onClick={() => onPick(day)}
              className={`h-9 w-9 mx-auto inline-flex items-center justify-center text-[13px] tabular-nums transition-colors rounded-full ${
                selected
                  ? "bg-primary text-white font-semibold"
                  : isToday
                    ? "text-primary font-semibold ring-1 ring-primary/40 hover:bg-secondary"
                    : "text-foreground hover:bg-secondary"
              }`}
            >
              {day.getDate()}
            </button>
          );
        })}
      </div>
    </>
  );
}
