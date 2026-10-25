// HISOBOTLAR (15-qism) — umumiy formatlash va oy yordamchilari (React'siz).

import { MONTHS, type Lang } from "@/lib/i18n";

/** «3 190 000» — guruhlash oddiy bo'shliq bilan (Excel/PDF'da ham bir xil). */
export function fmtNum(v: number): string {
  const n = Math.round(v);
  return (n < 0 ? "−" : "") + Math.abs(n).toLocaleString("ru-RU").replace(/\s|,/g, " ");
}

/** «+122» / «−3» / «0». */
export function fmtSigned(v: number): string {
  const n = Math.round(v);
  return n > 0 ? `+${fmtNum(n)}` : fmtNum(n);
}

export function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

/** Mahalliy sana → "YYYY-MM-DD". */
export function isoOf(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

/** "YYYY-MM-DD" → mahalliy sana. */
export function dateOfIso(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

/** "YYYY-MM" ± n oy. */
export function shiftMonth(key: string, n: number): string {
  const [y, m] = key.split("-").map(Number);
  const d = new Date(y, m - 1 + n, 1);
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}`;
}

/** Oylar ro'yxati (ikkala chegara ham), ko'pi bilan 36 ta. */
export function monthsBetween(from: string, to: string): string[] {
  const out: string[] = [];
  for (let m = from; m <= to && out.length < 36; m = shiftMonth(m, 1)) out.push(m);
  return out;
}

export function monthStart(key: string): string {
  return `${key}-01`;
}

export function monthEnd(key: string): string {
  const [y, m] = key.split("-").map(Number);
  return `${key}-${pad2(new Date(y, m, 0).getDate())}`;
}

export interface MonthRange {
  /** "YYYY-MM" */
  from: string;
  /** "YYYY-MM" */
  to: string;
}

/** «May – Oktabr 2026», «Noyabr 2025 – Oktabr 2026», «Oktabr 2026». */
export function monthRangeLabel(r: MonthRange, lang: Lang): string {
  const name = (k: string) => MONTHS[lang][Number(k.slice(5, 7)) - 1] ?? k;
  const year = (k: string) => k.slice(0, 4);
  if (r.from === r.to) return `${name(r.to)} ${year(r.to)}`;
  if (year(r.from) === year(r.to)) return `${name(r.from)} – ${name(r.to)} ${year(r.to)}`;
  return `${name(r.from)} ${year(r.from)} – ${name(r.to)} ${year(r.to)}`;
}

/** «Abdulloh Raxmatullayev» → «Abdulloh R.» (PDF'dagi «kim tayyorlagani»). */
export function shortPersonName(full: string): string {
  const parts = full.trim().split(/\s+/).filter(Boolean);
  if (parts.length < 2) return parts[0] ?? "";
  return `${parts[0]} ${parts[1].charAt(0).toUpperCase()}.`;
}

/** «Sardor Aliyev» → «SA». */
export function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.charAt(0) ?? "") + (parts[1]?.charAt(0) ?? "")).toUpperCase() || "?";
}

/** Telefon: «998932104418» / «932104418» → «93 210 44 18». */
export function fmtPhone(raw: string): string {
  const d = String(raw || "").replace(/\D/g, "");
  const local = d.length === 12 && d.startsWith("998") ? d.slice(3) : d.length === 9 ? d : "";
  if (!local) return String(raw || "").trim();
  return `${local.slice(0, 2)} ${local.slice(2, 5)} ${local.slice(5, 7)} ${local.slice(7, 9)}`;
}

/** Fayl nomi uchun xavfsiz qism: «Kelgan va ketgan» → «Kelgan-va-ketgan». */
export function fileSafe(s: string): string {
  return s.replace(/['ʻʼ‘’`]/g, "").replace(/[^\p{L}\p{N}]+/gu, "-").replace(/^-+|-+$/g, "");
}
