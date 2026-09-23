"use client";

import { useMemo } from "react";
import { useT } from "@/components/shared/Language";
import { uzMoney } from "@/lib/notifications";
import { durParts } from "@/lib/staffTasks";
import { toUz } from "@/lib/uzTime";

// Topshiriqlar sahifasining FORMATLASH yordamchilari — tanlangan tilda.
//
// Sana Toshkent vaqtida (toUz), prototipdagi qisqa ko'rinishda:
// "23-sen | 18:00" (inglizchada "Sep 23 | 18:00"); joriy yildan boshqa
// yil bo'lsa oxiriga yil qo'shiladi. "Hozir" tashqaridan beriladi —
// render ichida Date.now() chaqirilmaydi (react-hooks/purity).

type When = string | number | null | undefined;

const REL_KEYS = {
  min: ["{n} daqiqa qoldi", "{n} daqiqa o'tdi", "{n} daqiqa"],
  hour: ["{n} soat qoldi", "{n} soat o'tdi", "{n} soat"],
  day: ["{n} kun qoldi", "{n} kun o'tdi", "{n} kun"],
} as const;

function toMs(v: When): number {
  if (v == null || v === "") return NaN;
  return typeof v === "number" ? v : Date.parse(v);
}

export function useStaffFmt() {
  const { t, lang, months, monthsShort } = useT();
  return useMemo(() => {
    const p2 = (n: number) => String(n).padStart(2, "0");
    /** "23-sen | 18:00"; `nowMs` berilsa va yil boshqa bo'lsa — yil bilan. */
    const stamp = (v: When, nowMs?: number): string => {
      const m = toMs(v);
      if (!Number.isFinite(m)) return "—";
      const d = toUz(new Date(m));
      const mon = monthsShort[d.getMonth()] ?? "";
      const day = lang === "en" ? `${mon} ${d.getDate()}` : `${d.getDate()}-${mon.toLowerCase()}`;
      const year = nowMs !== undefined && toUz(new Date(nowMs)).getFullYear() !== d.getFullYear() ? ` ${d.getFullYear()}` : "";
      return `${day}${year} | ${p2(d.getHours())}:${p2(d.getMinutes())}`;
    };
    /** Davomiylik: "7 soat", "3 kun". */
    const dur = (delta: number): string => {
      const { n, unit } = durParts(delta);
      return t(REL_KEYS[unit][2], { n });
    };
    /** Nisbiy: "5 soat qoldi" / "2 kun o'tdi" / "hozir". */
    const rel = (v: When, nowMs: number): string => {
      const diff = toMs(v) - nowMs;
      if (!Number.isFinite(diff)) return "";
      if (Math.abs(diff) < 60_000) return t("hozir");
      const { n, unit } = durParts(diff);
      return t(REL_KEYS[unit][diff > 0 ? 0 : 1], { n });
    };
    const money = (n: number): string => t("{n} so'm", { n: uzMoney(n) });
    const num = (n: number): string => uzMoney(n);
    /** "2026-09" → "Sentyabr 2026". */
    const monthLabel = (ym: string): string => {
      const [y, mm] = ym.split("-").map(Number);
      return months[mm - 1] ? `${months[mm - 1]} ${y}` : ym;
    };
    return { t, lang, stamp, dur, rel, money, num, monthLabel };
  }, [t, lang, months, monthsShort]);
}

export type StaffFmt = ReturnType<typeof useStaffFmt>;
