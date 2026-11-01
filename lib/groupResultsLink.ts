import crypto from "node:crypto";

// GURUH NATIJALARI HAVOLASI (01.11.2026, foydalanuvchi: «har bir guruh uchun alohida url link
// yaratsin») — /natijalar/<guruh id>-<imzo>. Havolani faqat Sarhisob'ni ko'ra oladigan xodim
// oladi (GET /api/imtihon/group javobidagi `linkKey`); o'quvchi raqamni o'zgartirib boshqa
// guruhni ochib bo'lmaydi — imzo mos kelmaydi.
//
// Imzo — SESSION_SECRET dan ajratilgan kalit bilan HMAC (lib/staffFace.ts dagi kabi, alohida
// o'zgaruvchi shart emas). Bazaga hech narsa yozilmaydi: havola guruh o'chirilgan bo'lsa ham
// ishlaydi; SESSION_SECRET almashsa eski havolalar ochilmay qoladi (yangisini nusxalash kerak).
// FAQAT SERVERDA (node:crypto) — mijoz komponentlariga import qilinmasin.

function linkSecret(): Buffer {
  const base = process.env.SESSION_SECRET || "dev-insecure-session-secret-change-me";
  return crypto.createHmac("sha256", base).update("natijalar/v1").digest();
}

/** 12 belgi base64url = 72 bit — taxmin qilib topib bo'lmaydi, havola esa qisqa qoladi. */
const sigOf = (groupId: number) => crypto.createHmac("sha256", linkSecret()).update(`guruh:${groupId}`).digest("base64url").slice(0, 12);

/** Guruh havolasining kaliti: "7-Xk3P9aQ2b_Lm". */
export function groupResultsKey(groupId: number): string {
  return `${groupId}-${sigOf(groupId)}`;
}

/** Havoladagi kalit → guruh id; imzo mos kelmasa yoki shakli noto'g'ri — `null`. */
export function parseGroupResultsKey(raw: string): number | null {
  const m = /^([1-9]\d{0,8})-([A-Za-z0-9_-]{12})$/.exec(raw);
  if (!m) return null;
  const groupId = Number(m[1]);
  const a = Buffer.from(sigOf(groupId));
  const b = Buffer.from(m[2]);
  return a.length === b.length && crypto.timingSafeEqual(a, b) ? groupId : null;
}

/** API javobidagi sarhisobga havola kaliti qo'shiladi (bazaga YOZILMAYDI). */
export function withLinkKey<T extends { groupId: number }>(exam: T): T & { linkKey: string } {
  return { ...exam, linkKey: groupResultsKey(exam.groupId) };
}
