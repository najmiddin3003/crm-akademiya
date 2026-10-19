"use client";

import { useRef, useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { useT } from "@/components/shared/Language";
import FloatingPanel from "./FloatingPanel";

// YANGI VERSIYA: OY TANLAGICH — «‹ Oktabr 2026 ›» (rasm «Oylik chiqarish»,
// 19.10.2026). Strelkalar — oldingi / keyingi oy; o'rtadagi yozuv bosilsa
// yil va 12 oy to'ri ochiladi (joriy oy — brend chegarali, tanlangani — brend
// fonda). Qiymat "YYYY-MM" (lib/salary.ts → payrollMonthKey bilan bir xil).

/** "2026-10" ± n oy. */
function shiftMonth(key: string, delta: number): string {
  const [y, m] = key.split("-").map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

const arrowCls =
  "inline-flex h-full w-8 items-center justify-center text-v2-text-2 transition-colors hover:bg-v2-surface-2 hover:text-v2-text focus-visible:shadow-[inset_0_0_0_2px_var(--v2-brand)] focus-visible:outline-none";

export default function V2MonthNav({
  value,
  onChange,
  current,
}: {
  value: string;
  onChange: (key: string) => void;
  /** Joriy oy ("YYYY-MM") — to'rda belgilanadi va «Joriy oy» tugmasi. */
  current?: string;
}) {
  const { t, months } = useT();
  const [open, setOpen] = useState(false);
  const [y, m] = value.split("-").map(Number);
  const [year, setYear] = useState(y);
  const btnRef = useRef<HTMLButtonElement>(null);

  const pick = (key: string) => {
    onChange(key);
    setOpen(false);
  };

  return (
    <>
      <div className="inline-flex h-9 shrink-0 items-stretch overflow-hidden rounded-v2-md border border-v2-border-strong bg-v2-surface">
        <button type="button" onClick={() => onChange(shiftMonth(value, -1))} aria-label={t("Oldingi oy")} title={t("Oldingi oy")} className={arrowCls}>
          <ChevronLeft className="size-4" strokeWidth={1.75} aria-hidden />
        </button>
        <button
          ref={btnRef}
          type="button"
          onClick={() => {
            setYear(y);
            setOpen((o) => !o);
          }}
          aria-haspopup="dialog"
          aria-expanded={open}
          className={`inline-flex items-center gap-2 px-2 text-v2-body font-semibold text-v2-text transition-colors hover:bg-v2-surface-2 focus-visible:shadow-[inset_0_0_0_2px_var(--v2-brand)] focus-visible:outline-none ${open ? "bg-v2-surface-2" : ""}`}
        >
          <CalendarDays className="size-4 text-v2-text-2" strokeWidth={1.75} aria-hidden />
          <span className="whitespace-nowrap tabular-nums">
            {months[m - 1]} {y}
          </span>
        </button>
        <button type="button" onClick={() => onChange(shiftMonth(value, 1))} aria-label={t("Keyingi oy")} title={t("Keyingi oy")} className={arrowCls}>
          <ChevronRight className="size-4" strokeWidth={1.75} aria-hidden />
        </button>
      </div>
      <FloatingPanel open={open} anchorRef={btnRef} onClose={() => setOpen(false)} width={272} role="dialog" ariaLabel={t("Oyni tanlang")}>
        <div className="p-3">
          <div className="mb-2 flex items-center justify-between">
            <button type="button" onClick={() => setYear((v) => v - 1)} aria-label={t("Oldingi yil")} className="inline-flex size-8 items-center justify-center rounded-v2-md text-v2-text-2 hover:bg-v2-surface-2 hover:text-v2-text">
              <ChevronLeft className="size-4" strokeWidth={1.75} aria-hidden />
            </button>
            <span className="text-v2-body font-semibold tabular-nums text-v2-text">{year}</span>
            <button type="button" onClick={() => setYear((v) => v + 1)} aria-label={t("Keyingi yil")} className="inline-flex size-8 items-center justify-center rounded-v2-md text-v2-text-2 hover:bg-v2-surface-2 hover:text-v2-text">
              <ChevronRight className="size-4" strokeWidth={1.75} aria-hidden />
            </button>
          </div>
          <div className="grid grid-cols-3 gap-1">
            {months.map((name, i) => {
              const key = `${year}-${String(i + 1).padStart(2, "0")}`;
              const on = key === value;
              const isCurrent = key === current;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => pick(key)}
                  aria-pressed={on}
                  className={`h-9 rounded-v2-md px-1 text-v2-small transition-colors ${
                    on
                      ? "bg-v2-brand font-semibold text-v2-on-brand"
                      : isCurrent
                        ? "border border-v2-brand font-medium text-v2-brand-text hover:bg-v2-brand-bg"
                        : "text-v2-text hover:bg-v2-surface-2"
                  }`}
                >
                  {name}
                </button>
              );
            })}
          </div>
          {current && value !== current && (
            <button type="button" onClick={() => pick(current)} className="mt-2 h-8 w-full rounded-v2-md text-v2-small font-medium text-v2-brand-text hover:bg-v2-brand-bg">
              {t("Joriy oyga qaytish")}
            </button>
          )}
        </div>
      </FloatingPanel>
    </>
  );
}
