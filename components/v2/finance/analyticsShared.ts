"use client";

import type { Lang } from "@/lib/i18n";

// YANGI VERSIYA — MOLIYA ANALITIKASI: sahifa, grafik, hisobot oynasi uchun umumiy
// ko'rinish yordamchilari (hisoblar — lib/financeAnalytics.ts).

/** «36 444 000» (bo'sh joy bilan, butun so'm). */
export function fmtSom(n: number): string {
  const s = Math.round(Math.abs(n)).toLocaleString("ru-RU").replace(/,/g, " ").replace(/ /g, " ");
  return n < 0 ? `−${s}` : s;
}

/** Million, bitta kasr: «52,7» (inglizchada «52.7»); manfiy — «−3,2». */
export function fmtMln(n: number, lang: Lang): string {
  const v = Math.abs(n) / 1_000_000;
  const digits = v !== 0 && v < 0.1 ? 2 : 1;
  const s = v.toFixed(digits);
  const out = lang === "en" ? s : s.replace(".", ",");
  return n < 0 ? `−${out}` : out;
}

/** Foiz — butun son: «24%». */
export function fmtPct(part: number, whole: number): string {
  if (!whole) return "0%";
  return `${Math.round((part / whole) * 100)}%`;
}

/**
 * Grafik o'qi uchun «chiroyli» qadam (1 / 2 / 2,5 / 5 × 10ⁿ): eng katta qiymat ustiga
 * ~8% joy (ustun tepasidagi raqam sig'sin) va 4 tagacha oraliq — dizayndagi
 * 52,7 mln → 0 · 20 · 40 · 60 mln.
 */
export function niceAxis(max: number, maxSteps = 4): { top: number; step: number } {
  // Ma'lumot yo'q — bo'sh o'q 0 · 1 · 2 · 3 mln (yozuvlar «0,00 mln» bo'lib qolmasin).
  if (!(max > 0)) return { top: 3_000_000, step: 1_000_000 };
  const target = max * 1.08;
  const mag = 10 ** Math.floor(Math.log10(target / maxSteps));
  for (const k of [1, 2, 2.5, 5, 10, 20, 25, 50]) {
    const step = k * mag;
    const n = Math.ceil(target / step);
    if (n <= maxSteps) return { top: n * step, step };
  }
  return { top: target, step: target / maxSteps };
}

/** Oy qisqa nomi: qisqa so'z to'liq («May», «Iyun»), uzuni qisqartma («Avg», «Sen»). */
export function monthTick(i: number, months: string[], monthsShort: string[]): string {
  const full = months[i] ?? "";
  return full.length <= 5 ? full : (monthsShort[i] ?? full);
}
