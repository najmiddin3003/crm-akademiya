// YANGI VERSIYA — MOLIYA: «Kirim chiqim», «Moliya hisobotlari», «Moliya hisobotlari (P&L)»,
// «Pul oqimi» (28-qism, moliya-A) uchun HISOB (React'siz).
//
// DIQQAT: bu yerdagi har funksiya ESKI sahifadagi hisobning AYNAN nusxasi — versiyani
// almashtirgan xodim bir xil raqamni ko'rishi shart. Manbalar:
//   • components/finance/FinanceAnalyticsPage.tsx   (/finance-cashflow)
//   • components/finance/FinanceReportsPage.tsx      (/finance-reports)
//   • components/finance/PnlReportsPage.tsx          (/finance-pnl)
//   • components/finance/CashFlowStatementPage.tsx   (/finance-flow)
// Eski sahifalar o'zgartirilmadi (o'tish davrida ular asosiy). Biri o'zgarsa —
// ikkinchisi ham. Eski versiya olib tashlanganda hisob shu faylda qoladi.

import type { DateRange } from "@/components/ui/DateRangePicker";
import { BONUS_TYPES } from "@/constants/bonuses";
import { PENALTY_TYPES } from "@/constants/penalties";
import type { Bonus } from "@/lib/bonuses";
import type { MonthlyFlow } from "@/lib/cashflowStatement";
import type { Penalty } from "@/lib/penalties";
import type { PnlMonthRow } from "@/lib/pnl";

/* ───────────────────────── Umumiy ───────────────────────── */

export type Sign = "pos" | "neg" | "zero";

/** Date -> "YYYY-MM-DD" (MAHALLIY vaqt bo'yicha, toISOString kunni surib yuboradi). */
export function finIsoDay(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function finAddDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

/** Oy boshidan bugungacha (eski sahifalardagi sukut davr). */
export function finMonthToDate(): DateRange {
  const now = new Date();
  return { start: new Date(now.getFullYear(), now.getMonth(), 1), end: new Date(now.getFullYear(), now.getMonth(), now.getDate()) };
}

/* ───────────────────────── 1. Kirim chiqim (/finance-cashflow) ───────────────────────── */

export type CashflowTab = "kirim" | "chiqim" | "bonus" | "jarima";

/** /api/transactions/summary qaytaradigan qator (groupBy=category,sign). */
export interface CashflowCatRow {
  category: string;
  /** "pos" | "neg" | "zero" */
  sign: string;
  amount: number;
}

export interface CashflowSlice {
  label: string;
  value: number;
}

// "DD.MM.YYYY HH:mm" → Date (faqat kun aniqligida solishtirish uchun yetarli).
function parseCreatedAt(s: string): Date | null {
  const m = s.match(/(\d{2})\.(\d{2})\.(\d{4})/);
  return m ? new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1])) : null;
}
function inRange(d: Date | null, range: DateRange): boolean {
  if (!d) return false;
  if (range.start && d < range.start) return false;
  if (range.end) {
    const endOfDay = new Date(range.end.getFullYear(), range.end.getMonth(), range.end.getDate(), 23, 59, 59, 999);
    if (d > endOfDay) return false;
  }
  return true;
}

/**
 * Tab qatorlari — eski FinanceAnalyticsPage `rows` useMemo'si bilan aynan bir xil:
 *   • Kirim/Chiqim — faqat «Tranzaksiya turi» ro'yxatidagi turlar (ro'yxatda YO'Q
 *     kategoriya bu sahifada ko'rsatilmaydi — eski xulq); NOL summali yozuv ikkala
 *     tabga ham tushmaydi (server ishorasi pos|neg|zero);
 *   • Bonus/Jarima — sana oralig'i va kassa bo'yicha, bekor qilingan jarima hisobga olinmaydi.
 */
export function cashflowRows(
  tab: CashflowTab,
  d: {
    catRows: CashflowCatRow[];
    incomeCats: string[];
    expenseCats: string[];
    bonuses: Bonus[];
    penalties: Penalty[];
    dateRange: DateRange;
    cashboxId: number | null;
  },
): CashflowSlice[] {
  if (tab === "kirim" || tab === "chiqim") {
    const cats = tab === "kirim" ? d.incomeCats : d.expenseCats;
    const want = tab === "kirim" ? "pos" : "neg";
    const byCat = new Map<string, number>();
    for (const r of d.catRows) {
      if (r.sign !== want) continue;
      byCat.set(r.category, (byCat.get(r.category) ?? 0) + Math.abs(r.amount));
    }
    return cats.map((c) => ({ label: c, value: byCat.get(c) ?? 0 }));
  }
  if (tab === "bonus") {
    const inWindow = d.bonuses.filter((b) => inRange(parseCreatedAt(b.createdAt), d.dateRange) && (d.cashboxId == null || b.cashboxId === d.cashboxId));
    return BONUS_TYPES.map((tv) => ({
      label: tv.label,
      value: inWindow.filter((b) => b.type === tv.value).reduce((s, b) => s + b.amount, 0),
    }));
  }
  const inWindow = d.penalties.filter(
    (p) => p.status !== "cancelled" && inRange(parseCreatedAt(p.createdAt), d.dateRange) && (d.cashboxId == null || p.cashboxId === d.cashboxId),
  );
  return PENALTY_TYPES.map((tv) => ({
    label: tv.label,
    value: inWindow.filter((p) => p.type === tv.value).reduce((s, p) => s + p.amount, 0),
  }));
}

/* ───────────────────────── 2. Moliya hisobotlari (/finance-reports) ───────────────────────── */

export type DayRow = { day: string; sign: Sign; amount: number };
export type CatRow = { category: string; sign: Sign; amount: number };
export type MethodRow = { method: string; sign: Sign; amount: number };
export type SignRow = { sign: Sign; amount: number };

export interface BreakdownRow {
  label: string;
  amount: number;
}

export interface DailyPoint {
  /** "YYYY-MM-DD" */
  date: string;
  /** "DD.MM" */
  label: string;
  income: number;
  expense: number;
}

// Ro'yxatda yo'q kategoriya/to'lov usuli shu nom ostida yig'iladi. Agar aynan shu nomli
// haqiqiy tur mavjud bo'lsa — nom aniqlashtiriladi, ikki xil pul bir qatorda aralashmasin.
function otherLabel(known: string[]): string {
  return known.includes("Boshqa") ? "Boshqa (ro'yxatda yo'q)" : "Boshqa";
}

/** Kirim / chiqim / qoldiq — bitta o'tishda; amount === 0 ikkala tarafga ham qo'shilmaydi. */
export function reportTotals(rows: SignRow[]): { income: number; expense: number; net: number } {
  let income = 0;
  let expense = 0;
  for (const r of rows) {
    if (r.sign === "pos") income += r.amount;
    else if (r.sign === "neg") expense -= r.amount;
  }
  return { income, expense, net: income - expense };
}

/** Bitta ishora bo'yicha "kalit -> mutlaq summa" xaritasi. */
export function reportAbsMap(
  rows: { sign: Sign; amount: number; category?: string; method?: string }[],
  field: "category" | "method",
  positive: boolean,
): Record<string, number> {
  const map: Record<string, number> = {};
  const want = positive ? "pos" : "neg";
  for (const r of rows) {
    if (r.sign !== want) continue;
    const k = r[field];
    if (k === undefined) continue;
    map[k] = (map[k] || 0) + Math.abs(r.amount);
  }
  return map;
}

/** Ro'yxatdagi turlar avvalgi tartibda, tashqarisi oxirida bitta «Boshqa» qatorida. */
export function reportCategoryBreakdown(map: Record<string, number>, cats: string[]): BreakdownRow[] {
  const known = new Set(cats);
  const other = Object.entries(map).reduce((s, [c, v]) => (known.has(c) ? s : s + v), 0);
  const out = cats.map((c) => ({ label: c, amount: map[c] || 0 })).filter((r) => r.amount > 0);
  if (other > 0) out.push({ label: otherLabel(cats), amount: other });
  return out;
}

/** Sozlamalardan o'chirilgan to'lov turidagi pul ham taqsimotdan tushib qolmasin. */
export function reportMethodBreakdown(map: Record<string, number>, methods: { key: string; name: string }[]): BreakdownRow[] {
  const known = new Set(methods.map((m) => m.key));
  const other = Object.entries(map).reduce((s, [k, v]) => (known.has(k) ? s : s + v), 0);
  const out = methods.map((m) => ({ label: m.name, amount: map[m.key] || 0 })).filter((r) => r.amount > 0);
  if (other > 0) out.push({ label: otherLabel(methods.map((m) => m.name)), amount: other });
  return out;
}

/** Oldingi davrga nisbatan o'zgarish, %: oldingisi 0 bo'lsa — joriy 0 da null, aks holda 100. */
export function reportPctDelta(cur: number, prev: number): number | null {
  if (prev === 0) return cur === 0 ? null : 100;
  return ((cur - prev) / Math.abs(prev)) * 100;
}

/** OLDINGI davr — joriy oraliq bilan bir xil uzunlikda, undan darhol oldin. */
export function reportPrevRange(range: DateRange): { from: string; to: string; days: number } | null {
  if (!range.start || !range.end) return null;
  const days = Math.round((range.end.getTime() - range.start.getTime()) / 86400000) + 1;
  const prevEnd = finAddDays(range.start, -1);
  const prevStart = finAddDays(prevEnd, -(days - 1));
  return { from: finIsoDay(prevStart), to: finIsoDay(prevEnd), days };
}

/** Kunlik nuqtalar (oraliqning har kuni, ma'lumotsiz kun — 0). Oraliqsiz — bo'sh. */
export function reportDailyPoints(dayRows: DayRow[], range: DateRange): DailyPoint[] {
  if (!range.start || !range.end) return [];
  const days = Math.round((range.end.getTime() - range.start.getTime()) / 86400000) + 1;
  const byDay = new Map<string, { income: number; expense: number }>();
  for (const r of dayRows) {
    let b = byDay.get(r.day);
    if (!b) {
      b = { income: 0, expense: 0 };
      byDay.set(r.day, b);
    }
    if (r.sign === "pos") b.income += r.amount;
    else if (r.sign === "neg") b.expense -= r.amount;
  }
  return Array.from({ length: Math.max(days, 0) }, (_, i) => {
    const d = finAddDays(range.start as Date, i);
    const iso = finIsoDay(d);
    const b = byDay.get(iso);
    const p = (n: number) => String(n).padStart(2, "0");
    return { date: iso, label: `${p(d.getDate())}.${p(d.getMonth() + 1)}`, income: b?.income ?? 0, expense: b?.expense ?? 0 };
  });
}

/* ───────────────────────── 3. P&L (/finance-pnl) ───────────────────────── */

/** /api/transactions/summary qaytaradigan qator (groupBy=month,category,sign). */
export interface MonthCatRow {
  /** "YYYY-MM" */
  month: string;
  category: string;
  /** "pos" | "neg" | "zero" */
  sign: string;
  amount: number;
}

/**
 * 12 oy (server bo'sh oy uchun chelak qaytarmaydi). DIQQAT — «O'quvchi to'ladi» taqqoslashi
 * ATAYLAB eski sahifadagidek (katta «O»): bazada kategoriya kichik harf bilan saqlanadi va
 * «Dars bo'yicha daromad» doim 0 chiqadi. Bu mavjud xulq — eski sahifadagi izohga qarang;
 * alohida ish sifatida ko'rib chiqilsin (SAVOLLAR).
 */
export function pnlYearData(rows: MonthCatRow[]): PnlMonthRow[] {
  const out: PnlMonthRow[] = Array.from({ length: 12 }, (_, i) => ({ month: i + 1, otherIncome: 0, courseIncome: 0, otherExpense: 0 }));
  for (const r of rows) {
    const m = Number(String(r.month).slice(5, 7));
    if (!(m >= 1 && m <= 12)) continue;
    const cell = out[m - 1];
    if (r.sign === "pos") {
      if (r.category === "O'quvchi to'ladi") cell.courseIncome += r.amount;
      else cell.otherIncome += r.amount;
    } else if (r.sign === "neg") {
      cell.otherExpense -= r.amount;
    }
  }
  return out;
}

export type PnlLineKey = "income" | "course" | "otherIncome" | "expense" | "otherExpense" | "net";

/** P&L qatorlari — eski sahifadagi `rows` bilan bir xil qiymatlar (tartib — eski eksportdagidek). */
export function pnlLines(months: PnlMonthRow[]): { key: PnlLineKey; label: string; values: number[] }[] {
  const jamiDaromad = months.map((m) => m.otherIncome + m.courseIncome);
  const jamiXarajat = months.map((m) => m.otherExpense);
  return [
    { key: "income", label: "Jami daromad", values: jamiDaromad },
    { key: "course", label: "Dars bo'yicha daromad", values: months.map((m) => m.courseIncome) },
    { key: "otherIncome", label: "Boshqa daromad", values: months.map((m) => m.otherIncome) },
    { key: "expense", label: "Jami xarajat", values: jamiXarajat },
    { key: "otherExpense", label: "Boshqa xarajat", values: months.map((m) => m.otherExpense) },
    { key: "net", label: "Sof foyda", values: jamiDaromad.map((v, i) => v - jamiXarajat[i]) },
  ];
}

/* ───────────────────────── 4. Pul oqimi (/finance-flow) ───────────────────────── */

// Ro'yxatda YO'Q kategoriyalar shu ichki kalit ostida to'planadi (oddiy «Boshqa» emas —
// admin aynan shu nomli haqiqiy tur qo'shgan bo'lishi mumkin).
export const FLOW_OTHER_KEY = "__boshqa__";

/** Kategoriya kalitidan ko'rinadigan nom. */
export function flowCatLabel(key: string, cats: string[]): string {
  if (key !== FLOW_OTHER_KEY) return key;
  return cats.includes("Boshqa") ? "Boshqa (ro'yxatda yo'q)" : "Boshqa";
}

export interface FlowMonthRow {
  month: number;
  opening: number;
  kirim: number;
  chiqim: number;
  sof: number;
  closing: number;
  income: Record<string, number>;
  expense: Record<string, number>;
}

/** 12 oy × kategoriya; ro'yxatda yo'q kategoriya TASHLANMAYDI — «Boshqa» ga. */
export function flowMonthly(rows: MonthCatRow[], incomeCats: string[], expenseCats: string[]): MonthlyFlow[] {
  const knownIncome = new Set(incomeCats);
  const knownExpense = new Set(expenseCats);
  const out: MonthlyFlow[] = Array.from({ length: 12 }, (_, i) => ({
    month: i + 1,
    income: Object.fromEntries(incomeCats.map((c) => [c, 0])),
    expense: Object.fromEntries(expenseCats.map((c) => [c, 0])),
  }));
  for (const r of rows) {
    const m = Number(String(r.month).slice(5, 7));
    if (!(m >= 1 && m <= 12)) continue;
    const cell = out[m - 1];
    if (r.sign === "pos") {
      const key = knownIncome.has(r.category) ? r.category : FLOW_OTHER_KEY;
      cell.income[key] = (cell.income[key] || 0) + r.amount;
    } else {
      // "neg" ham, "zero" ham shu shoxga tushadi — eski koddagi `else` bilan aynan bir xil.
      const key = knownExpense.has(r.category) ? r.category : FLOW_OTHER_KEY;
      cell.expense[key] = (cell.expense[key] || 0) - r.amount;
    }
  }
  return out;
}

function flowBuildRow(m: MonthlyFlow, opening: number): FlowMonthRow {
  const kirim = Object.values(m.income).reduce((s, v) => s + v, 0);
  const chiqim = Object.values(m.expense).reduce((s, v) => s + v, 0);
  const sof = kirim - chiqim;
  return { month: m.month, opening, kirim, chiqim, sof, closing: opening + sof, income: m.income, expense: m.expense };
}

/** Qoldiq zanjiri: yanvar `openingBalance` (yilgacha bo'lgan hamma narsa) dan, keyingi oy — oldingisining yakunidan. */
export function flowComputed(monthly: MonthlyFlow[], openingBalance: number): FlowMonthRow[] {
  const list: FlowMonthRow[] = [];
  let opening = openingBalance;
  for (const m of monthly) {
    const row = flowBuildRow(m, opening);
    list.push(row);
    opening = row.closing;
  }
  return list;
}

/** Jadval/eksportdagi kategoriya qatorlari; «Boshqa» faqat haqiqatan ro'yxatdan tashqari pul bo'lsa. */
export function flowCategoryRows(visible: FlowMonthRow[], cats: string[], side: "income" | "expense"): { key: string; label: string }[] {
  const hasOther = visible.some((v) => (v[side][FLOW_OTHER_KEY] || 0) !== 0);
  return (hasOther ? [...cats, FLOW_OTHER_KEY] : cats).map((key) => ({ key, label: flowCatLabel(key, cats) }));
}
