"use client";

import { useRef, useState } from "react";
import { Calendar, ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";
import { useLang, useT } from "@/components/shared/Language";
import FloatingPanel from "@/components/v2/ui/FloatingPanel";
import { panelTriggerCls } from "@/components/v2/ui/buttons";
import { MONTHS_SHORT } from "@/lib/i18n";
import { monthRangeLabel, shiftMonth, type MonthRange } from "./reportFormat";

// YANGI VERSIYA — OY ORALIG'I TANLAGICHI (Hisobotlar, rasm «Kelgan va ketgan», 25.10.2026):
// tugma «📅 May – Oktabr 2026 ⌄»; oynada chapda tayyor variantlar (oxirgi 3 / 6 / 12 oy,
// shu yil), o'ngda yil va 12 oy to'ri — birinchi bosish boshlanish oyi, ikkinchisi
// oxirgisi (orasi belgilanadi). Kelajak oy tanlanmaydi (`max`).

const PRESETS: { key: string; label: string; months: number | "year" }[] = [
  { key: "3", label: "Oxirgi 3 oy", months: 3 },
  { key: "6", label: "Oxirgi 6 oy", months: 6 },
  { key: "12", label: "Oxirgi 12 oy", months: 12 },
  { key: "year", label: "Shu yil", months: "year" },
];

function presetRange(p: (typeof PRESETS)[number], max: string): MonthRange {
  if (p.months === "year") return { from: `${max.slice(0, 4)}-01`, to: max };
  return { from: shiftMonth(max, -(p.months - 1)), to: max };
}

export default function V2MonthRange({
  value,
  onChange,
  max,
  align = "start",
}: {
  value: MonthRange;
  onChange: (r: MonthRange) => void;
  /** Eng oxirgi tanlanadigan oy ("YYYY-MM") — odatda joriy oy. */
  max: string;
  align?: "start" | "end";
}) {
  const [lang] = useLang();
  const { t } = useT();
  const [open, setOpen] = useState(false);
  const [year, setYear] = useState(Number(value.to.slice(0, 4)));
  const [pending, setPending] = useState<string | null>(null);
  const [hover, setHover] = useState<string | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);

  function toggle() {
    const next = !open;
    setOpen(next);
    if (next) {
      setYear(Number(value.to.slice(0, 4)));
      setPending(null);
      setHover(null);
    }
  }
  function choose(r: MonthRange) {
    onChange(r);
    setPending(null);
    setOpen(false);
    btnRef.current?.focus();
  }
  function pick(key: string) {
    if (!pending) {
      setPending(key);
      return;
    }
    choose(key < pending ? { from: key, to: pending } : { from: pending, to: key });
  }

  const a = pending ?? value.from;
  const b = pending ? (hover ?? pending) : value.to;
  const [lo, hi] = b < a ? [b, a] : [a, b];
  const activePreset = PRESETS.find((p) => {
    const r = presetRange(p, max);
    return r.from === value.from && r.to === value.to;
  })?.key;
  const maxYear = Number(max.slice(0, 4));

  return (
    <>
      <button ref={btnRef} type="button" onClick={toggle} aria-haspopup="dialog" aria-expanded={open} className={panelTriggerCls(open)}>
        <Calendar className="size-4 text-v2-text-2" strokeWidth={1.75} aria-hidden />
        <span className="whitespace-nowrap font-semibold tabular-nums">{monthRangeLabel(value, lang)}</span>
        <ChevronDown className={`size-4 text-v2-text-3 transition-transform ${open ? "rotate-180" : ""}`} strokeWidth={1.75} aria-hidden />
      </button>
      <FloatingPanel open={open} anchorRef={btnRef} onClose={() => setOpen(false)} align={align} width={420} maxHeight={360} role="dialog" ariaLabel={t("Oylar oralig'i")}>
        <div className="flex min-h-0">
          <div className="flex w-[136px] shrink-0 flex-col gap-0.5 border-r border-v2-border p-1.5">
            {PRESETS.map((p) => (
              <button
                key={p.key}
                type="button"
                onClick={() => choose(presetRange(p, max))}
                className={`rounded-v2-md px-2.5 py-2 text-left text-v2-body transition-colors ${activePreset === p.key ? "bg-v2-brand-bg font-medium text-v2-brand-text" : "text-v2-text hover:bg-v2-hover"}`}
              >
                {t(p.label)}
              </button>
            ))}
          </div>
          <div className="min-w-0 flex-1 p-3">
            <div className="mb-2 flex items-center justify-between">
              <button
                type="button"
                onClick={() => setYear((y) => y - 1)}
                aria-label={t("Oldingi yil")}
                className="inline-flex size-8 items-center justify-center rounded-v2-md text-v2-text-2 hover:bg-v2-hover hover:text-v2-text"
              >
                <ChevronLeft className="size-4" strokeWidth={1.75} />
              </button>
              <div className="text-v2-body font-semibold tabular-nums text-v2-text">{year}</div>
              <button
                type="button"
                onClick={() => setYear((y) => Math.min(maxYear, y + 1))}
                disabled={year >= maxYear}
                aria-label={t("Keyingi yil")}
                className="inline-flex size-8 items-center justify-center rounded-v2-md text-v2-text-2 hover:bg-v2-hover hover:text-v2-text disabled:opacity-40 disabled:hover:bg-transparent"
              >
                <ChevronRight className="size-4" strokeWidth={1.75} />
              </button>
            </div>
            <div className="grid grid-cols-3 gap-1" onMouseLeave={() => setHover(null)}>
              {MONTHS_SHORT[lang].map((m, i) => {
                const key = `${year}-${String(i + 1).padStart(2, "0")}`;
                const future = key > max;
                const edge = key === lo || key === hi;
                const inside = key > lo && key < hi;
                return (
                  <button
                    key={key}
                    type="button"
                    disabled={future}
                    onClick={() => pick(key)}
                    onMouseEnter={() => pending && setHover(key)}
                    aria-pressed={edge}
                    className={`h-9 rounded-v2-md text-v2-body transition-colors disabled:cursor-not-allowed disabled:text-v2-text-3 disabled:opacity-50 ${
                      edge ? "bg-v2-brand font-semibold text-v2-on-brand" : inside ? "bg-v2-brand-bg text-v2-text" : "text-v2-text hover:bg-v2-hover"
                    } ${key === max && !edge ? "font-semibold text-v2-brand-text" : ""}`}
                  >
                    {m}
                  </button>
                );
              })}
            </div>
            <p className="mt-2 text-v2-caption text-v2-text-3">{pending ? t("Oxirgi oyni tanlang") : t("Boshlanish oyini tanlang")}</p>
          </div>
        </div>
      </FloatingPanel>
    </>
  );
}
