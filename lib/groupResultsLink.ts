import crypto from "node:crypto";

// GURUH NATIJALARI HAVOLASI (01.11.2026, foydalanuvchi: «har bir guruh uchun alohida url link
// yaratsin») — /natijalar/<guruh id>-<imzo>. Havolani faqat Sarhisob'ni ko'ra oladigan xodim
// oladi (GET /api/imtihon/group javobidagi `linkKey`); o'quvchi raqamni o'zgartirib boshqa
// guruhni ochib bo'lmaydi — imzo mos kelmaydi.
//
// MARKAZ REYTINGI HAVOLASI (01.11.2026, foydalanuvchi: «markaz bo'yicha reytingni ulashish») —
// /natijalar/markaz/<filial id>-<qismlar>-<imzo>: shu filialning (hovuzda — hovuzning) oylik
// reytingi; <qismlar> — «Ulashish» oynasida belgilangan qismlar (lib/centerShare.ts, 36-lik son).
// Imzo filial VA qismlarni birga qamraydi — yashirilgan qismni manzildan ochib bo'lmaydi. Kalitni
// GET /api/imtihon/group/center-link beradi. Imzo boshqa nom bilan («markaz:») — guruh kalitini
// reyting havolasiga (yoki aksincha) qo'yib bo'lmaydi.
//
// Imzo — SESSION_SECRET dan ajratilgan kalit bilan HMAC (lib/staffFace.ts dagi kabi, alohida
// o'zgaruvchi shart emas). Bazaga hech narsa yozilmaydi: havola guruh o'chirilgan bo'lsa ham
// ishlaydi; SESSION_SECRET almashsa eski havolalar ochilmay qoladi (yangisini nusxalash kerak).
// FAQAT SERVERDA (node:crypto) — mijoz komponentlariga import qilinmasin.

function linkSecret(): Buffer {
  const base = process.env.SESSION_SECRET || "dev-insecure-session-secret-change-me";
  return crypto.createHmac("sha256", base).update("natijalar/v1").digest();
}

type LinkKind = "guruh" | "markaz";

/**
 * 12 belgi base64url = 72 bit — taxmin qilib topib bo'lmaydi, havola esa qisqa qoladi.
 * Guruh: «guruh:<id>» (01.11 dan tarqatilgan havolalar — o'zgarmasin), markaz: «markaz:<filial>:<qismlar>».
 */
const sigOf = (kind: LinkKind, payload: string) => crypto.createHmac("sha256", linkSecret()).update(`${kind}:${payload}`).digest("base64url").slice(0, 12);

function sigMatches(kind: LinkKind, payload: string, sig: string): boolean {
  const a = Buffer.from(sigOf(kind, payload));
  const b = Buffer.from(sig);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

/** Guruh havolasining kaliti: "7-Xk3P9aQ2b_Lm". */
export function groupResultsKey(groupId: number): string {
  return `${groupId}-${sigOf("guruh", String(groupId))}`;
}

/** Havoladagi kalit → guruh id; imzo mos kelmasa yoki shakli noto'g'ri — `null`. */
export function parseGroupResultsKey(raw: string): number | null {
  const m = /^([1-9]\d{0,8})-([A-Za-z0-9_-]{12})$/.exec(raw);
  if (!m) return null;
  const groupId = Number(m[1]);
  return sigMatches("guruh", String(groupId), m[2]) ? groupId : null;
}

/** Markaz reytingi havolasining kaliti: "1-77-Qw8…" — filial, ko'rinadigan qismlar (`mask`), imzo. */
export function centerResultsKey(branchId: number, mask: number): string {
  return `${branchId}-${mask.toString(36)}-${sigOf("markaz", `${branchId}:${mask}`)}`;
}

/** Reyting havolasidagi kalit → filial va qismlar; imzo mos kelmasa yoki shakli noto'g'ri — `null`. */
export function parseCenterResultsKey(raw: string): { branchId: number; mask: number } | null {
  const m = /^([1-9]\d{0,8})-([0-9a-z]{1,3})-([A-Za-z0-9_-]{12})$/.exec(raw);
  if (!m) return null;
  const branchId = Number(m[1]);
  const mask = parseInt(m[2], 36);
  // Bitta qiymat — bitta yozuv ("0f" va "f" ikki xil havola bo'lmasin).
  if (mask.toString(36) !== m[2]) return null;
  return sigMatches("markaz", `${branchId}:${mask}`, m[3]) ? { branchId, mask } : null;
}

/** API javobidagi sarhisobga havola kaliti qo'shiladi (bazaga YOZILMAYDI). */
export function withLinkKey<T extends { groupId: number }>(exam: T): T & { linkKey: string } {
  return { ...exam, linkKey: groupResultsKey(exam.groupId) };
}
