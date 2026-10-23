"use client";

import { useMemo, type KeyboardEvent, type ReactNode } from "react";
import { Check, CircleAlert, Clock3, Minus, X } from "lucide-react";
import { useT } from "@/components/shared/Language";
import { roomLabel, timeLabel } from "@/components/v2/ui/groupStatus";
import { MONTHS, WEEKDAYS_FULL } from "@/lib/i18n";
import type { AttendanceStatus } from "@/lib/attendance";
import { markCame, type ProfileGroup } from "@/lib/pupilProfile";
import type { PupilStatus } from "@/lib/pupilsData";
import { isoToDate, type CellState } from "./profileLedger";

// YANGI VERSIYA — O'QUVCHI SAHIFASINING KICHIK BO'LAKLARI (rasmlar «O'quvchi sahifasi ·
// Umumiy / To'lovlar / Davomat», «Yangi o'quvchi · Bo'sh holatlar», 23.10.2026):
// sana yozuvlari, holat belgilari, KPI katagi, kartochka, segment.
// Summa — employeeBits.fmtSum, bosh harflar — employeeBits.initialsOf (bitta manba).

/* ── Klasslar ─────────────────────────────────────────────────────── */

/** «Batafsil →», «Tahrirlash», «Qo'shish» — brend rangli matnli tugma. */
export const linkBtn =
  "inline-flex shrink-0 items-center gap-1 rounded-v2-sm text-v2-small font-medium text-v2-brand-text underline-offset-2 hover:underline focus-visible:outline-none focus-visible:shadow-v2-focus";
/** Kartochka ichidagi kichik ikkinchi darajali tugma (32 px): «Guruhga qo'shish», «Ko'chirish». */
export const secondarySm =
  "inline-flex h-8 shrink-0 items-center gap-1.5 rounded-v2-md border border-v2-border-strong bg-v2-surface px-2.5 text-v2-small font-medium text-v2-text transition-colors hover:bg-v2-surface-2 focus-visible:outline-none focus-visible:shadow-v2-focus disabled:cursor-not-allowed disabled:opacity-50";
/** Chegarasiz ikonka tugma (32 px) — qatordagi «⋯». */
export const ghostIcon =
  "inline-flex size-8 shrink-0 items-center justify-center rounded-v2-md text-v2-text-2 transition-colors hover:bg-v2-surface-2 hover:text-v2-text focus-visible:outline-none focus-visible:shadow-v2-focus";
/** Chegarali ikonka tugma (32 px) — ota-ona qatoridagi qo'ng'iroq. */
export const borderIcon = `${ghostIcon} border border-v2-border-strong bg-v2-surface`;

/* ── Matn yordamchilari ───────────────────────────────────────────── */

/** Telefon: «912345678» → «91 234 56 78»; qo'ng'iroq uchun «+998912345678», nusxa uchun «+998 91 234 56 78». */
export function phoneParts(raw: string): { show: string; tel: string; copy: string } | null {
  const d = (raw || "").replace(/\D/g, "");
  const local = d.length === 12 && d.startsWith("998") ? d.slice(3) : d;
  if (local.length !== 9) return raw.trim() ? { show: raw.trim(), tel: raw.replace(/\s/g, ""), copy: raw.trim() } : null;
  const show = `${local.slice(0, 2)} ${local.slice(2, 5)} ${local.slice(5, 7)} ${local.slice(7)}`;
  return { show, tel: `+998${local}`, copy: `+998 ${show}` };
}

/** "YYYY-MM-DD" yoki "DD.MM.YYYY[ | HH:MM]" → "YYYY-MM-DD"; o'qilmasa "". */
export function toIso(s: string | null | undefined): string {
  const v = (s || "").trim();
  let m = /^(\d{4})-(\d{2})-(\d{2})/.exec(v);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = /^(\d{2})\.(\d{2})\.(\d{4})/.exec(v);
  if (m) return `${m[3]}-${m[2]}-${m[1]}`;
  return "";
}

/** "DD.MM.YYYY | HH:MM" (yoki "… HH:MM") dan soat; bo'lmasa "". */
export function timeOf(s: string | null | undefined): string {
  const m = /(\d{1,2}):(\d{2})(?::\d{2})?\s*$/.exec((s || "").trim());
  return m ? `${m[1].padStart(2, "0")}:${m[2]}` : "";
}

/** To'liq yosh (tug'ilgan kun ISO, bugun ISO); o'qilmasa null. */
export function ageOf(birthIso: string, asOf: string): number | null {
  if (!birthIso || !asOf) return null;
  const [by, bm, bd] = birthIso.split("-").map(Number);
  const [y, m, d] = asOf.split("-").map(Number);
  if (!by || !y) return null;
  const age = y - by - (m < bm || (m === bm && d < bd) ? 1 : 0);
  return age >= 0 && age < 120 ? age : null;
}

/** «Ingliz tili · 2-bosqich» — kurs va bosqich (rasmdagidek); kurs yo'q — guruh yorlig'i. */
export function groupTitle(g: Pick<ProfileGroup, "course" | "level" | "label" | "name">): string {
  const course = g.course.trim();
  if (!course) return g.label || g.name || "—";
  return [course, g.level.trim()].filter(Boolean).join(" · ");
}

/** «Nilufar Hamdamova · 205-xona · Toq kunlar 16:00–18:00». */
export function groupMeta(g: Pick<ProfileGroup, "teacher" | "room" | "day" | "time">): string {
  return [g.teacher.trim(), roomLabel(g.room), [g.day.trim(), timeLabel(g.time)].filter(Boolean).join(" ")].filter(Boolean).join(" · ");
}

/** Kalendar chipi: «Matematika» → «Matem.», «Ingliz tili» → «Ingliz». */
export function courseShort(g: Pick<ProfileGroup, "course" | "name">): string {
  const first = (g.course.trim() || g.name.trim()).split(/\s+/)[0] ?? "";
  return first.length > 6 ? `${first.slice(0, 5)}.` : first;
}

export function useProfileFmt() {
  const { lang } = useT();
  return useMemo(() => {
    const months = MONTHS[lang];
    const thisYear = new Date().getFullYear();
    const monthName = (mk: string) => months[Number(mk.slice(5, 7)) - 1] ?? mk;
    /** Gap ichida: «oktyabr» (inglizchada bosh harf qoladi). */
    const monthLower = (mk: string) => (lang === "en" ? monthName(mk) : monthName(mk).toLowerCase());
    /** Qisqa: «Iyun», «Iyul», «Avg», «Sen», «Okt», «Noy» (rasmdagidek: 4 harfgacha — to'liq). */
    const monthShort = (mk: string) => {
      const n = monthName(mk);
      return n.length <= 4 ? n : n.slice(0, 3);
    };
    /** «6-oktyabr» (boshqa yil — «6-oktyabr 2025»); inglizchada «October 6». */
    const dayMonth = (iso: string) => {
      if (!iso) return "";
      const d = isoToDate(iso);
      const mon = months[d.getMonth()] ?? "";
      const year = d.getFullYear() !== thisYear ? ` ${d.getFullYear()}` : "";
      return lang === "en" ? `${mon} ${d.getDate()}${year}` : `${d.getDate()}-${mon.toLowerCase()}${year}`;
    };
    /** «6-oktyabr | 18:07». */
    const stamp = (iso: string, hm?: string) => (hm ? `${dayMonth(iso)} | ${hm}` : dayMonth(iso));
    const weekday = (iso: string) => {
      const w = WEEKDAYS_FULL[lang][(isoToDate(iso).getDay() + 6) % 7] ?? "";
      return lang === "en" ? w : w.toLowerCase();
    };
    const ddmmyyyy = (iso: string) => (iso ? `${iso.slice(8, 10)}.${iso.slice(5, 7)}.${iso.slice(0, 4)}` : "");
    return { lang, monthName, monthLower, monthShort, dayMonth, stamp, weekday, ddmmyyyy };
  }, [lang]);
}

export type ProfileFmt = ReturnType<typeof useProfileFmt>;

/* ── Belgilar ─────────────────────────────────────────────────────── */

export interface Tone {
  label: string;
  badge: string;
  dot: string;
}

/** O'quvchi holati — tezkor paneldagi qoida (SAVOLLAR 36): faol, hali to'lamagan → «Yangi o'quvchi». */
export const PUPIL_TONE: Record<"new" | PupilStatus, Tone> = {
  new: { label: "Yangi o'quvchi", badge: "bg-v2-info-bg text-v2-info", dot: "bg-v2-info" },
  Aktiv: { label: "Aktiv", badge: "bg-v2-success-bg text-v2-success", dot: "bg-v2-success" },
  Muzlatilgan: { label: "Muzlatilgan", badge: "bg-v2-info-bg text-v2-info", dot: "bg-v2-info" },
  Arxiv: { label: "Arxiv", badge: "bg-v2-surface-2 text-v2-text-2", dot: "bg-v2-text-3" },
};

export function pupilTone(status: PupilStatus, isNew: boolean): Tone {
  if (status === "Aktiv" && isNew) return PUPIL_TONE.new;
  return PUPIL_TONE[status] ?? PUPIL_TONE.Aktiv;
}

/** Holat belgisi: och fon + nuqta + yozuv (DESIGN.md → «Holat belgilari»). */
export function ToneBadge({ tone, children, title }: { tone: Pick<Tone, "badge" | "dot">; children: ReactNode; title?: string }) {
  return (
    <span title={title} className={`inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-v2-full px-2 py-0.5 text-v2-caption font-medium ${tone.badge}`}>
      <span className={`size-1.5 rounded-full ${tone.dot}`} aria-hidden />
      {children}
    </span>
  );
}

/** To'lov holati belgisi (rasm: ✓ to'langan, ◐ qisman, ⓘ qarz, ◷ kelgusi oy, — guruhda emas). */
export function PayStateIcon({ state, size = "md" }: { state: CellState; size?: "sm" | "md" }) {
  const box = size === "sm" ? "size-4" : "size-5";
  const icon = size === "sm" ? "size-3" : "size-3.5";
  if (state === "paid")
    return (
      <span className={`inline-flex ${box} shrink-0 items-center justify-center rounded-full bg-v2-success-bg text-v2-success`} aria-hidden>
        <Check className={icon} strokeWidth={2.5} />
      </span>
    );
  if (state === "partial")
    return (
      <span className={`inline-flex ${box} shrink-0 items-center justify-center rounded-full bg-v2-warning-bg`} aria-hidden>
        <span className={`${size === "sm" ? "size-2.5" : "size-3"} rounded-full border-[1.5px] border-v2-warning bg-[linear-gradient(90deg,var(--v2-warning)_50%,transparent_50%)]`} />
      </span>
    );
  if (state === "debt")
    return (
      <span className={`inline-flex ${box} shrink-0 items-center justify-center rounded-full bg-v2-danger-bg text-v2-danger`} aria-hidden>
        <CircleAlert className={icon} strokeWidth={2.25} />
      </span>
    );
  if (state === "future")
    return (
      <span className={`inline-flex ${box} shrink-0 items-center justify-center rounded-full text-v2-text-3`} aria-hidden>
        <Clock3 className={icon} strokeWidth={2} />
      </span>
    );
  return (
    <span className={`inline-flex ${box} shrink-0 items-center justify-center rounded-full text-v2-text-3`} aria-hidden>
      <Minus className={icon} strokeWidth={2} />
    </span>
  );
}

/** Davomat belgisi: keldi ✓ (yashil), kelmadi ✕ (qizil), sababli — (sariq); belgilanmagan «?»; rejada ◷. */
export function MarkIcon({ status, size = "md" }: { status: AttendanceStatus | "unmarked" | "planned"; size?: "sm" | "md" }) {
  const box = size === "sm" ? "size-5" : "size-6";
  const icon = size === "sm" ? "size-3" : "size-3.5";
  if (status === "planned")
    return (
      <span className={`inline-flex ${box} shrink-0 items-center justify-center rounded-full border border-v2-border-strong bg-v2-surface text-v2-text-2`} aria-hidden>
        <Clock3 className={icon} strokeWidth={2} />
      </span>
    );
  if (status === "unmarked")
    return (
      <span className={`inline-flex ${box} shrink-0 items-center justify-center rounded-full border border-dashed border-v2-border-strong text-[11px] font-semibold text-v2-text-3`} aria-hidden>
        ?
      </span>
    );
  if (markCame(status))
    return (
      <span className={`inline-flex ${box} shrink-0 items-center justify-center rounded-full bg-v2-success-bg text-v2-success`} aria-hidden>
        <Check className={icon} strokeWidth={2.5} />
      </span>
    );
  if (status === "sababli")
    return (
      <span className={`inline-flex ${box} shrink-0 items-center justify-center rounded-full bg-v2-warning-bg text-v2-warning`} aria-hidden>
        <Minus className={icon} strokeWidth={2.5} />
      </span>
    );
  return (
    <span className={`inline-flex ${box} shrink-0 items-center justify-center rounded-full bg-v2-danger-bg text-v2-danger`} aria-hidden>
      <X className={icon} strokeWidth={2.5} />
    </span>
  );
}

/* ── Kartochkalar ─────────────────────────────────────────────────── */

/** Ko'rsatkichlar qatori — bitta kartochkada, orasi 1 px chiziq (Topshiriqlar kartalari qolipi). */
export function KpiStrip({ children, cols = 3, label }: { children: ReactNode; cols?: 3 | 4; label?: string }) {
  return (
    <section
      aria-label={label}
      className={`grid grid-cols-1 gap-px overflow-hidden rounded-v2-lg border border-v2-border bg-v2-border shadow-v2-sm ${
        cols === 4 ? "min-[30rem]:grid-cols-2 min-[64rem]:grid-cols-4" : "min-[40rem]:grid-cols-3"
      }`}
    >
      {children}
    </section>
  );
}

export function KpiCell({
  icon,
  label,
  value,
  valueCls = "text-v2-text",
  sub,
  children,
  footer,
}: {
  icon?: ReactNode;
  label: ReactNode;
  value: ReactNode;
  valueCls?: string;
  sub?: ReactNode;
  /** Qiymat va izoh orasida (davomat chizig'i). */
  children?: ReactNode;
  /** Izohdan keyin (Qarzdorlik → «SMS eslatma yuborish»). */
  footer?: ReactNode;
}) {
  return (
    <div className="min-w-0 bg-v2-surface px-4 py-3.5">
      <div className="flex min-w-0 items-center gap-1.5 text-v2-small text-v2-text-2">
        {icon}
        <span className="truncate">{label}</span>
      </div>
      <div className={`mt-1 truncate text-[1.375rem] font-semibold leading-7 tabular-nums ${valueCls}`}>{value}</div>
      {children}
      {sub && <div className="mt-0.5 truncate text-v2-caption font-normal text-v2-text-2">{sub}</div>}
      {footer}
    </div>
  );
}

/** Davomat chizig'i: 85%+ — yashil, 60–84% — sariq (rasmdagi 78%), pastroq — qizil. */
export function PctBar({ pct, className = "" }: { pct: number; className?: string }) {
  const fill = pct >= 85 ? "bg-v2-success" : pct >= 60 ? "bg-v2-warning" : "bg-v2-danger";
  return (
    <span className={`block h-1.5 overflow-hidden rounded-v2-full bg-v2-hover ${className}`} aria-hidden>
      <span className={`block h-full rounded-v2-full ${fill}`} style={{ width: `${Math.min(100, Math.max(0, pct))}%` }} />
    </span>
  );
}

/** Kartochka: sarlavha + (soni) + o'ngda amal. `flush` — tana chekinishsiz (jadval, ro'yxat). */
export function Card({
  title,
  count,
  sub,
  action,
  children,
  className = "",
  flush = false,
  labelId,
}: {
  title: ReactNode;
  count?: ReactNode;
  sub?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  flush?: boolean;
  labelId?: string;
}) {
  return (
    <section aria-labelledby={labelId} className={`min-w-0 rounded-v2-lg border border-v2-border bg-v2-surface shadow-v2-sm ${className}`}>
      <div className={`flex flex-wrap items-center justify-between gap-x-3 gap-y-2 px-4 ${flush ? "py-3" : "pt-4"}`}>
        <div className="min-w-0">
          <h2 id={labelId} className="flex min-w-0 items-baseline gap-2 text-v2-section text-v2-text">
            <span className="truncate">{title}</span>
            {count != null && <span className="shrink-0 text-v2-small font-normal text-v2-text-3">{count}</span>}
          </h2>
          {sub && <p className="mt-0.5 text-v2-caption font-normal text-v2-text-2">{sub}</p>}
        </div>
        {action}
      </div>
      <div className={flush ? "" : "px-4 pb-4 pt-3"}>{children}</div>
    </section>
  );
}

/** Bo'sh holat (kartochka ichida): ikonka (oq kvadratda) + sarlavha + izoh + amal. */
export function EmptyBlock({ icon, title, text, action }: { icon: ReactNode; title: ReactNode; text?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2 px-4 py-5 text-center">
      <span className="flex size-10 items-center justify-center rounded-v2-md border border-v2-border bg-v2-surface text-v2-text-2 shadow-v2-sm">{icon}</span>
      <div className="text-v2-body font-semibold text-v2-text">{title}</div>
      {text && <p className="max-w-sm text-v2-small text-v2-text-2">{text}</p>}
      {action && <div className="mt-1">{action}</div>}
    </div>
  );
}

/** Ixcham segment (kartochka sarlavhasida): «Hammasi | Ingliz tili | Matematika». */
export function SegTabs<T extends string>({ value, onChange, options, label }: { value: T; onChange: (v: T) => void; options: { value: T; label: string }[]; label: string }) {
  const onKey = (e: KeyboardEvent<HTMLButtonElement>) => {
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
    e.preventDefault();
    const at = options.findIndex((o) => o.value === value);
    const next = options[(at + (e.key === "ArrowRight" ? 1 : options.length - 1)) % options.length];
    if (!next) return;
    onChange(next.value);
    const group = e.currentTarget.parentElement;
    requestAnimationFrame(() => group?.querySelector<HTMLButtonElement>('[aria-checked="true"]')?.focus());
  };
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex h-8 max-w-full items-center gap-0.5 overflow-x-auto rounded-v2-md border border-v2-border bg-v2-surface-2 p-0.5">
      {options.map((o) => {
        const on = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={on}
            tabIndex={on ? 0 : -1}
            onClick={() => onChange(o.value)}
            onKeyDown={onKey}
            className={`h-full shrink-0 whitespace-nowrap rounded-[6px] px-2.5 text-v2-small font-medium transition-colors focus-visible:outline-none focus-visible:shadow-v2-focus ${
              on ? "bg-v2-surface text-v2-text shadow-v2-sm" : "text-v2-text-2 hover:text-v2-text"
            }`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
