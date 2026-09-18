import type { Db } from "mongodb";
import { pupilBranchCondition } from "@/lib/branchScope";
import { loadCardStats, type CashboxCardStats } from "@/lib/cashboxStats";
import type { CashboxMethodTotals } from "@/lib/cashboxes";
import { groupLabel, type Group } from "@/lib/groups";
import { loadPaymentMethods, type PaymentMethod } from "@/lib/paymentMethods";
import { buildPayrollRows } from "@/lib/payrollSources";
import { phoneSearchPattern } from "@/lib/phoneSearch";
import { pupilFullName } from "@/lib/pupilsData";
import { pupilSearchFilter } from "@/lib/pupilSearch";
import {
  payrollCashLeg,
  payrollEarned,
  payrollPaid,
  payrollPayout,
  payrollPeriodOf,
  payrollPlastikLeg,
  payrollTax,
} from "@/lib/salary";
import type { TransactionType } from "@/lib/transactionTypes";
import { loadPendingOut } from "@/lib/transferPending";
import type { BotCashbox } from "@/lib/staffBot/auth";
import type { SalaryInfo } from "@/lib/staffBot/session";

// Xodimlar boti — BAZADAN O'QISH. Bu modul hech narsa yozmaydi; yozish
// faqat yadro orqali (lib/cashboxAdjust.ts).

/** So'rovdagi maxsus belgilar regex sifatida talqin qilinmasin. */
function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Kirim turlari — Sozlamalar → Moliya → Tranzaksiya turi, "Kirim" tabi tartibida. */
export async function loadKirimTypes(db: Db): Promise<TransactionType[]> {
  const rows = await db.collection("transaction_types")
    .find({ mainType: "kirim" }, { projection: { _id: 0 } })
    .sort({ id: 1 })
    .toArray();
  return rows as unknown as TransactionType[];
}

/** Chiqim turlari — "Chiqim" tabi tartibida, HAMMASI (foydalanuvchi qarori: qisqartirilmaydi). */
export async function loadChiqimTypes(db: Db): Promise<TransactionType[]> {
  const rows = await db.collection("transaction_types")
    .find({ mainType: "chiqim" }, { projection: { _id: 0 } })
    .sort({ id: 1 })
    .toArray();
  return rows as unknown as TransactionType[];
}

export interface EmployeeHit {
  id: number;
  name: string;
  phone: string;
  /** "teacher" | "moderator" | "admin" */
  turi: string;
}

const EMPLOYEE_FIELDS = { _id: 0, id: 1, name: 1, phone: 1, turi: 1 } as const;

/**
 * Xodim qidiruvi — ism yoki telefon bo'yicha, FAQAT FAOLLAR (arxivdagi
 * xodimga oylik berilmaydi — web'dagi Chiqim oynasi bilan bir xil qoida:
 * `archReason` bo'sh bo'lsa faol). Filialga KESILMAYDI — kassa oynalari
 * ham /api/hr-employees/ref (filialsiz) dan oladi.
 */
export async function searchEmployees(db: Db, query: string): Promise<{ hits: EmployeeHit[]; more: boolean } | null> {
  const q = query.trim();
  if (q.length < 2) return null;
  const active = { $or: [{ archReason: { $exists: false } }, { archReason: null }, { archReason: "" }] };
  const phone = phoneSearchPattern(q);
  const terms = q.toLowerCase().split(/\s+/).filter(Boolean).slice(0, 4);
  const byText = terms.map((t) => ({
    $or: [
      { name: { $regex: escapeRegex(t), $options: "i" } },
      ...(phoneSearchPattern(t) ? [{ phone: { $regex: phoneSearchPattern(t)! } }] : []),
    ],
  }));
  const match = /^[\d\s()+-]+$/.test(q) && phone
    ? { $and: [active, { phone: { $regex: phone } }] }
    : { $and: [active, ...byText] };
  const rows = await db.collection("hr_employees")
    .find(match, { projection: EMPLOYEE_FIELDS })
    .sort({ id: 1 })
    .limit(SEARCH_LIMIT + 1)
    .toArray();
  const hits = rows.slice(0, SEARCH_LIMIT).map((r) => ({
    id: Number(r.id),
    name: String(r.name ?? "").trim(),
    phone: String(r.phone ?? ""),
    turi: String(r.turi ?? ""),
  }));
  return { hits, more: rows.length > SEARCH_LIMIT };
}

export async function loadEmployeeHit(db: Db, id: number): Promise<EmployeeHit | null> {
  const r = await db.collection("hr_employees").findOne({ id }, { projection: EMPLOYEE_FIELDS });
  if (!r) return null;
  return { id: Number(r.id), name: String(r.name ?? "").trim(), phone: String(r.phone ?? ""), turi: String(r.turi ?? "") };
}

/**
 * Xodimning SHU OYDAGI oylik hisobi — Avans/Oylik chegarasi uchun.
 *
 * Oylik hisob-kitob sahifasi, Chiqim oynasi va server (lib/cashboxAdjust.ts)
 * bilan AYNAN BIR XIL funksiyalar (lib/salary.ts). Qator butun kompaniya
 * bo'yicha quriladi (filialga kesilmaydi) — server ham shunday tekshiradi.
 * `null` — xodim oylik ro'yxatida yo'q.
 */
export async function employeeSalaryInfo(db: Db, name: string, dateIso: string): Promise<SalaryInfo | null> {
  const period = payrollPeriodOf(dateIso.slice(0, 7));
  const rows = await buildPayrollRows(db, period);
  const key = name.trim().toLowerCase();
  const row = rows.find((e) => e.name.trim().toLowerCase() === key);
  if (!row) return null;
  if (!row.configured) {
    return { configured: false, earned: 0, tax: 0, karta: 0, paid: 0, carryOver: 0, naqd: 0, jami: 0, plastikSalary: 0 };
  }
  return {
    configured: true,
    earned: payrollEarned(row, period),
    tax: payrollTax(row, period),
    karta: payrollPlastikLeg(row, period),
    paid: payrollPaid(row),
    carryOver: row.carryOver,
    naqd: payrollCashLeg(row, period),
    jami: payrollPayout(row, period),
    plastikSalary: row.plastikSalary,
  };
}

/** Faol to'lov turlari — web'dagi Kirim oynasi ham faqat shularni ko'rsatadi (hooks/usePaymentMethods.ts). */
export async function loadActiveMethods(db: Db): Promise<PaymentMethod[]> {
  return (await loadPaymentMethods(db)).filter((m) => m.active);
}

export interface PupilHit {
  id: number;
  name: string;
  phone: string;
}

/** Ekranga sig'adigan tugmalar soni — undan ko'p topilsa kassir aniqroq yozadi. */
export const SEARCH_LIMIT = 8;

/**
 * O'quvchi qidiruvi — web'dagi navbar qidiruvi bilan BIR XIL filtr
 * (lib/pupilSearch.ts). Filial qamrovi kassaning filialidan: web'da
 * cookie qanday kessa, bu yerda kassa shunday kesadi (o'quvchilar
 * hovuzi bilan — Chortoq 1 va 2 bir-birini ko'radi). Kassaning filiali
 * yo'q bo'lsa (eski/sinov kassasi) — qamrovsiz.
 *
 * `LIMIT + 1` so'raladi: natija chegaradan oshganini bilish uchun.
 */
export async function searchPupils(
  db: Db,
  query: string,
  branchId: number | undefined,
): Promise<{ hits: PupilHit[]; more: boolean } | null> {
  const filter = pupilSearchFilter(query);
  if (!filter) return null;
  const scoped = typeof branchId === "number"
    ? { $and: [filter, pupilBranchCondition({ branchId, allowed: [branchId], isAdmin: false })] }
    : filter;
  const rows = await db.collection("pupils")
    .find(scoped, { projection: { _id: 0, id: 1, firstName: 1, lastName: 1, phone: 1 } })
    .limit(SEARCH_LIMIT + 1)
    .toArray();
  const hits = rows.slice(0, SEARCH_LIMIT).map((r) => ({
    id: Number(r.id),
    name: pupilFullName({ firstName: String(r.firstName ?? ""), lastName: String(r.lastName ?? "") }),
    phone: String(r.phone ?? ""),
  }));
  return { hits, more: rows.length > SEARCH_LIMIT };
}

export async function loadPupilHit(db: Db, pupilId: number): Promise<PupilHit | null> {
  const r = await db.collection("pupils").findOne({ id: pupilId }, { projection: { _id: 0, id: 1, firstName: 1, lastName: 1, phone: 1 } });
  if (!r) return null;
  return {
    id: Number(r.id),
    name: pupilFullName({ firstName: String(r.firstName ?? ""), lastName: String(r.lastName ?? "") }),
    phone: String(r.phone ?? ""),
  };
}

export interface PupilGroupInfo {
  /** "Matematika (13-guruh)" — bo'sh bo'lsa guruhga qo'shilmagan. */
  groupLabel: string;
  /** O'qituvchisi ko'rsatilgan birinchi guruhning ustozi (lib/teacherOfStudent.ts bilan bir xil qoida). */
  teacher: string;
}

/**
 * O'quvchining guruhi va ustozi — ID bo'yicha.
 *
 * lib/teacherOfStudent.ts ISM bo'yicha qidiradi (Kirim oynasi shunday
 * yuboradi) va bazada 511 ta ism takrorlanadi. Botda o'quvchi tugmadan
 * ID bilan tanlanadi, shu bois aniq o'sha o'quvchining guruhi olinadi;
 * topilgan ustoz yadroga `teacherName` sifatida beriladi — yozuvga
 * kartada ko'rsatilgan ustoz tushadi, boshqasi emas.
 */
export async function pupilGroupInfo(db: Db, pupilId: number): Promise<PupilGroupInfo> {
  const groups = await db.collection<Group>("groups")
    .find({ studentIds: pupilId }, { projection: { _id: 0, id: 1, name: 1, course: 1, teacher: 1 } })
    .sort({ id: 1 })
    .toArray();
  const withTeacher = groups.find((g) => String(g.teacher ?? "").trim() !== "");
  const shown = withTeacher ?? groups[0];
  return {
    groupLabel: shown ? groupLabel(shown) : "",
    teacher: withTeacher ? String(withTeacher.teacher).trim() : "",
  };
}

export interface KassamView {
  cashbox: BotCashbox;
  methods: PaymentMethod[];
  pendingOut: CashboxMethodTotals;
  stats: CashboxCardStats;
}

/** Kassam ekrani uchun raqamlar — GET /api/cashboxes bilan bir xil manbalar. */
export async function loadKassam(db: Db, cashbox: BotCashbox): Promise<KassamView> {
  const primary = await db.collection("cashboxes").findOne({ isPrimary: true }, { projection: { _id: 0, id: 1 } });
  const [methods, pending, stats] = await Promise.all([
    loadActiveMethods(db),
    loadPendingOut(db, [cashbox.id]),
    loadCardStats(db, [cashbox.id], typeof primary?.id === "number" ? primary.id : null),
  ]);
  return {
    cashbox,
    methods,
    pendingOut: pending.get(cashbox.id) ?? {},
    stats: stats.get(cashbox.id) ?? {
      todayIncome: 0,
      todayByMethod: {},
      sinceHandover: { income: 0, expense: 0, since: null },
      pendingIn: 0,
      pendingInCount: 0,
    },
  };
}

export interface TodayEntry {
  id: number;
  time: string;
  amount: number;
  txType: string;
  txName: string;
  paymentType: string;
  studentName: string;
  note: string;
  status: string;
  origin?: string;
}

/** Shu kassaning BUGUNGI yozuvlari — eng yangisi birinchi. */
export async function loadTodayEntries(db: Db, cashboxId: number, dateIso: string, limit = 15): Promise<TodayEntry[]> {
  const rows = await db.collection("transaction_entries")
    .find(
      { cashboxId, date: dateIso },
      { projection: { _id: 0, id: 1, time: 1, amount: 1, txType: 1, txName: 1, paymentType: 1, studentName: 1, note: 1, status: 1, origin: 1 } },
    )
    .sort({ id: -1 })
    .limit(limit)
    .toArray();
  return rows.map((r) => ({
    id: Number(r.id),
    time: String(r.time ?? ""),
    amount: Number(r.amount ?? 0),
    txType: String(r.txType ?? ""),
    txName: String(r.txName ?? ""),
    paymentType: String(r.paymentType ?? ""),
    studentName: String(r.studentName ?? ""),
    note: String(r.note ?? ""),
    status: String(r.status ?? ""),
    origin: typeof r.origin === "string" ? r.origin : undefined,
  }));
}

/** Kurs nomlari — Sozlamalar → Kurslar (`offline_courses`), web'dagi lid oynasi bilan bir xil manba. */
export async function loadCourseNames(db: Db): Promise<string[]> {
  const rows = await db.collection("offline_courses").find({}, { projection: { _id: 0, name: 1 } }).sort({ id: 1 }).toArray();
  return rows.map((r) => String(r.name ?? "").trim()).filter(Boolean);
}

// ── Ko'chirmalar ────────────────────────────────────────────────────

export interface IncomingTransfer {
  /** Pul KELAYOTGAN qatorning id'si — ✓/✗ shu id bilan (lib/transferDecision.ts). */
  id: number;
  transferId: number;
  date: string;
  time: string;
  amount: number;
  paymentType: string;
  txName: string;
  note: string;
  fromCashboxId: number | null;
  fromCashboxName: string;
}

const INCOMING_FIELDS = {
  _id: 0, id: 1, transferId: 1, date: 1, time: 1, amount: 1, paymentType: 1, txName: 1, note: 1, cashboxId: 1, status: 1, transferRole: 1,
} as const;

/** Jo'natuvchi kassa nomlari — chiquvchi qator orqali (txName dan ajratib olishdan ishonchliroq). */
async function withSenderNames(db: Db, rows: Record<string, unknown>[]): Promise<IncomingTransfer[]> {
  const transferIds = rows.map((r) => Number(r.transferId)).filter((n) => Number.isFinite(n));
  const outs = transferIds.length > 0
    ? await db.collection("transaction_entries")
        .find({ transferId: { $in: transferIds }, transferRole: "out" }, { projection: { _id: 0, transferId: 1, cashboxId: 1 } })
        .toArray()
    : [];
  const senderOf = new Map(outs.map((o) => [Number(o.transferId), Number(o.cashboxId)]));
  const cashboxIds = [...new Set([...senderOf.values()])];
  const boxes = cashboxIds.length > 0
    ? await db.collection("cashboxes").find({ id: { $in: cashboxIds } }, { projection: { _id: 0, id: 1, name: 1 } }).toArray()
    : [];
  const nameOf = new Map(boxes.map((b) => [Number(b.id), String(b.name ?? "")]));
  return rows.map((r) => {
    const fromId = senderOf.get(Number(r.transferId)) ?? null;
    return {
      id: Number(r.id),
      transferId: Number(r.transferId),
      date: String(r.date ?? ""),
      time: String(r.time ?? ""),
      amount: Math.abs(Number(r.amount ?? 0)),
      paymentType: String(r.paymentType ?? ""),
      txName: String(r.txName ?? ""),
      note: String(r.note ?? ""),
      fromCashboxId: fromId,
      fromCashboxName: fromId !== null ? (nameOf.get(fromId) ?? "") : "",
    };
  });
}

/** Shu kassaga KELAYOTGAN, tasdiq kutayotgan ko'chirmalar — eng yangisi birinchi. */
export async function loadIncomingTransfers(db: Db, cashboxId: number, limit = 10): Promise<IncomingTransfer[]> {
  const rows = await db.collection("transaction_entries")
    .find({ cashboxId, txType: "transfer", transferRole: "in", status: "waiting" }, { projection: INCOMING_FIELDS })
    .sort({ id: -1 })
    .limit(limit)
    .toArray();
  return withSenderNames(db, rows as Record<string, unknown>[]);
}

/** Bitta kelayotgan ko'chirma — tugma bosilganda qayta o'qiladi (holati o'zgargan bo'lishi mumkin). */
export async function loadIncomingTransfer(db: Db, entryId: number): Promise<IncomingTransfer | null> {
  const row = await db.collection("transaction_entries").findOne(
    { id: entryId, txType: "transfer", transferRole: "in", status: "waiting" },
    { projection: INCOMING_FIELDS },
  );
  if (!row) return null;
  return (await withSenderNames(db, [row as Record<string, unknown>]))[0] ?? null;
}

/** Jo'natish uchun mavjud kassalar — o'zinikidan tashqari, arxivlanmaganlar, bosh kassa birinchi. */
export async function loadTransferDestinations(db: Db, ownId: number): Promise<BotCashbox[]> {
  const rows = await db.collection("cashboxes")
    .find({ id: { $ne: ownId }, archived: { $ne: true } }, { projection: { _id: 0, id: 1, name: 1, moderator: 1, balance: 1, methodTotals: 1, branchId: 1, isPrimary: 1 } })
    .sort({ isPrimary: -1, id: 1 })
    .toArray();
  return rows.map((r) => ({
    id: Number(r.id),
    name: String(r.name ?? ""),
    moderator: String(r.moderator ?? ""),
    balance: Number(r.balance ?? 0),
    methodTotals: (r.methodTotals as CashboxMethodTotals | undefined) ?? {},
    branchId: typeof r.branchId === "number" ? r.branchId : undefined,
    isPrimary: r.isPrimary === true,
  }));
}
