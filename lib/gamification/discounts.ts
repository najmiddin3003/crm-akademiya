import type { Db } from "mongodb";
import { monthlyPriceFor } from "@/lib/debtors";
import { groupLabel, type Group } from "@/lib/groups";
import { MONTHS } from "@/lib/i18n";
import { uzDateIso } from "@/lib/uzTime";
import { GAM, gamDb } from "./db";
import type { CoinTransaction } from "./types";
import { GamError, systemActor, withWallet } from "./wallet";

// TO'LOVGA CHEGIRMA (TZ 4.16, 6.9) — hayot sikli.
//
// Xarid oyi M: o'quvchi tangaga KEYINGI oy (M+1) to'loviga chegirma oladi —
// kurs (guruh) o'quvchining faol guruhlaridan tanlanadi, summa xarid paytida
// muzlatiladi: floor(oylik narx × foiz / 100). Holatlar:
//   active    — kutilmoqda (M+1 to'lovi hali kelmagan);
//   applied   — Moliyada M+1 to'loviga qo'llandi (qaytarib bo'lmaydi);
//   cancelled — sovg'a qaytarildi (tanga qaytgan);
//   expired   — M+1 tugadi, qo'llanmadi → tanga avtomatik qaytadi.
// Bir o'quvchiga oyiga bitta faol/qo'llangan chegirma: `activeKey`
// (`{pupilId}:{month}`) faqat active/applied da turadi, unikal indeks bilan.

export type DiscountStatus = "active" | "applied" | "cancelled" | "expired";

export interface TuitionDiscount {
  id: number;
  pupilId: number;
  groupId: number;
  branchId: number;
  /** Xarid paytidagi nusxalar — guruh keyin o'zgarsa ham tarix to'g'ri qoladi. */
  groupLabel: string;
  courseName: string;
  teacherName: string;
  /** Qo'llanadigan oy (M+1), "YYYY-MM". */
  month: string;
  percent: number;
  monthlyPriceSom: number;
  /** Muzlatilgan summa (TZ 4.16.3). */
  amountSom: number;
  orderId: number;
  status: DiscountStatus;
  activeKey?: string;
  /** Qo'llangan to'lov (transaction_entries `_id` satr ko'rinishida). */
  appliedEntryId: string | null;
  appliedAt: string | null;
  /** Amalda qo'llangan summa (to'lovdan oshmaydi). */
  appliedAmountSom: number | null;
  createdByName: string;
  createdAt: string;
  updatedAt: string;
}

export const activeKeyOf = (pupilId: number, month: string) => `${pupilId}:${month}`;

/** "2026-10" → "Oktyabr" (o'zbekcha; yozuv nomlari o'zbekcha saqlanadi). */
export const monthNameUz = (month: string) => MONTHS.uz[Number(month.slice(5, 7)) - 1] ?? month;

/** Buyurtma nomi (TZ 6.8): «Oktyabr to'loviga 5% chegirma». */
export function discountOrderName(month: string, percent: number): string {
  const name = monthNameUz(month);
  return `${name} to'loviga ${percent}% chegirma`;
}

/** Chegirma summasi — so'mgacha pastga (TZ 4.16.3, 29-test: 333 333 × 5% → 16 666). */
export const discountAmount = (monthlyPrice: number, percent: number) => Math.floor((monthlyPrice * percent) / 100);

/**
 * Tungi ish (TZ 4.16.6): oyi o'tib ketgan va qo'llanmagan chegirma —
 * `expired`; xarid yozuvi «Chegirma qo'llanmadi» bilan bekor (tanga to'liq
 * qaytadi — ketgan o'quvchiga ham), buyurtma `returned`, qaytargan — tizim.
 * Har chegirma o'z hamyoni qulfi ostida; holat `active` → `expired` atomik
 * (shu payt to'lov kelib qo'llasa — bittasi yutadi).
 */
export async function expireDiscounts(db: Db, today = uzDateIso()): Promise<{ expired: number; failed: number }> {
  const month = today.slice(0, 7);
  const due = (await db
    .collection(GAM.discounts)
    .find({ status: "active", month: { $lt: month } }, { projection: { _id: 0 } })
    .toArray()) as unknown as TuitionDiscount[];
  let expired = 0;
  let failed = 0;
  if (!due.length) return { expired, failed };
  // Cron bazasi `ensureIndexes()` dan keladi — hamyon yozuvidan oldin gamifikatsiya indekslari.
  await gamDb();
  for (const d of due) {
    try {
      await withWallet(db, d.pupilId, async (w) => {
        const now = new Date().toISOString();
        const claimed = await db
          .collection(GAM.discounts)
          .updateOne({ id: d.id, status: "active" }, { $set: { status: "expired", updatedAt: now }, $unset: { activeKey: "" } });
        if (claimed.modifiedCount !== 1) return;
        const order = await db.collection(GAM.shopOrders).findOne({ id: d.orderId }, { projection: { _id: 0, id: 1, status: 1, transactionId: 1 } });
        if (order && order.status === "given") {
          const tx = (await db.collection(GAM.tx).findOne({ id: Number(order.transactionId) }, { projection: { _id: 0 } })) as unknown as CoinTransaction | null;
          if (tx && tx.status === "active") await w.cancel(tx, "Chegirma qo'llanmadi", systemActor("Tizim"), true);
          await db.collection(GAM.shopOrders).updateOne(
            { id: order.id, status: "given" },
            { $set: { status: "returned", returnedByUserId: null, returnedByName: "Tizim", returnedAt: now, returnNote: "Chegirma qo'llanmadi" } },
          );
        }
        expired++;
      });
    } catch (e) {
      failed++;
      console.error("[gamification] chegirma muddati", d.id, e);
    }
  }
  return { expired, failed };
}

// ── Moliya bilan ulanish (TZ 4.16.4–4.16.5) ────────────────────────────
//
// To'lov yozuvida guruh/kurs maydoni YO'Q — ustoz `teacherName` satri bilan,
// oy esa `periodMonth` (bo'lmasa sana oyi) bilan bog'lanadi (lib/payrollSources.ts
// → monthMatch). Shu bois «o'sha kursning M+1 to'lovi» = shu o'quvchining,
// shu oy uchun, USTOZI chegirma guruhining ustoziga teng kirimi. O'quvchi
// o'sha guruhdan chiqqan bo'lsa chegirma qo'llanmaydi (TZ 4.16.6).

const nameKey = (v: unknown) => String(v ?? "").trim().toLowerCase();

/** To'lov yozuvi qaysi oyga tegishli — lib/payrollSources.ts → monthMatch bilan bir xil qoida. */
function monthMatch(month: string) {
  const byDate = { $regex: `^${month}-` };
  return [{ periodMonth: month }, { periodMonth: { $exists: false }, date: byDate }, { periodMonth: "", date: byDate }];
}

/** Ism bo'yicha aniq moslik (katta-kichik harf va chetdagi probelsiz). */
function nameExact(name: string) {
  const escaped = name.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return { $regex: `^\\s*${escaped}\\s*$`, $options: "i" };
}

export interface DiscountGroup {
  id: number;
  teacher: string;
  studentIds: number[];
  status: string;
}

async function loadGroup(db: Db, groupId: number): Promise<DiscountGroup | null> {
  const g = await db.collection("groups").findOne({ id: groupId }, { projection: { _id: 0, id: 1, teacher: 1, studentIds: 1, status: 1 } });
  if (!g) return null;
  return {
    id: Number(g.id),
    teacher: String(g.teacher ?? ""),
    studentIds: Array.isArray(g.studentIds) ? g.studentIds.map(Number) : [],
    status: String(g.status ?? ""),
  };
}

/** Chegirma shu kirimga tegishlimi: o'quvchi hali guruhda va ustoz bir xil. */
function matchesPayment(d: Pick<TuitionDiscount, "pupilId" | "teacherName">, g: DiscountGroup | null, teacherName: string): boolean {
  if (!g || g.status !== "active" || !g.studentIds.includes(d.pupilId)) return false;
  const want = nameKey(g.teacher || d.teacherName);
  return !want || nameKey(teacherName) === want;
}

/**
 * Xarid paytida (TZ 4.16.5): o'quvchining shu oy uchun, shu ustozga
 * yozilgan (bekor qilinmagan) kirimi allaqachon bormi — bor bo'lsa
 * chegirmani qo'llab bo'lmaydi.
 */
export async function paymentExistsFor(db: Db, p: { pupilId: number; pupilName: string }, month: string, teacher: string): Promise<boolean> {
  const name = p.pupilName.trim();
  const owner = name ? { $or: [{ pupilId: p.pupilId }, { pupilId: { $exists: false }, studentName: nameExact(name) }] } : { pupilId: p.pupilId };
  const n = await db.collection("transaction_entries").countDocuments(
    {
      $and: [owner, { txType: "payIn", status: { $ne: "cancelled" } }, { $or: monthMatch(month) }, ...(teacher.trim() ? [{ teacherName: nameExact(teacher) }] : [])],
    },
    { limit: 1 },
  );
  return n > 0;
}

/** Kirim oynasi / bot uchun ko'rinish: shu o'quvchining shu oy to'loviga kutilayotgan chegirma. */
export interface PendingDiscount {
  id: number;
  month: string;
  percent: number;
  amountSom: number;
  groupLabel: string;
  teacherName: string;
  /** O'quvchi hali o'sha guruhda — aks holda chegirma qo'llanmaydi. */
  inGroup: boolean;
}

export async function pendingDiscountFor(db: Db, pupilId: number, month: string): Promise<PendingDiscount | null> {
  if (!Number.isFinite(pupilId) || !/^\d{4}-\d{2}$/.test(month)) return null;
  const d = (await db.collection(GAM.discounts).findOne({ pupilId, month, status: "active" }, { projection: { _id: 0 } })) as unknown as TuitionDiscount | null;
  if (!d) return null;
  const g = await loadGroup(db, d.groupId);
  return {
    id: d.id,
    month: d.month,
    percent: d.percent,
    amountSom: d.amountSom,
    groupLabel: d.groupLabel,
    teacherName: g?.teacher || d.teacherName,
    inGroup: !!g && g.status === "active" && g.studentIds.includes(pupilId),
  };
}

export interface ClaimedDiscount {
  id: number;
  amountSom: number;
  percent: number;
}

/**
 * KIRIM YADROSI (lib/cashboxAdjust.ts) chaqiradi: shu to'lovga mos faol
 * chegirma bo'lsa uni ATOMIK `active → applied` qiladi va summasini
 * qaytaradi. Yozuv saqlangach `attachDiscountEntry`, saqlanmasa
 * `releaseDiscountClaim` chaqiriladi. Xato bo'lsa to'lov chegirmasiz
 * o'tadi — pul qabul qilish gamifikatsiya sababli to'xtamasin.
 */
export async function claimDiscountForPayment(
  db: Db,
  p: { pupilId: number; month: string; teacherName: string },
): Promise<ClaimedDiscount | null> {
  const d = (await db
    .collection(GAM.discounts)
    .findOne({ pupilId: p.pupilId, month: p.month, status: "active" }, { projection: { _id: 0 } })) as unknown as TuitionDiscount | null;
  if (!d) return null;
  if (!matchesPayment(d, await loadGroup(db, d.groupId), p.teacherName)) return null;
  const now = new Date().toISOString();
  const r = await db
    .collection(GAM.discounts)
    .updateOne({ id: d.id, status: "active" }, { $set: { status: "applied", appliedAt: now, appliedAmountSom: d.amountSom, updatedAt: now } });
  if (r.modifiedCount !== 1) return null;
  return { id: d.id, amountSom: d.amountSom, percent: d.percent };
}

export async function attachDiscountEntry(db: Db, discountId: number, entryId: number): Promise<void> {
  await db.collection(GAM.discounts).updateOne({ id: discountId, status: "applied" }, { $set: { appliedEntryId: String(entryId) } });
}

/** Yozuv saqlanmadi — egallangan chegirma yana faol. */
export async function releaseDiscountClaim(db: Db, discountId: number): Promise<void> {
  await db
    .collection(GAM.discounts)
    .updateOne(
      { id: discountId, status: "applied", appliedEntryId: null },
      { $set: { status: "active", appliedAt: null, appliedAmountSom: null, updatedAt: new Date().toISOString() } },
    );
}

/**
 * To'lov bekor qilindi (Moliya → Tranzaksiyalar): chegirma yana faol —
 * qayta kiritilgan to'lovga qo'llanadi; oyi o'tgan bo'lsa tungi ish uni
 * `expired` qilib tangani qaytaradi.
 */
export async function revertDiscountOnCancel(db: Db, discountId: number, entryId: number): Promise<boolean> {
  const r = await db
    .collection(GAM.discounts)
    .updateOne(
      { id: discountId, status: "applied", appliedEntryId: String(entryId) },
      { $set: { status: "active", appliedEntryId: null, appliedAt: null, appliedAmountSom: null, updatedAt: new Date().toISOString() } },
    );
  return r.modifiedCount === 1;
}

// ── Xarid: kurs tanlovi (TZ 4.14.3, 4.16.2–4.16.5) ─────────────────────

/** Kurs varianti — berish oynasidagi «Qaysi kurs to'loviga» ro'yxati. */
export interface DiscountCourseOption {
  groupId: number;
  label: string;
  teacherName: string;
  branchId: number;
  courseName: string;
  monthlyPrice: number;
  amount: number;
  /** Shu kursga berib bo'lmasa — sababi. */
  error: string | null;
}

/**
 * O'quvchining faol guruhlari → chegirma variantlari (M+1 uchun). Narx —
 * qarzdorlik hisobidagi oylik narx (lib/debtors.ts → monthlyPriceFor):
 * chegirma aynan o'sha oylik to'lovdan hisoblanadi.
 */
export async function discountCourseOptions(
  db: Db,
  p: { pupilId: number; pupilName: string },
  percent: number,
  month: string,
): Promise<DiscountCourseOption[]> {
  const [groups, courses] = await Promise.all([
    db
      .collection("groups")
      .find({ studentIds: p.pupilId, status: "active" }, { projection: { _id: 0, id: 1, name: 1, course: 1, level: 1, teacher: 1, branchId: 1 } })
      .toArray(),
    db.collection("offline_courses").find({}, { projection: { _id: 0, name: 1, branches: 1, levels: 1 } }).toArray(),
  ]);
  const monthName = monthNameUz(month);
  const out: DiscountCourseOption[] = [];
  for (const g of groups) {
    const price = monthlyPriceFor(g as unknown as Parameters<typeof monthlyPriceFor>[0], courses as unknown as Parameters<typeof monthlyPriceFor>[1]);
    const teacher = String(g.teacher ?? "").trim();
    let error: string | null = null;
    // GamError ko'rinishida — matn tarjima lug'atiga tushsin (scripts/i18n-scan.mjs), mijoz `t()` bilan o'giradi.
    if (price === null) error = new GamError(422, "Kurs narxi kiritilmagan — chegirmani hisoblab bo'lmaydi").message;
    else if (await paymentExistsFor(db, p, month, teacher)) {
      error = new GamError(422, `${monthName} to'lovi allaqachon yaratilgan — chegirma qo'llab bo'lmaydi`).message;
    }
    out.push({
      groupId: Number(g.id),
      label: groupLabel(g as unknown as Group),
      teacherName: teacher,
      branchId: Number(g.branchId) || 1,
      courseName: String(g.course ?? ""),
      monthlyPrice: price ?? 0,
      amount: price === null ? 0 : discountAmount(price, percent),
      error,
    });
  }
  return out;
}

/** O'quvchining shu oy uchun faol yoki qo'llangan chegirmasi bormi (oyiga bitta, TZ 4.16.2). */
export async function hasDiscountFor(db: Db, pupilId: number, month: string): Promise<boolean> {
  return !!(await db.collection(GAM.discounts).findOne({ activeKey: activeKeyOf(pupilId, month) }, { projection: { _id: 1 } }));
}

/** Oyning chegirmasi olgan o'quvchilari — berish oynasi ro'yxati uchun bitta so'rov. */
export async function pupilsWithDiscount(db: Db, month: string): Promise<Set<number>> {
  const rows = await db.collection(GAM.discounts).find({ month, status: { $in: ["active", "applied"] } }, { projection: { _id: 0, pupilId: 1 } }).toArray();
  return new Set(rows.map((r) => Number(r.pupilId)));
}
