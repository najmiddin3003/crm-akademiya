"use client";

import type { ReactNode } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useT } from "@/components/shared/Language";
import { Pill, addDays, weekdayOf, useCabinetFmt, type Tone } from "./bits";

// O'QUVCHI KABINETI (v2) — Darslar, Natijalar va Tanga tablari bo'lishadigan
// kichik qismlar (sahifa sarlavhasi, raqamlar qatori, davomat belgisi, oy va
// hafta qadamchisi). Umumiy qurilmalar — bits.tsx; bu fayl ularning ustida.

/** Davomat holati: kabinet belgilari + bazadagi «kechikdi» (eski yozuvlarda bor). */
export type MarkKey = "keldi" | "kechikdi" | "birinchi" | "sababli" | "sababsiz";

export const MARK_TONE: Record<MarkKey, Tone> = {
  keldi: "success",
  kechikdi: "warning",
  birinchi: "info",
  sababli: "warning",
  sababsiz: "danger",
};

/** Kalendar katagi va nuqta ranglari (holat bo'yicha). */
export const MARK_CELL: Record<MarkKey, string> = {
  keldi: "bg-v2-success-bg text-v2-success",
  kechikdi: "bg-v2-warning-bg text-v2-warning",
  birinchi: "bg-v2-info-bg text-v2-info",
  sababli: "bg-v2-warning-bg text-v2-warning",
  sababsiz: "bg-v2-danger-bg text-v2-danger",
};
export const MARK_DOT: Record<MarkKey, string> = {
  keldi: "bg-v2-success",
  kechikdi: "bg-v2-warning",
  birinchi: "bg-v2-info",
  sababli: "bg-v2-warning",
  sababsiz: "bg-v2-danger",
};

/** Kalendar katagida bir kunda ikki belgi bo'lsa — «og'iri» rang beradi. */
export const MARK_WEIGHT: Record<MarkKey, number> = { keldi: 0, birinchi: 1, kechikdi: 2, sababli: 3, sababsiz: 4 };

export function isMarkKey(s: string): s is MarkKey {
  return s === "keldi" || s === "kechikdi" || s === "birinchi" || s === "sababli" || s === "sababsiz";
}

/** «Keldi» — darsga kelgani (kechikkan va birinchi dars ham keldi hisoblanadi). */
export function cameOf(s: MarkKey): boolean {
  return s === "keldi" || s === "kechikdi" || s === "birinchi";
}

/** Holat yorlig'i matni — t() ga beriladigan kalit. */
export function useMarkLabel() {
  const { t } = useT();
  return (s: MarkKey): string => {
    switch (s) {
      case "keldi":
        return t("Keldi");
      case "kechikdi":
        return t("Kechikdi");
      case "birinchi":
        return t("Birinchi dars");
      case "sababli":
        return t("Sababli");
      case "sababsiz":
        return t("Kelmadi");
    }
  };
}

/** Davomat yorlig'i: «Keldi», «Sababli · Kasal», «Kelmadi». */
export function MarkPill({ mark, reason }: { mark: MarkKey; reason?: string | null }) {
  const { t } = useT();
  const label = useMarkLabel();
  return (
    <Pill tone={MARK_TONE[mark]} dot>
      {label(mark)}
      {mark === "sababli" && reason ? <span className="max-w-[9rem] truncate opacity-80">· {t(reason)}</span> : null}
    </Pill>
  );
}

/** Tab sarlavhasi — «To'lovlar» rasmidagi kabi: nom + kulrang izoh. */
export function PageHead({ title, sub, right }: { title: ReactNode; sub?: ReactNode; right?: ReactNode }) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-x-4 gap-y-2">
      <div className="min-w-0">
        <h1 className="text-v2-page text-v2-text">{title}</h1>
        {sub ? <p className="mt-0.5 text-v2-small text-v2-text-3">{sub}</p> : null}
      </div>
      {right}
    </header>
  );
}

/**
 * Raqamlar qatori («To'lovlar» tepasidagi uch katakli karta). Telefonda ham
 * yonma-yon (3 tasi — uch ustun, 4 tasi — 2×2): ustma-ust qo'yilsa birinchi
 * ekranning yarmini egallab oladi.
 */
export function StatStrip({ items }: { items: { label: ReactNode; value: ReactNode; sub?: ReactNode; key: string }[] }) {
  const cols = items.length === 3 ? "grid-cols-3" : items.length >= 4 ? "grid-cols-2 lg:grid-cols-4" : "grid-cols-2";
  return (
    <section className="overflow-hidden rounded-v2-lg border border-v2-border bg-v2-surface shadow-v2-sm">
      <div className={`grid ${cols} gap-px bg-v2-border`}>
        {items.map((it) => (
          <div key={it.key} className="min-w-0 bg-v2-surface px-3 py-3 sm:px-5 sm:py-4">
            <div className="truncate text-v2-caption text-v2-text-3">{it.label}</div>
            <div className="mt-1 truncate text-lg font-semibold leading-6 tabular-nums text-v2-text sm:text-[1.375rem] sm:leading-7">{it.value}</div>
            {it.sub ? <div className="mt-0.5 line-clamp-2 text-v2-caption font-normal text-v2-text-3">{it.sub}</div> : null}
          </div>
        ))}
      </div>
    </section>
  );
}

/**
 * «Ingliz tili · 5-oktabr» — bo'laklar butunicha ko'chadi (tor katakda «5-»
 * va «oktabr» ikki qatorga bo'linib qolmasin). Ajratgich oldingi bo'lakka yopishadi.
 */
export function Pieces({ items }: { items: (string | null | undefined | false)[] }) {
  const list = items.filter((x): x is string => !!x);
  return (
    <>
      {list.map((p, i) => (
        <span key={i}>
          <span className="whitespace-nowrap">
            {p}
            {i < list.length - 1 ? " ·" : ""}
          </span>
          {i < list.length - 1 ? " " : ""}
        </span>
      ))}
    </>
  );
}

const stepBtn =
  "inline-flex w-8 shrink-0 items-center justify-center text-v2-text-2 transition-colors hover:bg-v2-surface-2 hover:text-v2-text focus-visible:shadow-[inset_0_0_0_2px_var(--v2-brand)] focus-visible:outline-none disabled:pointer-events-none disabled:opacity-35";

/**
 * «‹ Oktabr ›» — FAQAT berilgan oylar orasida yuradi (davomati bor oylar).
 * V2MonthNav ixtiyoriy oyga o'tkazadi; bu yerda bo'sh oyga o'tish ma'nosiz.
 */
export function MonthStepper({ months, value, onChange, thisYear }: { months: string[]; value: string; onChange: (m: string) => void; thisYear: string }) {
  const { t } = useT();
  const fmt = useCabinetFmt();
  const i = months.indexOf(value);
  const prev = i > 0 ? months[i - 1] : null;
  const next = i >= 0 && i < months.length - 1 ? months[i + 1] : null;
  const year = value.slice(0, 4);
  return (
    <div className="inline-flex h-8 shrink-0 items-stretch overflow-hidden rounded-v2-md border border-v2-border-strong bg-v2-surface">
      <button type="button" disabled={!prev} onClick={() => prev && onChange(prev)} aria-label={t("Oldingi oy")} title={t("Oldingi oy")} className={stepBtn}>
        <ChevronLeft className="size-4" strokeWidth={1.75} aria-hidden />
      </button>
      <span className="inline-flex min-w-[6.5rem] items-center justify-center px-1.5 text-v2-small font-semibold tabular-nums text-v2-text" aria-live="polite">
        {fmt.monthName(value)}
        {year !== thisYear ? ` ${year}` : ""}
      </span>
      <button type="button" disabled={!next} onClick={() => next && onChange(next)} aria-label={t("Keyingi oy")} title={t("Keyingi oy")} className={stepBtn}>
        <ChevronRight className="size-4" strokeWidth={1.75} aria-hidden />
      </button>
    </div>
  );
}

/** Haftaning dushanbasi. */
export function mondayOf(iso: string): string {
  return addDays(iso, -((weekdayOf(iso) + 6) % 7));
}

/** «12–18-oktabr» / «28-sentabr – 4-oktabr» (en: «October 12–18»). */
export function useWeekRange() {
  const { lang } = useT();
  const fmt = useCabinetFmt();
  return (start: string, end: string): string => {
    const sameMonth = start.slice(0, 7) === end.slice(0, 7);
    const d1 = Number(start.slice(8, 10));
    const d2 = Number(end.slice(8, 10));
    if (!sameMonth) return `${fmt.dayMonth(start)} – ${fmt.dayMonth(end)}`;
    return lang === "en" ? `${fmt.dayMonth(start)}–${d2}` : `${d1}–${fmt.dayMonth(end)}`;
  };
}

/** «14.10.2026» yoki «2026-10-14» → ISO; tanilmasa null. */
export function parseDeadline(s: string): string | null {
  const v = (s || "").trim();
  let m = v.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = v.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})/);
  if (m) return `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  return null;
}

/** Ball/foiz: butun bo'lsa butun, aks holda bitta kasr («77.5»). */
export function fmtScore(n: number): string {
  if (!Number.isFinite(n)) return "0";
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
}
