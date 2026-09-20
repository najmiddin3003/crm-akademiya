import type { Db } from "mongodb";
import { groupWeekdays, parsePeriod, toIsoDate } from "@/lib/attendance";

// GURUH A'ZOLIGI TARIXI — `group_memberships` kolleksiyasi.
//
// NEGA KERAK (20.09.2026): Qarzdorlar hisoboti (lib/debtors.ts) darslarni
// GURUH JADVALI bo'yicha sanaydi — "guruhning darsi qaysi kuni bo'lsa
// avtomatik" (foydalanuvchi qoidasi). Buning uchun o'quvchi guruhda
// QACHONDAN QACHONGACHA bo'lganini bilish shart, `groups.studentIds`
// esa faqat BUGUNGI ro'yxat: qo'shilgan sanasi yo'q, chiqarilgan
// o'quvchi izsiz yo'qoladi (qarzi bilan birga).
//
// Bitta yozuv = bitta a'zolik oralig'i:
//   { groupId, pupilId, joinedAt, leftAt }
//   joinedAt — "YYYY-MM-DD", darslar shu kundan sanaladi; `null` — noma'lum
//              (backfill: `studentIds` da bor edi, sanasi yozilmagan) —
//              hisobot guruhning boshlanish sanasini oladi;
//   leftAt   — "YYYY-MM-DD", chiqarilgan/arxivlangan kun; `null` — hali guruhda.
// O'quvchi guruhga qayta qo'shilsa YANGI yozuv ochiladi — eski oraliq
// saqlanadi (o'sha davr darslari uchun qarz yo'qolmasin).
//
// `studentIds` O'Z HOLICHA QOLADI — u guruhning bugungi ro'yxati va uni
// 20 dan ortiq joy o'qiydi. Ikkalasi BIRGA yoziladi: studentIds'ni
// o'zgartiradigan har bir joy (app/api/groups/[id]/students POST/DELETE,
// app/api/pupils/[id] DELETE, app/api/pupils/[id]/status → Arxiv) shu
// fayldagi openMembership/closeMemberships ni chaqiradi. Yangi yozish joyi
// paydo bo'lsa — shu ro'yxatga qo'shing, aks holda hisobot o'sha
// o'quvchini ko'rmaydi. Mavjud a'zoliklar uchun:
// scripts/backfill-group-memberships.mjs.

export const GROUP_MEMBERSHIPS = "group_memberships";

export type MembershipSource = "api" | "backfill" | "import";

export interface GroupMembership {
  id: number;
  groupId: number;
  pupilId: number;
  joinedAt: string | null;
  leftAt: string | null;
  source: MembershipSource;
  /** Yozuv yaratilgan lahza (ISO). */
  createdAt: string;
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** "YYYY-MM-DD" bo'lsa o'zi, aks holda null. */
export function isoDateOrNull(v: unknown): string | null {
  return typeof v === "string" && ISO_DATE.test(v) ? v : null;
}

/**
 * O'quvchi uchun ochiq (leftAt: null) a'zolik bo'lmasa — yangisini ochadi.
 * Qayta chaqirilsa (allaqachon guruhda) hech narsa qilmaydi — `$addToSet`
 * kabi idempotent.
 */
export async function openMembership(
  db: Db,
  groupId: number,
  pupilId: number,
  joinedAt: string | null,
  source: MembershipSource = "api",
): Promise<boolean> {
  const col = db.collection<GroupMembership>(GROUP_MEMBERSHIPS);
  const open = await col.findOne({ groupId, pupilId, leftAt: null }, { projection: { _id: 1 } });
  if (open) return false;
  const last = await col.find({}, { projection: { id: 1, _id: 0 } }).sort({ id: -1 }).limit(1).toArray();
  await col.insertOne({
    id: (last[0]?.id ?? 0) + 1,
    groupId,
    pupilId,
    joinedAt,
    leftAt: null,
    source,
    createdAt: new Date().toISOString(),
  });
  return true;
}

/**
 * Ochiq a'zolik(lar)ni yopadi. `groupId` berilmasa — o'quvchining BARCHA
 * guruhlaridagi (arxivlash / o'chirish). Yopilganlar sonini qaytaradi.
 */
export async function closeMemberships(db: Db, pupilId: number, groupId: number | null, leftAt: string): Promise<number> {
  const filter: Record<string, unknown> = { pupilId, leftAt: null };
  if (groupId !== null) filter.groupId = groupId;
  const res = await db.collection<GroupMembership>(GROUP_MEMBERSHIPS).updateMany(filter, { $set: { leftAt } });
  return res.modifiedCount;
}

/**
 * Guruh darslari boshlanadigan kun ("YYYY-MM-DD") — `startDate`, bo'lmasa
 * `period` ("03.09.2026 - 03.09.2027") boshi. Ikkalasi ham yo'q → null.
 */
export function groupStartIso(g: { startDate?: string | null; period?: string | null }): string | null {
  const direct = isoDateOrNull(g.startDate);
  if (direct) return direct;
  const { start } = parsePeriod(g.period);
  return start ? toIsoDate(start) : null;
}

/** Guruh darslari tugaydigan kun — `endDate`, bo'lmasa `period` oxiri; yo'q → null. */
export function groupEndIso(g: { endDate?: string | null; period?: string | null }): string | null {
  const direct = isoDateOrNull(g.endDate);
  if (direct) return direct;
  const { end } = parsePeriod(g.period);
  return end ? toIsoDate(end) : null;
}

/** "2026-09-03" → mahalliy Date (new Date(iso) UTC deb o'qib kunni surishi mumkin). */
function isoToDate(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

/**
 * `fromIso`..`toIso` (ikkalasi ham kiradi) oralig'ida guruh jadvaliga
 * to'g'ri keladigan dars kunlari soni va oxirgisi. Jadval tanilmasa
 * (groupWeekdays bo'sh) — 0: kun to'qib chiqarilmaydi.
 *
 * BAYRAM KUNLARI HAM SANALADI (foydalanuvchi qarori, 20.09.2026): ilgari
 * Sozlamalar → Bayram kunlari chiqarib tashlanardi; foydalanuvchi "bayram
 * kunida ham hisoblanishi kerak" dedi — dars kuni jadvalda bo'lsa, u
 * to'lanadi.
 */
export function lessonDaysBetween(
  day: string | undefined | null,
  fromIso: string,
  toIso: string,
): { count: number; last: string | null } {
  const weekdays = groupWeekdays(day);
  if (weekdays.length === 0 || fromIso > toIso) return { count: 0, last: null };
  let count = 0;
  let last: string | null = null;
  const end = isoToDate(toIso);
  for (const d = isoToDate(fromIso); d <= end; d.setDate(d.getDate() + 1)) {
    if (!weekdays.includes(d.getDay())) continue;
    count += 1;
    last = toIsoDate(d);
  }
  return { count, last };
}
