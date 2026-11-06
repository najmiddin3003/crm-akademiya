import type { Db } from "mongodb";

// «ISHGA KELDIM / ISHDAN KETDIM» URINISHLARI JURNALI (06.11.2026).
//
// NEGA KERAK: «filialdan uzoqdasiz» xatosi tekshirilganda rad etilgan urinishdan
// hech qanday iz topilmadi — nginx'da faqat 403 turardi, `turnstile_io` ga faqat
// muvaffaqiyat yoziladi, telefonda joylashuv o'qilmasa so'rov umuman kelmasdi.
// Xodim «ishlamadi» desa, endi qaysi telefon, qaysi manba (Telegram keshi, tarmoq,
// GPS), qancha aniqlik va qaysi filialgacha necha metr bo'lgani ko'rinadi.
//
// Faqat kuzatuv uchun: hech narsa bu jurnalga qarab qaror qilmaydi. Ekran yo'q,
// skript bilan o'qiladi. 60 kundan keyin Mongo o'zi o'chiradi (lib/mongodb.ts,
// yuz urinishlari bilan bir xil muddat): nuqta — xodim joylashuvi, uzoq turmasin.

export const ATTENDANCE_ATTEMPTS = "attendance_attempts";

/** Mini App aytgan ma'lumot — serverda tekshirilgan, qarorga ta'sir qilmaydi. */
export interface AttemptClientMeta {
  /** "telegram" | "network" | "gps". */
  source: string | null;
  /** Qurilma o'lchagandan beri o'tgan vaqt, ms; Telegram aytmaydi. */
  ageMs: number | null;
  /** Shu bosishdagi nechanchi o'qish (1 dan). */
  tryNo: number | null;
  /** Telegram.WebApp.platform. */
  platform: string | null;
  /** Telefonda joylashuv olinmagan bo'lsa — sababi ("denied" | "unavailable" | "timeout"). */
  locError: string | null;
}

export interface AttendanceAttempt extends AttemptClientMeta {
  at: Date;
  employeeId: number;
  name: string;
  kind: "in" | "out";
  ok: boolean;
  /** true — shu urinish yozdi; false — bugun allaqachon belgilangan edi. */
  fresh: boolean | null;
  /** Rad kodi (too_far, location_inaccurate, location_required, face_required …). */
  code: string | null;
  error: string | null;
  loc: { lat: number; lng: number; acc: number | null } | null;
  /** Qabul qilingan yoki eng yaqin filial. */
  branchId: number | null;
  distanceM: number | null;
}

/** HECH QACHON OTILMAYDI: jurnal yozilmasa ham belgilash ishlayveradi. */
export async function logAttendanceAttempt(db: Db, row: AttendanceAttempt): Promise<void> {
  try {
    await db.collection<AttendanceAttempt>(ATTENDANCE_ATTEMPTS).insertOne({ ...row });
  } catch (e) {
    console.warn("[attendance] urinish jurnalga yozilmadi:", e instanceof Error ? e.message : e);
  }
}
