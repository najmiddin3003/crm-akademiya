// HISOBOTLAR → «Kirim va chiqim» (26-qism) — sof hisob (React'siz, node sinovi uchun).
//
// TOIFALAR: Moliya analitikasi bilan BIR qoida (lib/financeAnalytics.ts → addMoney),
// faqat yig'indi toifa kesimida. Har qator (oy × toifa × kassa) addMoney'dagi tarmoqqa
// qarab kirim yoki chiqim qismiga tushadi:
//   musbat oddiy          → kirim[toifa]  += a
//   musbat «bekor qilindi» → chiqim[toifa] −= a  (chiqim bekor qilingan — chiqim kamayadi)
//   manfiy «bekor qilindi» → kirim[toifa]  += a  (kirim bekor qilingan — kirim kamayadi)
//   manfiy oddiy          → chiqim[toifa] += |a|
// Shuning uchun toifalar yig'indisi analitikadagi Kirim/Chiqim'ga AYNAN teng. Toifa
// nomi «(bekor qilindi)» qo'shimchasisiz. Bitta toifa ikkala guruhda ham chiqishi
// mumkin (masalan kirim turidagi manfiy yozuv) — pul yashirinmasin.

import type { MoneyTotals, SummaryRow } from "@/lib/financeAnalytics";
import { isReversal } from "@/lib/financeAnalytics";
import { txAudience, type CustomerTypeField } from "@/lib/txTarget";

const REV_SUFFIX = /\s*\(bekor qilindi\)\s*$/;
export const baseCategory = (c: string | undefined) => (c || "").replace(REV_SUFFIX, "").trim() || "—";

/** Toifa qaysi oqimdan tug'iladi — qator ostidagi izoh uchun. */
export type CatFlow = "payments" | "payroll" | null;

export interface CatRow {
  name: string;
  byMonth: number[];
  total: number;
  flow: CatFlow;
}

export interface CatMatrix {
  income: CatRow[];
  expense: CatRow[];
}

export interface TypeLike {
  name: string;
  mainType?: string;
  customerType?: CustomerTypeField;
}

/**
 * Izoh FAQAT toifa haqiqatan o'sha oqimdan yozilganda:
 *   • «to'lov qabul qilishdan» — kirim turi, «Mijoz»da o'quvchilar bor (O'quvchi to'lovi
 *     oynasi aynan shunday turni tanlaydi — components/v2/finance/kirimPrefs.ts);
 *   • «oylik chiqarishdan» — chiqim turi, «Mijoz» = xodim, nomida «oylik» (Oylik
 *     chiqarish yozadigan tur — app/api/salary-runs/route.ts → salaryCategories).
 * Tur ro'yxatda yo'q yoki boshqa tur — izohsiz.
 */
export function categoryFlow(name: string, kind: "income" | "expense", types: readonly TypeLike[]): CatFlow {
  const t = types.find((x) => x.name === name);
  if (!t) return null;
  const aud = txAudience(t);
  if (kind === "income" && t.mainType === "kirim" && aud.student) return "payments";
  if (kind === "expense" && t.mainType === "chiqim" && aud.employee && /oylik/i.test(t.name)) return "payroll";
  return null;
}

export function categoryMatrix(rows: readonly SummaryRow[], months: readonly string[], cashboxes: ReadonlySet<number> | null, types: readonly TypeLike[] = []): CatMatrix {
  const idx = new Map(months.map((m, i) => [m, i]));
  const inc = new Map<string, number[]>();
  const exp = new Map<string, number[]>();
  const cell = (map: Map<string, number[]>, name: string) => {
    let v = map.get(name);
    if (!v) map.set(name, (v = months.map(() => 0)));
    return v;
  };
  for (const r of rows) {
    if (cashboxes && !cashboxes.has(Number(r.cashbox))) continue;
    const i = r.month ? idx.get(r.month) : undefined;
    const a = r.amount;
    if (i === undefined || !a) continue;
    const name = baseCategory(r.category);
    const rev = isReversal(r.category);
    if (a > 0) {
      if (rev) cell(exp, name)[i] -= a;
      else cell(inc, name)[i] += a;
    } else if (rev) cell(inc, name)[i] += a;
    else cell(exp, name)[i] -= a;
  }
  const list = (map: Map<string, number[]>, kind: "income" | "expense"): CatRow[] =>
    [...map.entries()]
      .map(([name, byMonth]) => ({ name, byMonth, total: byMonth.reduce((s, v) => s + v, 0), flow: categoryFlow(name, kind, types) }))
      .filter((r) => r.byMonth.some((v) => Math.round(v) !== 0))
      .sort((a, b) => b.total - a.total || a.name.localeCompare(b.name));
  return { income: list(inc, "income"), expense: list(exp, "expense") };
}

/** Ulush foizi (butun): «31%». `whole` ≤ 0 — `null`. */
export function sharePct(part: number, whole: number): number | null {
  return whole > 0 ? Math.round((part / whole) * 100) : null;
}

/**
 * «Eng yaxshi oy» — sof foydasi eng katta oy. Harakatsiz oylar hisobga olinmaydi;
 * tugamagan (joriy) oy faqat boshqa oy bo'lmasa tanlanadi — yarim oy to'liq oy bilan
 * teng solishtirilmaydi.
 */
export function bestMonth(months: readonly string[], monthly: readonly MoneyTotals[], partialIndex: number | null): number | null {
  let best: number | null = null;
  const pick = (allowPartial: boolean) => {
    for (let i = 0; i < months.length; i++) {
      const m = monthly[i];
      if (!m || (!m.income && !m.expense)) continue;
      if (!allowPartial && i === partialIndex) continue;
      if (best === null || m.net > (monthly[best]?.net ?? -Infinity)) best = i;
    }
  };
  pick(false);
  if (best === null) pick(true);
  return best;
}

/* ───────────────────────── Kassalar ───────────────────────── */

export interface CashCells {
  start: number;
  kirim: number;
  chiqim: number;
  kochirish: number;
  end: number;
}

export function addCells(a: CashCells, b: CashCells): CashCells {
  return { start: a.start + b.start, kirim: a.kirim + b.kirim, chiqim: a.chiqim + b.chiqim, kochirish: a.kochirish + b.kochirish, end: a.end + b.end };
}

export const zeroCells = (): CashCells => ({ start: 0, kirim: 0, chiqim: 0, kochirish: 0, end: 0 });

/** Ko'rinadigan kassa: arxivda bo'lsa faqat oyda harakati yoki qoldig'i bor bo'lganda. */
export function cashboxVisible(c: { archived: boolean; total: CashCells }): boolean {
  if (!c.archived) return true;
  const t = c.total;
  return [t.start, t.kirim, t.chiqim, t.kochirish, t.end].some((v) => Math.round(v) !== 0);
}
