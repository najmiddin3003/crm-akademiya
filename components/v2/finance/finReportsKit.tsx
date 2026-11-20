"use client";

import { useRef, useState, type ReactNode } from "react";
import { ArrowDown, ArrowUp, CalendarDays, ChevronLeft, ChevronRight, Minus } from "lucide-react";
import { useT } from "@/components/shared/Language";
import FloatingPanel from "@/components/v2/ui/FloatingPanel";
import V2Select from "@/components/v2/ui/V2Select";
import { Meter } from "@/components/v2/reports/report35";

// YANGI VERSIYA — MOLIYA (28-qism, moliya-A): «Kirim chiqim», «Moliya hisobotlari», «P&L» va
// «Pul oqimi» sahifalarining umumiy bo'laklari: yil tanlagich, oy tanlovi, o'zgarish
// belgisi, ulush qatorlari, jadval kataklari. Hisob — ./finReportsCalc.ts.

/* ───────────────────────── Formatlash ───────────────────────── */

/** «3 190 000» (manfiy — «−3 190 000»). */
export function finNum(v: number): string {
  const n = Math.round(v);
  return (n < 0 ? "−" : "") + Math.abs(n).toLocaleString("ru-RU").replace(/\s|,/g, " ");
}

/** Ulush, bitta kasr: «12.3%» (eski taqsimot panjarasidagi bilan bir xil aniqlik). */
export function finShare(part: number, whole: number): string {
  if (!(whole > 0)) return "0%";
  return `${((part / whole) * 100).toFixed(1)}%`;
}

/* ───────────────────────── Jadval ───────────────────────── */

/** Qotgan sarlavha katagi (DESIGN.md → «Jadval»: eski `.table-scroll` ishlatilmaydi). */
const TH_BASE = "sticky top-0 h-9 whitespace-nowrap bg-v2-surface-2 px-4 text-v2-caption text-v2-text-2 shadow-[inset_0_-1px_0_var(--v2-border)]";
export const FIN_TH = `${TH_BASE} z-10 font-medium`;
/** «Jami» ustuni sarlavhasi — qalin, asosiy matn rangida. */
export const FIN_TH_TOTAL = "sticky top-0 z-10 h-9 whitespace-nowrap bg-v2-surface-2 px-4 text-right text-v2-caption font-semibold text-v2-text shadow-[inset_0_-1px_0_var(--v2-border)]";
/** Qotgan chap ustun (telefonda oylar suriladi, nom ko'rinib turadi) — fon qatornikiga teng bo'lishi shart. */
export const FIN_STICKY_LEFT = "sticky left-0 z-[1]";
/** Burchak katagi (sarlavha + chap ustun). */
export const FIN_TH_CORNER = `${TH_BASE} left-0 z-20 text-left font-medium`;

/* ───────────────────────── Yil tanlagich ───────────────────────── */

const arrowCls =
  "inline-flex h-full w-8 items-center justify-center text-v2-text-2 transition-colors hover:bg-v2-surface-2 hover:text-v2-text focus-visible:shadow-[inset_0_0_0_2px_var(--v2-brand)] focus-visible:outline-none";

/**
 * «‹ 2026 ›» — V2MonthNav uslubida. O'rtasi bosilsa o'n yillik to'r (eski YearPicker kabi:
 * oldingi va keyingi o'n yillik, joriy yil — brend chegara, tanlangani — brend fon).
 */
export function FinYearNav({ value, onChange }: { value: number; onChange: (y: number) => void }) {
  const { t } = useT();
  const [open, setOpen] = useState(false);
  const [decade, setDecade] = useState(() => Math.floor(value / 10) * 10);
  const btnRef = useRef<HTMLButtonElement>(null);
  const thisYear = new Date().getFullYear();
  const years = Array.from({ length: 12 }, (_, i) => decade - 1 + i);

  return (
    <>
      <div className="inline-flex h-9 shrink-0 items-stretch overflow-hidden rounded-v2-md border border-v2-border-strong bg-v2-surface">
        <button type="button" onClick={() => onChange(value - 1)} aria-label={t("Oldingi yil")} title={t("Oldingi yil")} className={arrowCls}>
          <ChevronLeft className="size-4" strokeWidth={1.75} aria-hidden />
        </button>
        <button
          ref={btnRef}
          type="button"
          onClick={() => {
            setDecade(Math.floor(value / 10) * 10);
            setOpen((o) => !o);
          }}
          aria-haspopup="dialog"
          aria-expanded={open}
          aria-label={`${t("Yilni tanlang")}: ${value}`}
          className={`inline-flex items-center gap-2 px-2 text-v2-body font-semibold text-v2-text transition-colors hover:bg-v2-surface-2 focus-visible:shadow-[inset_0_0_0_2px_var(--v2-brand)] focus-visible:outline-none ${open ? "bg-v2-surface-2" : ""}`}
        >
          <CalendarDays className="size-4 text-v2-text-2" strokeWidth={1.75} aria-hidden />
          <span className="whitespace-nowrap tabular-nums">{value}</span>
        </button>
        <button type="button" onClick={() => onChange(value + 1)} aria-label={t("Keyingi yil")} title={t("Keyingi yil")} className={arrowCls}>
          <ChevronRight className="size-4" strokeWidth={1.75} aria-hidden />
        </button>
      </div>
      <FloatingPanel open={open} anchorRef={btnRef} onClose={() => setOpen(false)} width={248} role="dialog" ariaLabel={t("Yilni tanlang")}>
        <div className="p-3">
          <div className="mb-2 flex items-center justify-between">
            <button type="button" onClick={() => setDecade((d) => d - 10)} aria-label={t("Oldingi o'n yillik")} className="inline-flex size-8 items-center justify-center rounded-v2-md text-v2-text-2 hover:bg-v2-surface-2 hover:text-v2-text">
              <ChevronLeft className="size-4" strokeWidth={1.75} aria-hidden />
            </button>
            <span className="text-v2-body font-semibold tabular-nums text-v2-text">
              {decade}–{decade + 9}
            </span>
            <button type="button" onClick={() => setDecade((d) => d + 10)} aria-label={t("Keyingi o'n yillik")} className="inline-flex size-8 items-center justify-center rounded-v2-md text-v2-text-2 hover:bg-v2-surface-2 hover:text-v2-text">
              <ChevronRight className="size-4" strokeWidth={1.75} aria-hidden />
            </button>
          </div>
          <div className="grid grid-cols-3 gap-1">
            {years.map((y) => {
              const on = y === value;
              const outside = y < decade || y > decade + 9;
              return (
                <button
                  key={y}
                  type="button"
                  aria-pressed={on}
                  onClick={() => {
                    onChange(y);
                    setOpen(false);
                  }}
                  className={`h-9 rounded-v2-md px-1 text-v2-small tabular-nums transition-colors ${
                    on
                      ? "bg-v2-brand font-semibold text-v2-on-brand"
                      : y === thisYear
                        ? "border border-v2-brand font-medium text-v2-brand-text hover:bg-v2-brand-bg"
                        : outside
                          ? "text-v2-text-3 hover:bg-v2-surface-2"
                          : "text-v2-text hover:bg-v2-surface-2"
                  }`}
                >
                  {y}
                </button>
              );
            })}
          </div>
          {value !== thisYear && (
            <button
              type="button"
              onClick={() => {
                onChange(thisYear);
                setOpen(false);
              }}
              className="mt-2 h-8 w-full rounded-v2-md text-v2-small font-medium text-v2-brand-text hover:bg-v2-brand-bg"
            >
              {t("Joriy yilga qaytish")}
            </button>
          )}
        </div>
      </FloatingPanel>
    </>
  );
}

/** «Oy: Butun yil ⌄» — bitta oyga toraytirish (eski MonthPicker o'rnida). `null` — butun yil. */
export function FinMonthSelect({ value, onChange }: { value: number | null; onChange: (m: number | null) => void }) {
  const { t, months } = useT();
  return (
    <V2Select
      variant="value"
      label={t("Oy")}
      value={value ? String(value) : ""}
      onChange={(v) => onChange(v ? Number(v) : null)}
      options={[{ value: "", label: "Butun yil" }, ...months.map((m, i) => ({ value: String(i + 1), label: m }))]}
      emptyLabel="Butun yil"
      searchable={false}
      clearable={false}
    />
  );
}

/* ───────────────────────── O'zgarish belgisi ───────────────────────── */

/**
 * O'q + foiz (bitta kasr — eski kartadagidek), rangi: yaxshi tomonga `success`, yomoniga
 * `danger` (chiqim ko'paysa — qizil, Moliya analitikasidagidek); 0 — kulrang chiziqcha.
 */
export function FinDelta({ value, goodUp, vs }: { value: number | null; goodUp: boolean; vs: string }) {
  if (value === null) return null;
  const flat = Math.abs(value) < 0.05;
  const good = flat ? null : value > 0 === goodUp;
  const Icon = flat ? Minus : value > 0 ? ArrowUp : ArrowDown;
  const tone = good === null ? "text-v2-text-2" : good ? "text-v2-success" : "text-v2-danger";
  return (
    <span className="inline-flex flex-wrap items-center gap-x-1.5">
      <span className={`inline-flex items-center gap-0.5 font-semibold tabular-nums ${tone}`}>
        <Icon className="size-3.5" strokeWidth={2.25} aria-hidden />
        {Math.abs(value).toFixed(1)}%
      </span>
      <span className="text-v2-text-2">{vs}</span>
    </span>
  );
}

/* ───────────────────────── Ulush qatorlari ───────────────────────── */

/**
 * Taqsimot (eski BreakdownBars o'rnida): katta summadan kichigiga, har qatorda nom, summa,
 * ulush va ingichka chiziq. Kirim — `series-1`, chiqim — `series-2` (grafiklar bilan bir tizim).
 */
export function FinShareRows({ rows, tone, empty }: { rows: { label: string; amount: number }[]; tone: "income" | "expense"; empty: ReactNode }) {
  const { t } = useT();
  const total = rows.reduce((s, r) => s + r.amount, 0);
  if (total <= 0) {
    return <div className="mx-4 mb-4 rounded-v2-md bg-v2-surface-2 px-3 py-6 text-center text-v2-small text-v2-text-2">{empty}</div>;
  }
  const sorted = [...rows].sort((a, b) => b.amount - a.amount);
  return (
    <ul className="flex flex-col gap-3 px-4 pb-4">
      {sorted.map((r) => {
        const pct = (r.amount / total) * 100;
        return (
          <li key={r.label} className="min-w-0">
            <div className="flex items-baseline justify-between gap-3">
              <span className="min-w-0 truncate text-v2-body text-v2-text" title={t(r.label)}>
                {t(r.label)}
              </span>
              <span className="flex shrink-0 items-baseline gap-2">
                <b className="font-semibold tabular-nums text-v2-text">{finNum(r.amount)}</b>
                <span className="w-12 text-right text-v2-caption font-normal tabular-nums text-v2-text-2">{pct.toFixed(1)}%</span>
              </span>
            </div>
            <div className="mt-1.5">
              <Meter pct={pct} tone={tone === "income" ? "bg-v2-series-1" : "bg-v2-series-2"} />
            </div>
          </li>
        );
      })}
    </ul>
  );
}

/* ───────────────────────── Holatlar ───────────────────────── */

/** Jadval/ro'yxat skeleti (qatorlar). */
export function FinSkeletonRows({ rows = 5 }: { rows?: number }) {
  return (
    <div className="flex flex-col gap-3 px-4 pb-4" aria-hidden>
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex flex-col gap-1.5">
          <div className="flex justify-between gap-3">
            <span className="h-3 rounded bg-v2-skeleton" style={{ width: `${40 + ((i * 13) % 30)}%` }} />
            <span className="h-3 w-20 rounded bg-v2-skeleton" />
          </div>
          <span className="h-1.5 w-full rounded-full bg-v2-skeleton" />
        </div>
      ))}
    </div>
  );
}
