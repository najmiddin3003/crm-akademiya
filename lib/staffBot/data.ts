import type { Db } from "mongodb";
import { pupilBranchCondition } from "@/lib/branchScope";
import { loadCardStats, type CashboxCardStats } from "@/lib/cashboxStats";
import type { CashboxMethodTotals } from "@/lib/cashboxes";
import { groupLabel, type Group } from "@/lib/groups";
import { loadPaymentMethods, type PaymentMethod } from "@/lib/paymentMethods";
import { pupilFullName } from "@/lib/pupilsData";
import { pupilSearchFilter } from "@/lib/pupilSearch";
import type { TransactionType } from "@/lib/transactionTypes";
import { loadPendingOut } from "@/lib/transferPending";
import type { BotCashbox } from "@/lib/staffBot/auth";

// Xodimlar boti — BAZADAN O'QISH. Bu modul hech narsa yozmaydi; yozish
// faqat yadro orqali (lib/cashboxAdjust.ts).

/** Kirim turlari — Sozlamalar → Moliya → Tranzaksiya turi, "Kirim" tabi tartibida. */
export async function loadKirimTypes(db: Db): Promise<TransactionType[]> {
  const rows = await db.collection("transaction_types")
    .find({ mainType: "kirim" }, { projection: { _id: 0 } })
    .sort({ id: 1 })
    .toArray();
  return rows as unknown as TransactionType[];
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
