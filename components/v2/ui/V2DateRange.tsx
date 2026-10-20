"use client";

import { useRef, useState } from "react";
import { Calendar, ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";
import { useLang, useT } from "@/components/shared/Language";
import { dateRangePresets, type DateRange } from "@/components/ui/DateRangePicker";
import { MONTHS, WEEKDAYS_SHORT, type Lang } from "@/lib/i18n";
import { panelTriggerCls } from "./buttons";
import FloatingPanel from "./FloatingPanel";

// YANGI VERSIYA: SANA ORALIG'I TANLOVI (rasm «Kassalar», 18.10.2026 — «Bugun,
// 12-oktyabr ⌄»). Tugma — ikkinchi darajali, ichida taqvim ikonka va oraliq
// yozuvi; oynada chapda tez tanlash (eski DateRangePicker bilan BITTA ro'yxat —
// `dateRangePresets`, «Bu hafta» ikki versiyada bir xil), o'ngda bir oylik
// taqvim: birinchi bosish — boshi, ikkinchisi — oxiri (bir kun uchun ikki
// marta bir xil kunni bosing). Hafta yakshanbadan — eski taqvim bilan bir xil.

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

/** «12-oktyabr» (en: «Oct 12»); boshqa yil bo'lsa yili ham. */
export function dayMonthLabel(d: Date, lang: Lang): string {
  const month = MONTHS[lang][d.getMonth()];
  const year = d.getFullYear() === new Date().getFullYear() ? "" : ` ${d.getFullYear()}`;
  return lang === "en" ? `${month.slice(0, 3)} ${d.getDate()}${year}` : `${d.getDate()}-${month.toLowerCase()}${year}`;
}

export function rangeLabel(r: DateRange, lang: Lang, t: (s: string) => string): string {
  if (!r.start) return t("Barcha sanalar");
  const s = r.start;
  const e = r.end ?? r.start;
  const today = startOfDay(new Date());
  if (sameDay(s, e)) {
    const dm = dayMonthLabel(s, lang);
    if (sameDay(s, today)) return `${t("Bugun")}, ${dm}`;
    if (sameDay(s, addDays(today, -1))) return `${t("Kecha")}, ${dm}`;
    return dm;
  }
  if (lang !== "en" && s.getMonth() === e.getMonth() && s.getFullYear() === e.getFullYear()) return `${s.getDate()}–${dayMonthLabel(e, lang)}`;
  return `${dayMonthLabel(s, lang)} – ${dayMonthLabel(e, lang)}`;
}

/**
 * Yangi versiyadagi tez tanlash nomlari — dizayn «Shu oy» deydi (rasm «Lidlar»,
 * 20.10.2026); eski taqvimdagi «Bu hafta» / «Bu oy» o'zgarmaydi.
 */
const V2_PRESET_LABEL: Record<string, string> = { week: "Shu hafta", month: "Shu oy" };

export function v2PresetLabel(p: { key: string; label: string }): string {
  return V2_PRESET_LABEL[p.key] ?? p.label;
}

/** Oraliq tez tanlashlardan biriga tengmi — kaliti («today», «month» …), aks holda null. */
export function rangePresetKey(value: DateRange): string | null {
  if (!value.start) return null;
  return (
    dateRangePresets().find((p) => {
      const r = p.range();
      return sameDay(r.start, value.start) && sameDay(r.end, value.end ?? value.start);
    })?.key ?? null
  );
}

export default function V2DateRange({
  value,
  onChange,
  align = "end",
  allowAll = true,
  label,
  allLabel = "Barcha sanalar",
}: {
  value: DateRange;
  onChange: (r: DateRange) => void;
  align?: "start" | "end";
  /** «Barcha sanalar» bandi (oraliqsiz). */
  allowAll?: boolean;
  /** Tugmadagi yozuv (sukut — oraliqning o'zi: «Bugun, 12-oktyabr»). */
  label?: string;
  /** Oraliqsiz band nomi (Lidlarda — «Butun davr»). */
  allLabel?: string;
}) {
  const [lang] = useLang();
  const { t } = useT();
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<Date>(() => startOfDay(value.start ?? new Date()));
  const [pending, setPending] = useState<Date | null>(null);
  const [hover, setHover] = useState<Date | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);

  function toggle() {
    const next = !open;
    setOpen(next);
    if (next) {
      setView(new Date((value.start ?? new Date()).getFullYear(), (value.start ?? new Date()).getMonth(), 1));
      setPending(null);
      setHover(null);
    }
  }
  function choose(r: DateRange) {
    onChange(r);
    setPending(null);
    setOpen(false);
    btnRef.current?.focus();
  }
  function pick(day: Date) {
    if (!pending) {
      setPending(day);
      return;
    }
    const [s, e] = day < pending ? [day, pending] : [pending, day];
    choose({ start: s, end: e });
  }

  const today = startOfDay(new Date());
  const lead = new Date(view.getFullYear(), view.getMonth(), 1).getDay();
  const total = new Date(view.getFullYear(), view.getMonth() + 1, 0).getDate();
  const cells: (Date | null)[] = [...Array.from({ length: lead }, () => null), ...Array.from({ length: total }, (_, i) => new Date(view.getFullYear(), view.getMonth(), i + 1))];

  // Ajratiladigan oraliq: tanlash paytida — boshidan sichqoncha turgan kungacha.
  const a = pending ?? value.start;
  const b = pending ? (hover ?? pending) : (value.end ?? value.start);
  const [lo, hi] = a && b && b < a ? [b, a] : [a, b];

  const presetKey = rangePresetKey(value);

  return (
    <>
      <button ref={btnRef} type="button" onClick={toggle} aria-haspopup="dialog" aria-expanded={open} className={panelTriggerCls(open)}>
        <Calendar className="size-4 text-v2-text-2" strokeWidth={1.75} aria-hidden />
        <span className="whitespace-nowrap tabular-nums">{label ?? rangeLabel(value, lang, t)}</span>
        <ChevronDown className={`size-4 text-v2-text-3 transition-transform ${open ? "rotate-180" : ""}`} strokeWidth={1.75} aria-hidden />
      </button>
      <FloatingPanel open={open} anchorRef={btnRef} onClose={() => setOpen(false)} align={align} width={476} maxHeight={420} role="dialog" ariaLabel={t("Sana oralig'i")}>
        <div className="flex min-h-0">
          <div className="flex w-[148px] shrink-0 flex-col gap-0.5 border-r border-v2-border p-1.5">
            {dateRangePresets().map((p) => (
              <button
                key={p.key}
                type="button"
                onClick={() => choose(p.range())}
                className={`rounded-v2-md px-2.5 py-2 text-left text-v2-body transition-colors ${presetKey === p.key ? "bg-v2-brand-bg font-medium text-v2-brand-text" : "text-v2-text hover:bg-v2-hover"}`}
              >
                {t(v2PresetLabel(p))}
              </button>
            ))}
            {allowAll && (
              <button
                type="button"
                onClick={() => choose({ start: null, end: null })}
                className={`mt-auto rounded-v2-md px-2.5 py-2 text-left text-v2-body transition-colors ${!value.start ? "bg-v2-brand-bg font-medium text-v2-brand-text" : "text-v2-text-2 hover:bg-v2-hover hover:text-v2-text"}`}
              >
                {t(allLabel)}
              </button>
            )}
          </div>

          <div className="min-w-0 flex-1 p-3">
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
            <div className="grid grid-cols-7 gap-y-1" onMouseLeave={() => setHover(null)}>
              {WEEKDAYS_SHORT[lang].map((w) => (
                <div key={w} className="flex h-7 items-center justify-center text-v2-caption text-v2-text-3">
                  {w}
                </div>
              ))}
              {cells.map((day, i) => {
                if (!day) return <div key={`e${i}`} />;
                const edge = sameDay(day, lo) || sameDay(day, hi);
                const inside = !!lo && !!hi && day > lo && day < hi;
                const isToday = sameDay(day, today);
                return (
                  <div key={day.getDate()} className={`flex justify-center ${inside ? "bg-v2-brand-bg" : ""}`}>
                    <button
                      type="button"
                      onClick={() => pick(day)}
                      onMouseEnter={() => pending && setHover(day)}
                      aria-pressed={edge}
                      className={`inline-flex size-9 items-center justify-center rounded-v2-full text-v2-body tabular-nums transition-colors ${
                        edge ? "bg-v2-brand font-semibold text-v2-on-brand" : inside ? "text-v2-text" : "text-v2-text hover:bg-v2-hover"
                      } ${isToday && !edge ? "font-semibold text-v2-brand-text" : ""}`}
                    >
                      {day.getDate()}
                    </button>
                  </div>
                );
              })}
            </div>
            <p className="mt-2 text-v2-caption text-v2-text-3">{pending ? t("Oxirgi kunni tanlang") : t("Boshlanish kunini tanlang")}</p>
          </div>
        </div>
      </FloatingPanel>
    </>
  );
}
