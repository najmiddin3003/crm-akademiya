"use client";

import { useEffect, useRef, useState } from "react";
import { Calendar, ChevronLeft, ChevronRight } from "lucide-react";
import { useLang, useT } from "@/components/shared/Language";
import FloatingPanel from "@/components/v2/ui/FloatingPanel";
import { dayMonthLabel } from "@/components/v2/ui/V2DateRange";
import { MONTHS, WEEKDAYS_SHORT } from "@/lib/i18n";
import { uzTimeHm } from "@/lib/uzTime";
import { fieldCls, type FieldState } from "./fields";

// YANGI VERSIYA: SANA MAYDONI — «📅 12-oktyabr | 12:20» (rasmlar «To'lov qabul
// qilish», «Kassa amali», 19.10.2026). Bosilsa bir oylik taqvim (hafta
// yakshanbadan — V2DateRange bilan bir xil) va «Bugun».
//
// VAQT: server yozuvga SAQLASH PAYTIDAGI vaqtni qo'yadi (lib/cashboxAdjust.ts →
// nowTime), shuning uchun bu yerda vaqt tanlanmaydi — joriy soat ko'rsatiladi va
// o'zi yangilanadi (rost aytadi). Qo'lda vaqt kerak bo'lsa — SAVOLLAR.md 74.

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}
function sameDay(a: Date | null, b: Date | null): boolean {
  return !!a && !!b && a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

/** Joriy soat («12:20»), har 20 soniyada yangilanadi. */
function useClock(on: boolean): string {
  const [now, setNow] = useState(() => (on ? uzTimeHm() : ""));
  useEffect(() => {
    if (!on) return;
    const id = window.setInterval(() => setNow(uzTimeHm()), 20_000);
    return () => window.clearInterval(id);
  }, [on]);
  return now;
}

export default function V2DateField({
  value,
  onChange,
  withTime = false,
  state = "default",
  id,
  disabled = false,
}: {
  value: Date | null;
  onChange: (d: Date) => void;
  /** «| 12:20» — saqlash vaqti (joriy soat). */
  withTime?: boolean;
  state?: FieldState;
  id?: string;
  disabled?: boolean;
}) {
  const [lang] = useLang();
  const { t } = useT();
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<Date>(() => startOfDay(value ?? new Date()));
  const btnRef = useRef<HTMLButtonElement>(null);
  const clock = useClock(withTime);

  const toggle = () => {
    if (!open) setView(new Date((value ?? new Date()).getFullYear(), (value ?? new Date()).getMonth(), 1));
    setOpen((o) => !o);
  };
  const pick = (d: Date) => {
    onChange(d);
    setOpen(false);
    btnRef.current?.focus();
  };

  const today = startOfDay(new Date());
  const lead = new Date(view.getFullYear(), view.getMonth(), 1).getDay();
  const total = new Date(view.getFullYear(), view.getMonth() + 1, 0).getDate();
  const cells: (Date | null)[] = [
    ...Array.from({ length: lead }, () => null),
    ...Array.from({ length: total }, (_, i) => new Date(view.getFullYear(), view.getMonth(), i + 1)),
  ];

  return (
    <>
      <button
        ref={btnRef}
        id={id}
        type="button"
        disabled={disabled}
        onClick={toggle}
        aria-haspopup="dialog"
        aria-expanded={open}
        title={withTime ? t("Vaqt — saqlangan payt") : undefined}
        className={fieldCls(state, `flex items-center gap-2 text-left ${open ? "border-v2-brand shadow-v2-focus" : ""}`)}
      >
        <Calendar className="size-4 shrink-0 text-v2-text-2" strokeWidth={1.75} aria-hidden />
        <span className="min-w-0 flex-1 truncate tabular-nums">
          {value ? dayMonthLabel(value, lang) : <span className="text-v2-text-3">{t("Sanani tanlang")}</span>}
          {withTime && clock && <span> | {clock}</span>}
        </span>
      </button>
      <FloatingPanel open={open} anchorRef={btnRef} onClose={() => setOpen(false)} width={300} maxHeight={380} role="dialog" ariaLabel={t("Sanani tanlang")}>
        <div className="p-3">
          <div className="mb-2 flex items-center justify-between">
            <button
              type="button"
              onClick={() => setView(new Date(view.getFullYear(), view.getMonth() - 1, 1))}
              aria-label={t("Oldingi oy")}
              className="inline-flex size-8 items-center justify-center rounded-v2-md text-v2-text-2 hover:bg-v2-hover hover:text-v2-text"
            >
              <ChevronLeft className="size-4" strokeWidth={1.75} />
            </button>
            <div className="text-v2-body font-semibold text-v2-text">
              {MONTHS[lang][view.getMonth()]} {view.getFullYear()}
            </div>
            <button
              type="button"
              onClick={() => setView(new Date(view.getFullYear(), view.getMonth() + 1, 1))}
              aria-label={t("Keyingi oy")}
              className="inline-flex size-8 items-center justify-center rounded-v2-md text-v2-text-2 hover:bg-v2-hover hover:text-v2-text"
            >
              <ChevronRight className="size-4" strokeWidth={1.75} />
            </button>
          </div>
          <div className="grid grid-cols-7 gap-y-1">
            {WEEKDAYS_SHORT[lang].map((w) => (
              <div key={w} className="flex h-7 items-center justify-center text-v2-caption text-v2-text-3">
                {w}
              </div>
            ))}
            {cells.map((day, i) => {
              if (!day) return <div key={`e${i}`} />;
              const on = sameDay(day, value);
              const isToday = sameDay(day, today);
              return (
                <div key={day.getDate()} className="flex justify-center">
                  <button
                    type="button"
                    onClick={() => pick(day)}
                    aria-pressed={on}
                    className={`inline-flex size-9 items-center justify-center rounded-v2-full text-v2-body tabular-nums transition-colors ${
                      on ? "bg-v2-brand font-semibold text-v2-on-brand" : "text-v2-text hover:bg-v2-hover"
                    } ${isToday && !on ? "font-semibold text-v2-brand-text" : ""}`}
                  >
                    {day.getDate()}
                  </button>
                </div>
              );
            })}
          </div>
          <button type="button" onClick={() => pick(new Date())} className="mt-2 h-8 w-full rounded-v2-md text-v2-small font-medium text-v2-brand-text hover:bg-v2-brand-bg">
            {t("Bugun")}
          </button>
        </div>
      </FloatingPanel>
    </>
  );
}
