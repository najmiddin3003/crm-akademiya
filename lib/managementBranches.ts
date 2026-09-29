// Boshqaruv → Filiallar (sidebar: Boshqaruv > Filiallar, href
// /management-filiallar). MongoDB `branches` kolleksiyasi.
//
// Nazorat → "Filiallar holati" (lib/branches.ts) bilan aralashtirmang: u
// filiallar bo'yicha METRIKA hisoboti, bu esa filiallarning o'zini
// boshqaradigan ro'yxat (qo'shish/tahrirlash/o'chirish).
export interface ManagementBranch {
  id: number;
  name: string;
  location: string; // o'ngda ko'rinadigan manzil/shahar — bo'sh bo'lishi mumkin
  /**
   * Ommaviy ish arizasi (/ariza) nomzodga ko'rsatadigan aniq manzil
   * ("Temur kafe, 2-qavat") va filial telefoni. Ixtiyoriy — bo'sh bo'lsa
   * anketa `location` va bosh raqamni ko'rsatadi (constants/managementCv.js
   * CV_MAIN_PHONE). Boshqaruv → Filiallar formasidan to'ldiriladi.
   */
  address?: string;
  phone?: string;
  /**
   * Telegram "Lidlar" guruhidagi SHU FILIALNING topigi (`message_thread_id`).
   * Yangi lid qaysi filialda qo'shilsa, xabar o'sha topikka tushadi
   * (lib/leadNotify.ts). Yo'q bo'lsa — `TELEGRAM_TOPIC_LEADS` (umumiy topik),
   * u ham bo'sh bo'lsa xabar yuborilmaydi.
   *
   * NEGA BAZADA, MUHIT O'ZGARUVCHISIDA EMAS: bu filialning o'z xususiyati —
   * filial qo'shilganda topik ham shu yerda biriktiriladi, serverga kirib
   * .env tahrirlash va qayta ishga tushirish shart emas.
   */
  leadTopicId?: number | null;
  /**
   * To'lovlar guruhidagi SHU FILIALNING topigi — o'quvchi to'lovi (va uning
   * bekor qilinishi) shu yerga tushadi (lib/sync/dispatch.ts). Filial
   * to'lovning KASSASI orqali aniqlanadi (`cashboxes.branchId`), kassir
   * ismi orqali emas. Yo'q bo'lsa — `TELEGRAM_TOPIC_PAYMENTS` (umumiy
   * "To'lovlar" topigi) — ya'ni to'lov hech qachon yo'qolmaydi, faqat
   * umumiy topikka tushadi.
   */
  paymentTopicId?: number | null;
  /**
   * «Ishga keldim» (QR, 28.09.2026) — KECHIKKAN xodim haqidagi xabar shu
   * topikka tushadi (lib/attendanceNotify.ts). Yo'q bo'lsa
   * `TELEGRAM_TOPIC_ATTENDANCE`, u ham bo'lmasa yuborilmaydi.
   */
  attendanceTopicId?: number | null;
  /**
   * Ish boshlanish vaqti ("HH:MM") — O'QITUVCHI BO'LMAGAN xodimning
   * kechikishi shundan o'lchanadi (o'qituvchiniki — birinchi darsidan,
   * lib/attendanceCheck.ts). Yo'q bo'lsa ular uchun kechikish o'lchanmaydi.
   */
  workStart?: string | null;
  /** Ish boshlanishidan keyin necha daqiqagacha kechikish hisoblanmaydi (0–180). */
  lateGraceMin?: number | null;
  /**
   * Filial binosining joylashuvi (29.09.2026) — «Ishga keldim» skanerlashi
   * shundan `geoRadiusM` ichida bo'lishi shart (lib/attendanceCheck.ts).
   * Yo'q bo'lsa joylashuv tekshirilmaydi (faqat yoziladi).
   */
  geo?: { lat: number; lng: number } | null;
  /** Ruxsat etilgan radius, m (30–2000; bo'sh — 200). */
  geoRadiusM?: number | null;
}

export type RadiusParse = { ok: true; value: number | null } | { ok: false; error: string };

/** Radius (m): 30–2000 butun son yoki bo'sh (→ null, ya'ni sukut 200). */
export function parseGeoRadius(raw: unknown): RadiusParse {
  const s = String(raw ?? "").trim();
  if (!s) return { ok: true, value: null };
  const n = Number(s);
  if (!/^\d+$/.test(s) || n < 30 || n > 2000) {
    return { ok: false, error: "Radius — 30 dan 2000 metrgacha" };
  }
  return { ok: true, value: n };
}

/** Filial hujjatidagi Telegram topik maydonlari — API va sahifa shu ro'yxat bo'ylab aylanadi. */
export const BRANCH_TOPIC_FIELDS = ["leadTopicId", "paymentTopicId", "attendanceTopicId"] as const;
export type BranchTopicField = (typeof BRANCH_TOPIC_FIELDS)[number];

export type WorkStartParse = { ok: true; value: string | null } | { ok: false; error: string };

/** Formadagi ish boshlanish vaqti: "9:00" / "09:00" / bo'sh (olib tashlash → null). */
export function parseWorkStart(raw: unknown): WorkStartParse {
  const s = String(raw ?? "").trim();
  if (!s) return { ok: true, value: null };
  const m = /^(\d{1,2}):(\d{2})$/.exec(s);
  if (!m || Number(m[1]) > 23 || Number(m[2]) > 59) {
    return { ok: false, error: "Ish boshlanish vaqti SS:DD ko'rinishida bo'lsin (masalan 08:30)" };
  }
  return { ok: true, value: `${m[1].padStart(2, "0")}:${m[2]}` };
}

export type GraceParse = { ok: true; value: number | null } | { ok: false; error: string };

/** Ruxsat etilgan kechikish (daqiqa): 0–180 butun son yoki bo'sh (→ null). */
export function parseLateGrace(raw: unknown): GraceParse {
  const s = String(raw ?? "").trim();
  if (!s) return { ok: true, value: null };
  if (!/^\d+$/.test(s) || Number(s) > 180) {
    return { ok: false, error: "Ruxsat etilgan kechikish — 0 dan 180 gacha daqiqa" };
  }
  const n = Number(s);
  return { ok: true, value: n > 0 ? n : null };
}

export type LeadTopicParse = { ok: true; value: number | null } | { ok: false; error: string };

/**
 * Formadan kelgan topik qiymatini tozalaydi.
 *
 * Qabul qilinadi: musbat butun son ("45"), Telegram topik havolasi
 * (`https://t.me/c/2345678901/45` yoki `.../45/120` — o'rtadagi son topik)
 * yoki bo'sh qiymat (topik olib tashlanadi → null).
 *
 * Havola qabul qilinishining sababi: Bot API topiklar ro'yxatini bermaydi,
 * odam topik raqamini eng oson Telegram'dagi "Copy Link" orqali topadi —
 * o'sha havolani to'g'ridan-to'g'ri qo'yib qo'yish raqamni ko'chirib
 * o'tirishdan xatosizroq.
 */
export function parseLeadTopicId(raw: unknown): LeadTopicParse {
  if (raw === null || raw === undefined) return { ok: true, value: null };
  const s = String(raw).trim();
  if (!s) return { ok: true, value: null };

  const link = /t\.me\/c\/\d+\/(\d+)/.exec(s);
  const digits = link ? link[1] : s;
  if (!/^\d+$/.test(digits)) {
    return { ok: false, error: "Telegram topigi — musbat butun son yoki topik havolasi bo'lishi kerak" };
  }
  const n = Number(digits);
  if (!Number.isSafeInteger(n)) return { ok: false, error: "Telegram topik raqami juda katta" };
  // 0 — "topik yo'q" degani (Telegram'da topik raqami hech qachon 0 bo'lmaydi).
  return { ok: true, value: n > 0 ? n : null };
}
