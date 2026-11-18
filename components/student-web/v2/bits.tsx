"use client";

import type { ReactNode } from "react";
import { ArrowRight } from "lucide-react";
import { useT } from "@/components/shared/Language";
import { fanOf } from "@/components/v2/ui/fan";
import { WEEKDAYS_FULL } from "@/lib/i18n";
import type { StudentMe } from "@/components/student-web/types";
import type { StudentCabinet } from "@/lib/studentCabinetTypes";

// O'QUVCHI KABINETI (v2) — tablar BO'LISHADIGAN kichik qurilmalar. Har tab o'z
// faylida (AsosiyTab, TolovlarTab, DarslarTab, NatijalarTab, TangaTab), qobiq —
// CabinetV2.tsx. Ranglar faqat v2 tokenlari (design/v2/tokens.css), hex YO'Q.

export type CabinetTab = "asosiy" | "darslar" | "tolovlar" | "natijalar" | "tanga";

/** Har bir tab komponentining props'i. */
export interface CabinetTabProps {
  /** Butun /api/student-web/me javobi (eski maydonlar: profil, davomat, imtihonlar, vazifalar). */
  me: StudentMe;
  /** Yangi kabinet ma'lumoti (me.cabinet, null emasligi qobiqda tekshirilgan). */
  cab: StudentCabinet;
  /** Boshqa tabga o'tish («To'lovlar →» havolalari). */
  go: (tab: CabinetTab) => void;
  /** Telegram initData — Tanga tabi (StudentGame) o'z API'siga shu bilan kiradi. */
  initData: string;
  /** 44-qism: ichki sahifani ochish (Asosiy → «Taklif qilish», «Yangiliklar»). */
  open?: (page: "taklif" | "yangiliklar") => void;
}

/** «1 250 000» — ICU sozlamalariga bog'liq bo'lmagan guruhlash (manfiy — «−»). */
export function fmtSom(n: number): string {
  const sign = n < 0 ? "−" : "";
  const digits = String(Math.round(Math.abs(n)));
  let out = "";
  for (let i = 0; i < digits.length; i++) {
    if (i > 0 && (digits.length - i) % 3 === 0) out += " ";
    out += digits[i];
  }
  return `${sign}${out}`;
}

/** «Diyora Rahimova» → «DR». */
export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return (parts.slice(0, 2).map((p) => p[0]).join("") || "?").toUpperCase();
}

/** O'zbekcha oy nomlari kichik harfda — «12-oktabr» (dizayndagi imlo). */
const UZ_MONTHS_LOWER = ["yanvar", "fevral", "mart", "aprel", "may", "iyun", "iyul", "avgust", "sentabr", "oktabr", "noyabr", "dekabr"];
/** Dushanbadan: lib/i18n.ts → WEEKDAYS_FULL tartibi. */
const MON_FIRST = (jsDay: number) => (jsDay + 6) % 7;

function partsOf(iso: string): { y: number; m: number; d: number } | null {
  const [y, m, d] = (iso || "").split("-").map(Number);
  return y && m ? { y, m, d: d || 1 } : null;
}

/** ISO kunning hafta kuni (0=Yakshanba), vaqt mintaqasiga bog'liq emas. */
export function weekdayOf(iso: string): number {
  const p = partsOf(iso);
  return p ? new Date(Date.UTC(p.y, p.m - 1, p.d)).getUTCDay() : 0;
}

/** ISO kunga n kun qo'shadi. */
export function addDays(iso: string, n: number): string {
  const p = partsOf(iso);
  if (!p) return iso;
  const d = new Date(Date.UTC(p.y, p.m - 1, p.d + n));
  return d.toISOString().slice(0, 10);
}

/** Sana/oy yozuvlari joriy tilda. */
export function useCabinetFmt() {
  const { lang, months, weekdaysShort } = useT();
  const monthLower = (m1: number) => (lang === "uz" ? UZ_MONTHS_LOWER[m1 - 1] : (months[m1 - 1] ?? "").toLowerCase());
  return {
    /** «12-oktabr» (en: «October 12»). */
    dayMonth(iso: string): string {
      const p = partsOf(iso);
      if (!p) return iso;
      return lang === "en" ? `${months[p.m - 1]} ${p.d}` : `${p.d}-${monthLower(p.m)}`;
    },
    /** «Dushanba». */
    weekdayFull(iso: string): string {
      return WEEKDAYS_FULL[lang]?.[MON_FIRST(weekdayOf(iso))] ?? "";
    },
    /** «Du». */
    weekdayShort(iso: string): string {
      return weekdaysShort[weekdayOf(iso)] ?? "";
    },
    /** JS getDay() raqamidan «Du». */
    weekdayShortOf(jsDay: number): string {
      return weekdaysShort[jsDay] ?? "";
    },
    /** «2026-10» → «Oktabr» (bosh harf). */
    monthName(ym: string): string {
      const p = partsOf(ym);
      if (!p) return ym;
      const s = monthLower(p.m);
      return s.charAt(0).toUpperCase() + s.slice(1);
    },
    /** «2026-10» → «oktabr». */
    monthLower(ym: string): string {
      const p = partsOf(ym);
      return p ? monthLower(p.m) : ym;
    },
  };
}

/** «16:00–18:00»; biri yo'q bo'lsa bori. */
export function timeRange(start: string, end: string): string {
  if (start && end) return `${start}–${end}`;
  return start || end || "";
}

/** Kabinet kartasi. */
export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <section className={`rounded-v2-lg border border-v2-border bg-v2-surface p-4 shadow-v2-sm sm:p-5 ${className}`}>
      {children}
    </section>
  );
}

/** Karta sarlavhasi: chapda nom (+ izoh), o'ngda «Darslar →» kabi havola. */
export function CardHead({
  title,
  sub,
  action,
  onAction,
  icon,
}: {
  title: ReactNode;
  sub?: ReactNode;
  action?: string;
  onAction?: () => void;
  icon?: ReactNode;
}) {
  return (
    <div className="mb-3 flex items-center justify-between gap-3">
      <div className="flex min-w-0 items-center gap-2">
        {icon}
        <h2 className="truncate text-v2-body font-semibold text-v2-text">{title}</h2>
        {sub ? <span className="truncate text-v2-small text-v2-text-3">{sub}</span> : null}
      </div>
      {action && onAction ? (
        <button
          type="button"
          onClick={onAction}
          className="inline-flex shrink-0 items-center gap-1 rounded-v2-sm text-v2-small font-medium text-v2-brand-text hover:underline focus-visible:outline-none focus-visible:shadow-v2-focus"
        >
          {action}
          <ArrowRight className="size-3.5" strokeWidth={1.75} aria-hidden />
        </button>
      ) : null}
    </div>
  );
}

const FAN_DOT: Record<string, string> = {
  ingliz: "bg-v2-fan-ingliz",
  ona: "bg-v2-fan-ona",
  matem: "bg-v2-fan-matem",
  rus: "bg-v2-fan-rus",
  arab: "bg-v2-fan-arab",
  bio: "bg-v2-fan-bio",
  tarix: "bg-v2-fan-tarix",
  boshqa: "bg-v2-fan-boshqa",
};

/** Fan rangidagi nuqta (guruh nomi oldida). */
export function FanDot({ course, className = "size-2" }: { course: string; className?: string }) {
  return <span aria-hidden className={`inline-block shrink-0 rounded-full ${FAN_DOT[fanOf(course)]} ${className}`} />;
}

export type Tone = "success" | "warning" | "danger" | "info" | "brand" | "neutral";

const TONE: Record<Tone, string> = {
  success: "bg-v2-success-bg text-v2-success",
  warning: "bg-v2-warning-bg text-v2-warning",
  danger: "bg-v2-danger-bg text-v2-danger",
  info: "bg-v2-info-bg text-v2-info",
  brand: "bg-v2-brand-bg text-v2-brand-text",
  neutral: "bg-v2-surface-2 text-v2-text-2",
};

/** Kichik holat yorlig'i («Keldi», «Ertaga», «joriy»). */
export function Pill({ tone, children, dot = false }: { tone: Tone; children: ReactNode; dot?: boolean }) {
  return (
    <span className={`inline-flex shrink-0 items-center gap-1 rounded-v2-full px-2 py-0.5 text-v2-caption ${TONE[tone]}`}>
      {dot ? <span aria-hidden className="size-1.5 rounded-full bg-current" /> : null}
      {children}
    </span>
  );
}

/** Ingichka chiziqli ko'rsatkich (davomat, natija, referal). */
export function Bar({ value, tone = "brand" }: { value: number; tone?: "brand" | "warning" | "success" | "danger" }) {
  const fill = { brand: "bg-v2-brand", warning: "bg-v2-warning", success: "bg-v2-success", danger: "bg-v2-danger" }[tone];
  const w = Math.max(0, Math.min(100, value));
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-v2-full bg-v2-track" role="presentation">
      <div className={`h-full rounded-v2-full ${fill}`} style={{ width: `${w}%` }} />
    </div>
  );
}

/** Bo'sh holat matni. */
export function Empty({ children }: { children: ReactNode }) {
  return <p className="py-6 text-center text-v2-small text-v2-text-3">{children}</p>;
}
