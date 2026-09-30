import type { Db } from "mongodb";

// USTOZ ALMASHUVI — oy o'rtasida o'quvchilar boshqa ustozga o'tganda o'sha
// oyning to'lovlari ustozlar o'rtasida KALENDAR KUNLARIGA qarab bo'linadi
// (foydalanuvchi qarori, 30.09.2026).
//
// NIMA UCHUN KERAK: foizli oylik ustoz NOMIGA yozilgan to'lovdan hisoblanadi
// (lib/payrollSources.ts → loadCollectedByTeacher), to'lovning ustozi esa
// kassada to'lov kiritilgan paytda belgilanadi va keyin o'zgarmaydi. Odina
// Ahmedova 20-sentabrgacha dars o'tib, guruhlari boshqa ustozlarga o'tdi —
// lekin sentabr to'lovlari to'liq unda qolib, 1 379 000 "to'liq oy" bo'lib
// chiqdi, yangi ustozlar esa bu o'quvchilardan hech narsa olmadi.
//
// QOIDA: almashuv yozuvi (oy, eski ustoz, OXIRGI DARS KUNI, har bir o'quvchi
// kimga o'tgani). Shu oyda ESKI USTOZ NOMIGA yozilgan har bir to'lov (va
// qaytarim) bo'linadi:
//     eski ustozga  — summa × oxirgi kun / oy kunlari   (20/30)
//     yangi ustozga — summa × qolgan kunlar / oy kunlari (10/30)
// Har kim O'Z foizini o'z qismiga oladi. Yangi ustoz ko'rsatilmagan o'quvchida
// (hech qaysi guruhda emas) qolgan qism hech kimga o'tmaydi — markazda qoladi.
// To'lov qachon kiritilgani ahamiyatsiz: sentabr to'lovi butun sentabr uchun.
//
// NIMA O'ZGARMAYDI: kassa, jurnal, o'quvchi balansi — to'lov yozuvlariga
// umuman tegilmaydi. Bu faqat oylik hisobidagi taqsimot.

export const TEACHER_HANDOVERS = "teacher_handovers";

export interface HandoverPupil {
  /** `pupils.id`; eski yozuvlarda ID bo'lmasa — ism bo'yicha. */
  pupilId: number | null;
  name: string;
  /** Qolgan kunlar kimga — xodim ismi; `null` — hech kimga (markazda qoladi). */
  toTeacher: string | null;
}

export interface TeacherHandover {
  /** "YYYY-MM" — qaysi oyning to'lovlari bo'linadi. */
  month: string;
  /** Eski ustoz — to'lovlardagi `teacherName` bilan bir xil ism. */
  fromTeacher: string;
  /** `nameKey(fromTeacher)` — qidiruv kaliti (unikal: month + fromKey). */
  fromKey: string;
  /** Eski ustozning OXIRGI dars kuni, "YYYY-MM-DD" — shu kun ham unga. */
  lastDay: string;
  pupils: HandoverPupil[];
  updatedAt: string;
  updatedBy: string;
  /**
   * "Almashuv yo'q" — Oylik sahifasidagi eslatma (o'quvchilari boshqa ustoz
   * guruhida) shu oy uchun yashirilgan. Bunday yozuvda `pupils` bo'sh va
   * HISOBGA TA'SIR QILMAYDI; haqiqiy almashuv saqlansa bu bayroq o'chadi.
   */
  dismissed?: boolean;
}

/** Oylik manbalari bilan bir xil ism kaliti: chetidagi probel va harf kattaligi farqlanmaydi. */
export function handoverNameKey(v: unknown): string {
  return String(v ?? "").trim().toLowerCase();
}

/** "YYYY-MM" dagi kunlar soni; noto'g'ri kalitda 0. */
export function daysInMonthKey(month: string): number {
  const m = /^(\d{4})-(\d{2})$/.exec(month);
  if (!m) return 0;
  return new Date(Number(m[1]), Number(m[2]), 0).getDate();
}

/**
 * Bo'linish nisbati. `oldDays` — oy boshidan oxirgi dars kunigacha (shu kun
 * ham), `newDays` — qolgani. Oxirgi kun oydan tashqarida bo'lsa — bo'linmaydi.
 */
export function handoverRatio(h: Pick<TeacherHandover, "month" | "lastDay">): {
  oldDays: number;
  newDays: number;
  daysIn: number;
  old: number;
} {
  const daysIn = daysInMonthKey(h.month);
  const m = /^(\d{4}-\d{2})-(\d{2})$/.exec(h.lastDay ?? "");
  if (!daysIn || !m || m[1] !== h.month) return { oldDays: daysIn, newDays: 0, daysIn, old: 1 };
  const oldDays = Math.min(Math.max(Number(m[2]), 0), daysIn);
  return { oldDays, newDays: daysIn - oldDays, daysIn, old: oldDays / daysIn };
}

export interface HandoverMatch {
  handover: TeacherHandover;
  pupil: HandoverPupil;
}

/** Tez qidiruv uchun indeks: eski ustoz + o'quvchi (ID, bo'lmasa ism). */
export type HandoverIndex = Map<string, HandoverMatch>;

export function buildHandoverIndex(handovers: TeacherHandover[]): HandoverIndex {
  const index: HandoverIndex = new Map();
  for (const h of handovers) {
    const from = handoverNameKey(h.fromTeacher);
    for (const p of h.pupils ?? []) {
      if (p.pupilId != null) index.set(`${h.month}|${from}|p:${p.pupilId}`, { handover: h, pupil: p });
      const nk = handoverNameKey(p.name);
      if (nk) index.set(`${h.month}|${from}|n:${nk}`, { handover: h, pupil: p });
    }
  }
  return index;
}

/**
 * Yozuvga tegishli almashuv. ID bo'yicha, ID yo'q bo'lsa ism bo'yicha — lekin
 * ID si BOR yozuv ism bo'yicha tutilmaydi (ismdosh o'quvchi adashib bo'linmasin).
 */
export function handoverFor(
  index: HandoverIndex,
  month: string,
  entry: { teacherName?: unknown; pupilId?: unknown; studentName?: unknown },
): HandoverMatch | null {
  if (index.size === 0) return null;
  const from = handoverNameKey(entry.teacherName);
  if (!from) return null;
  const pid = Number(entry.pupilId);
  if (entry.pupilId != null && Number.isFinite(pid)) {
    return index.get(`${month}|${from}|p:${pid}`) ?? null;
  }
  const nk = handoverNameKey(entry.studentName);
  return nk ? index.get(`${month}|${from}|n:${nk}`) ?? null : null;
}

/** Shu oyning almashuvlari (yashirilgan eslatma yozuvlari hisobga kirmaydi). */
export async function loadHandovers(db: Db, month: string): Promise<TeacherHandover[]> {
  return db
    .collection<TeacherHandover>(TEACHER_HANDOVERS)
    .find({ month, dismissed: { $ne: true } }, { projection: { _id: 0 } })
    .toArray() as Promise<TeacherHandover[]>;
}

export type { PayrollHandover } from "@/lib/salary";
