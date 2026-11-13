import type { Db } from "mongodb";
import { addMoney, emptyMoney } from "@/lib/financeAnalytics";
import { buildPayrollRows, loadPayrollRefs, monthMatch } from "@/lib/payrollSources";
import {
  payrollBase,
  payrollDebt,
  payrollDue,
  payrollMonthKey,
  payrollPayout,
  payrollPeriod,
  payrollPeriodOf,
  payrollTax,
  prevMonthKey,
  type EmployeePayroll,
  type PayrollPeriod,
  type SalaryType,
} from "@/lib/salary";

// HISOBOTLAR → XODIMLAR VA OYLIK → «OYLIK VA AVANS» (26-qism, rasmlar 41–44, 13.11.2026).
//
// YOPILGAN OYLAR, har xodim bo'yicha. Joriy oy bu yerda YO'Q — u Moliya → Oylik chiqarish
// sahifasida (pul o'sha yerdan chiqadi, raqam har daqiqa o'zgaradi).
//
// HISOB O'ZI YO'Q — hammasi «Oylik chiqarish» sahifasining manbasidan:
//   qatorlar  ← lib/payrollSources.ts → buildPayrollRows (o'sha oy stavka nusxasi,
//               o'tgan oylar qoldig'i zanjiri, bonus/jarima, soliq, nol-yopish);
//   raqamlar  ← lib/salary.ts (payrollBase / payrollTax / payrollDue / payrollPayout).
// Ya'ni bir xodimning shu oydagi har bir raqami Oylik chiqarish sahifasida o'sha oy
// tanlanganda ko'rinadigani bilan AYNAN bir xil (scripts/_tmp-q26c-check.mjs bilan solishtirildi).
//
// FILIAL — xodimning OYLIK RO'YXATI filiali (`payrollBranchId`), Oylik chiqarish sahifasi
// kabi: 1+2 hovuzi bu yerda ham ikkita bino (oylik hovuzlanmaydi). Butun kompaniya bitta
// `buildPayrollRows` bilan quriladi va filialga keyin bo'linadi — qator xodim bo'yicha, ya'ni
// filialga kesib qurilgani bilan bir xil (har xodim bitta ro'yxatda, ikki marta sanalmaydi).

/** Hisobotdagi bitta xodim qatori (bitta oy). */
export interface PayrollReportRow {
  id: number;
  name: string;
  /** Oylik ro'yxati filiali (`hr_employees.payrollBranchId`); yo'q — `null`. */
  branchId: number | null;
  configured: boolean;
  archived: boolean;
  salaryType: SalaryType;
  percent: number;
  fixedSalary: number;
  /** Foizli asos — shu oy sof tushumi (ustoz almashuvi va qaytarimlar hisobga olingan). */
  collected: number;
  /** «Jami oylik» = oklad qismi + foiz ulushi, bonus/jarimasiz (`payrollBase`). Sozlanmaganda `null`. */
  base: number | null;
  /** Shu oy hisobiga berilgan avans. */
  avans: number;
  /** Shu oy hisobiga berilgan oylik («To'langan»). */
  paid: number;
  /** O'tgan oylardan shu oyga qo'shilgan qoldiq, ishorali. */
  carry: number;
  bonus: number;
  jarima: number;
  /** Ushlangan soliq (`payrollTax`). Sozlanmaganda `null`. */
  tax: number | null;
  /** «Qolgan oylik», ishorali (`payrollDue`): manfiy — xodim qarzi. Nol-yopish oyida 0. */
  due: number | null;
  /** Kassadan chiqadigan qism (`payrollPayout`) — Oylik chiqarish «Qolgan oylik» jami shundan. */
  payout: number | null;
  /** Xodim qarzi, musbat (`payrollDebt`). */
  debt: number | null;
}

export interface PayrollReportMonth {
  /** "YYYY-MM" */
  month: string;
  /** Nol-yopish oyi yoki undan oldingi — «Qolgan» 0 (lib/salary.ts → payrollDue). */
  closed: boolean;
  rows: PayrollReportRow[];
  /** Shu oy hisobiga berilgan OYLIKning oxirgi sanasi ("YYYY-MM-DD"), shu qamrovda; yo'q — `null`. */
  lastPaidDate: string | null;
  /**
   * «Kirim va chiqim» hisobotidagi shu oyning avans va oylik CHIQIMI — o'sha hisobot qoidasi
   * bilan: `transactions`, BERILGAN SANASI bo'yicha, kassa filiali bo'yicha, bekor qilish —
   * teskari amal (lib/financeAnalytics.ts → addMoney). Solishtirish izohi uchun.
   */
  cashflow: number;
}

/** Bitta qatorni hisobot shakliga keltiradi — sof, bazasiz (sinov skripti chaqiradi). */
export function toReportRow(e: EmployeePayroll, p: PayrollPeriod, branchId: number | null): PayrollReportRow {
  const c = e.configured;
  return {
    id: e.id,
    name: e.name,
    branchId,
    configured: c,
    archived: !!e.archived,
    salaryType: e.salaryType,
    percent: e.percent,
    fixedSalary: e.fixedSalary,
    collected: e.collected,
    base: c ? payrollBase(e, p) : null,
    avans: e.paidAvans,
    paid: e.paidOylik,
    carry: e.carryOver,
    bonus: e.bonus,
    jarima: e.jarima,
    tax: c ? payrollTax(e, p) : null,
    due: c ? payrollDue(e, p) : null,
    payout: c ? payrollPayout(e, p) : null,
    debt: c ? payrollDebt(e, p) : null,
  };
}

/** "YYYY-MM" ± n oy. */
export function shiftMonthKey(key: string, n: number): string {
  const [y, m] = key.split("-").map(Number);
  const d = new Date(y, m - 1 + n, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/** Ikkala chegara ham kiradi; `from > to` — bo'sh. */
export function monthKeysBetween(from: string, to: string): string[] {
  const out: string[] = [];
  for (let m = from; m <= to; m = shiftMonthKey(m, 1)) out.push(m);
  return out;
}

/** Oxirgi YOPILGAN oy — joriy oydan (Toshkent) oldingisi. */
export function lastClosedMonth(now?: Date): string {
  return prevMonthKey(now ? payrollPeriod(now) : payrollPeriod());
}

/** Joriy oy (Toshkent) — izohlar uchun. */
export function currentMonthKey(): string {
  return payrollMonthKey(payrollPeriod());
}

/**
 * Oylik hisobi boshlangan oy — birinchi moliyaviy yozuv oyi (`periodMonth`, bo'lmasa `date`).
 * O'tgan oylar qoldig'i zanjiri ham shu chegarada to'xtaydi (payrollSources → loadCarryOver):
 * undan oldingi oylarda «to'langan» yo'q, okladi esa o'z-o'zidan chiqib qolardi — yolg'on raqam.
 */
export async function loadPayrollMinMonth(db: Db): Promise<string | null> {
  const [r] = await db
    .collection("transaction_entries")
    .aggregate<{ m: string | null }>([
      { $match: { status: { $ne: "cancelled" } } },
      {
        $project: {
          _id: 0,
          k: {
            $cond: [
              { $gt: [{ $strLenBytes: { $ifNull: ["$periodMonth", ""] } }, 0] },
              "$periodMonth",
              { $substrBytes: [{ $ifNull: ["$date", ""] }, 0, 7] },
            ],
          },
        },
      },
      { $match: { k: { $regex: "^\\d{4}-(0[1-9]|1[0-2])$" } } },
      { $group: { _id: null, m: { $min: "$k" } } },
    ])
    .toArray();
  return r?.m ?? null;
}

/** Oylik/avans chiqimlari nomlari (`txName`) — Oylik chiqarish shularni sanaydi (/avans|oylik/i). */
async function payoutCategories(db: Db): Promise<string[]> {
  const raw = await db
    .collection("transaction_entries")
    .distinct("txName", { txType: "payOut", studentRefund: { $ne: true }, txName: { $regex: "avans|oylik", $options: "i" } });
  return raw.map((v) => String(v ?? "").trim()).filter(Boolean);
}

/**
 * «Kirim va chiqim» qoidasidagi avans + oylik chiqimi, oy bo'yicha (`PayrollReportMonth.cashflow`).
 * `cashboxBranchIds` — `null`: hamma kassalar; aks holda shu filiallarga biriktirilgan kassalar.
 */
async function loadPayoutCashflow(db: Db, months: string[], cashboxBranchIds: readonly number[] | null): Promise<Map<string, number>> {
  const out = new Map(months.map((m) => [m, 0]));
  if (months.length === 0) return out;
  const names = await payoutCategories(db);
  if (names.length === 0) return out;
  const match: Record<string, unknown> = {
    date: { $gte: `${months[0]}-01`, $lte: `${months[months.length - 1]}-31` },
    category: { $in: [...names, ...names.map((n) => `${n} (bekor qilindi)`)] },
  };
  if (cashboxBranchIds !== null) {
    const boxes = await db
      .collection("cashboxes")
      .find({ branchId: { $in: [...cashboxBranchIds] } }, { projection: { _id: 0, id: 1 } })
      .toArray();
    match.cashboxId = { $in: boxes.map((b) => Number(b.id)).filter(Number.isFinite) };
  }
  const rows = await db
    .collection("transactions")
    .aggregate<{ _id: { m: string; c: string }; amount: number }>([
      { $match: match },
      { $group: { _id: { m: { $substrBytes: ["$date", 0, 7] }, c: "$category" }, amount: { $sum: "$amount" } } },
    ])
    .toArray();
  const by = new Map(months.map((m) => [m, emptyMoney()]));
  for (const r of rows) {
    const t = by.get(r._id.m);
    if (t) addMoney(t, { amount: Number(r.amount) || 0, category: r._id.c });
  }
  for (const [m, t] of by) out.set(m, t.expense);
  return out;
}

/** Shu oy hisobiga berilgan OYLIKning oxirgi sanasi — `names` (ism kaliti) xodimlari bo'yicha. */
async function loadLastPaidDate(db: Db, month: string, names: ReadonlySet<string>): Promise<string | null> {
  if (names.size === 0) return null;
  const rows = await db
    .collection("transaction_entries")
    .find(
      { txType: "payOut", $or: monthMatch(month), status: { $ne: "cancelled" }, txName: { $regex: "oylik", $options: "i" } },
      { projection: { _id: 0, date: 1, studentName: 1 } },
    )
    .toArray();
  let last: string | null = null;
  for (const r of rows) {
    if (!names.has(String(r.studentName ?? "").trim().toLowerCase())) continue;
    const d = String(r.date ?? "").slice(0, 10);
    if (/^\d{4}-\d{2}-\d{2}$/.test(d) && (last === null || d > last)) last = d;
  }
  return last;
}

/**
 * Hisobot: `months` (yopilgan oylar) × xodimlar.
 *   `branchIds` — oylik ro'yxati filiallari; `null` — hammasi (oylik filiali yo'q xodim ham).
 *   `cashboxBranchIds` — «Kirim va chiqim» solishtirmasi qamrovi (yuqoriga qarang).
 */
export async function buildPayrollReport(
  db: Db,
  opts: { months: string[]; branchIds: readonly number[] | null; cashboxBranchIds: readonly number[] | null },
): Promise<{ months: PayrollReportMonth[]; closedThrough: string | null }> {
  // Oyga bog'liq bo'lmagan qism (xodimlar, bonus/jarima, foiz darajalari, soliq, stavka
  // nusxalari) — bir marta; har oy va uning qoldiq zanjiri shuni ishlatadi.
  const refs = await loadPayrollRefs(db, {});
  const branchOf = new Map(refs.employees.map((e) => [e.id, typeof e.payrollBranchId === "number" ? e.payrollBranchId : null]));
  const inScope = (id: number) => {
    if (opts.branchIds === null) return true;
    const b = branchOf.get(id) ?? null;
    return b !== null && opts.branchIds.includes(b);
  };

  const [built, cashflow] = await Promise.all([
    Promise.all(
      opts.months.map(async (month) => {
        const p = payrollPeriodOf(month);
        const rows = (await buildPayrollRows(db, p, { refs })).filter((e) => inScope(e.id));
        const names = new Set(rows.map((e) => String(e.name ?? "").trim().toLowerCase()));
        const lastPaidDate = await loadLastPaidDate(db, month, names);
        return {
          month,
          closed: rows.some((e) => e.closedMonth) || (refs.closedThrough != null && month <= refs.closedThrough),
          rows: rows.map((e) => toReportRow(e, p, branchOf.get(e.id) ?? null)),
          lastPaidDate,
        };
      }),
    ),
    loadPayoutCashflow(db, opts.months, opts.cashboxBranchIds),
  ]);

  return {
    months: built.map((m) => ({ ...m, cashflow: cashflow.get(m.month) ?? 0 })),
    closedThrough: refs.closedThrough ?? null,
  };
}
