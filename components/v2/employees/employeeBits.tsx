"use client";

import type { EmployeePayroll } from "@/lib/salary";
import type { TFn } from "@/components/shared/Language";

// YANGI VERSIYA — XODIM BELGILARI (ro'yxat va profil uchun umumiy, 20.10.2026).

/** «Madina Qosimjonova» → «MQ». */
export function initialsOf(name: string): string {
  return name
    .split(/\s+/)
    .map((s) => s[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

/** 1 234 567 (bo'sh joy bilan, butun so'm). */
export function fmtSum(n: number): string {
  const s = Math.round(Math.abs(n)).toLocaleString("ru-RU").replace(/,/g, " ").replace(/ /g, " ");
  return n < 0 ? `−${s}` : s;
}

/** "2026-10-01" → "01.10.2026". */
export function fmtIsoDay(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso || "");
  return m ? `${m[3]}.${m[2]}.${m[1]}` : iso;
}

/** «Oklad + 30%», «Foiz 50%», «Oklad» — Oylik chiqarish sahifasidagi yozuv. */
export function salaryTypeLabel(e: Pick<EmployeePayroll, "salaryType" | "percent">, t: TFn): string {
  if (e.salaryType === "mixed") return t("Oklad + {percent}%", { percent: e.percent });
  if (e.salaryType === "foiz") return t("Foiz {percent}%", { percent: e.percent });
  return t("Oklad");
}

/** Hisoblash usuli belgisi — `surface-2` + chegara (rasmdagi «Oklad + 30%»). */
export const SALARY_TAG = "inline-flex h-6 items-center whitespace-nowrap rounded-v2-sm border border-v2-border bg-v2-surface-2 px-1.5 text-v2-caption font-medium text-v2-text";

/** Xodim avatari — `surface-2` doira, bosh harflar. */
export function EmployeeAvatar({ name, photoUrl, size = "sm" }: { name: string; photoUrl?: string; size?: "sm" | "lg" }) {
  const cls = size === "lg" ? "size-12 text-v2-section" : "size-8 text-v2-caption";
  if (photoUrl) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={photoUrl} alt="" className={`${cls} shrink-0 rounded-full border border-v2-border object-cover`} />;
  }
  return (
    <span
      aria-hidden
      className={`${cls} inline-flex shrink-0 items-center justify-center rounded-full font-semibold ${
        size === "lg" ? "bg-v2-brand-bg text-v2-brand-text" : "border border-v2-border bg-v2-surface-2 text-v2-text-2"
      }`}
    >
      {initialsOf(name)}
    </span>
  );
}
