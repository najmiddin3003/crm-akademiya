import type { Db } from "mongodb";
import { pupilFullName, pupilStatusOf, type Pupil } from "@/lib/pupilsData";
import { BOT_USERS } from "@/lib/studentBot/users";
import { uzNow } from "@/lib/uzTime";

// JORIY OY TO'LOVI QILINGANMI — eslatma shu savolga tayanadi.
//
// TIZIMDA QARZDORLIK YURITILMAYDI. Kurs narxi, to'lov muddati, qarz
// qoldig'i — bularning hech biri bazada yo'q (lib/paymentSms.ts va
// bot matnlaridagi izohlar bilan bir xil holat). Ya'ni "qancha qarzi
// bor" degan savolga javob berib bo'lmaydi va berilmaydi ham.
//
// JAVOB BERILADIGAN savol bittasi: shu oy uchun HECH QANDAY to'lov
// yozuvi bormi. Eslatma matni ham aynan shunday yozilgan — summa
// aytilmaydi, chunki uni to'qib chiqarish kerak bo'lardi.
//
// `periodMonth` — to'lov QAYSI OY UCHUN ekani (kassa oynasida
// tanlanadi), `date` esa qachon to'langani. Eslatma uchun BIRINCHISI
// kerak: 5-sentyabrda avgust uchun to'lagan odam sentyabrni to'lagan
// hisoblanmasligi kerak.

/** "2026-09" — Toshkent vaqti bo'yicha joriy oy. */
export function currentPeriodMonth(now: Date = uzNow()): string {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Shu o'quvchi shu oy uchun to'laganmi.
 *
 * ISM BO'YICHA qidiriladi — `transaction_entries` da o'quvchi id'si
 * YO'Q (lib/studentBot/data.ts dagi bilan bir xil cheklov). Bu yerda
 * xato TOMONI MUHIM: bir xil ismli ikki o'quvchidan biri to'lagan
 * bo'lsa, ikkinchisi ham "to'lagan" hisoblanadi va eslatma OLMAYDI.
 *
 * Ataylab shu tomonga: to'lagan odamga "to'lovingiz yo'q" deb yozish
 * uni haqorat qiladi va markazga qo'ng'iroq qildiradi; eslatmani
 * o'tkazib yuborish esa shunchaki bitta eslatma kam bo'lishi.
 */
export async function hasPaidForMonth(db: Db, pupil: Pupil, month: string): Promise<boolean> {
  const name = pupilFullName(pupil).trim();
  if (!name) return true; // ismsiz o'quvchiga eslatma yubormaymiz
  const n = await db.collection("transaction_entries").countDocuments({
    studentName: { $regex: `^${escapeRegex(name)}$`, $options: "i" },
    txType: "payIn",
    periodMonth: month,
    status: { $ne: "cancelled" },
  });
  return n > 0;
}

export interface DueCheck {
  /** Shu oy uchun to'lov yozuvi yo'qmi. */
  unpaid: boolean;
  /** "2026-09" */
  month: string;
}

/** Bitta o'quvchi uchun holat — web kabinet va eslatma shundan foydalanadi. */
export async function dueFor(db: Db, pupil: Pupil, now: Date = uzNow()): Promise<DueCheck> {
  const month = currentPeriodMonth(now);
  // ARXIV/CHIQIB KETGAN o'quvchiga eslatma yo'q: u endi o'qimaydi va
  // undan pul kutilmaydi.
  if (pupilStatusOf(pupil) !== "Aktiv") return { unpaid: false, month };
  return { unpaid: !(await hasPaidForMonth(db, pupil, month)), month };
}

/**
 * Botga ULANGAN va shu oyni to'lamagan o'quvchilar.
 *
 * Boshlanish nuqtasi — `student_bot_users`, `pupils` EMAS. Sabab: xabar
 * baribir faqat ulanganlarga boradi, ulanganlar esa (bugun) o'nlab,
 * o'quvchilar 6 950 ta. Teskarisi butun bazani skanerdan o'tkazib,
 * natijaning 99% ini tashlab yuborardi.
 */
export async function linkedPupilsOwing(db: Db, now: Date = uzNow()): Promise<number[]> {
  const month = currentPeriodMonth(now);
  const users = await db
    .collection(BOT_USERS)
    .find({ blocked: { $ne: true } }, { projection: { _id: 0, links: 1 } })
    .toArray();

  const ids = new Set<number>();
  for (const u of users) {
    for (const l of (u.links ?? []) as { pupilId: number }[]) {
      if (Number.isFinite(l?.pupilId)) ids.add(l.pupilId);
    }
  }
  if (ids.size === 0) return [];

  const pupils = (await db
    .collection("pupils")
    .find({ id: { $in: [...ids] } }, { projection: { _id: 0, id: 1, firstName: 1, lastName: 1, status: 1 } })
    .toArray()) as unknown as Pupil[];

  const owing: number[] = [];
  for (const p of pupils) {
    if (pupilStatusOf(p) !== "Aktiv") continue;
    if (!(await hasPaidForMonth(db, p, month))) owing.push(p.id);
  }
  return owing.sort((a, b) => a - b);
}
