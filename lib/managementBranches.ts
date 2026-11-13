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
  /**
   * FILIALNING ISH VAQTI (23-qism, 13.11.2026) — binoning ochiq soatlari ("HH:MM").
   * Xodimning `workStart` idan BOSHQA narsa: bu dars jadvali va xonalar bandligi
   * (haftalik soat) shu oraliqda hisoblanadi. Yo'q bo'lsa — BRANCH_HOURS_DEFAULT.
   */
  openFrom?: string | null;
  openTo?: string | null;
  /** Ish kunlari: 1 = Dushanba … 7 = Yakshanba. Yo'q bo'lsa — Du–Sha. */
  workDays?: number[] | null;
}

/** Ish vaqti kiritilmagan filial uchun sukut (rasmdagi «Du–Sha · 08:00–22:00»). */
export const BRANCH_HOURS_DEFAULT = { from: "08:00", to: "22:00", days: [1, 2, 3, 4, 5, 6] } as const;

export const WEEKDAY_SHORT = ["Du", "Se", "Chor", "Pa", "Ju", "Sha", "Ya"] as const;

export interface BranchHours {
  from: string;
  to: string;
  days: number[];
  /** Filialda o'zi kiritilganmi (yo'q bo'lsa — sukut). */
  custom: boolean;
}

/** Filialning ish vaqti — kiritilmagan qismlar sukutdan. */
export function branchHours(b: Pick<ManagementBranch, "openFrom" | "openTo" | "workDays"> | null | undefined): BranchHours {
  const from = b?.openFrom || BRANCH_HOURS_DEFAULT.from;
  const to = b?.openTo || BRANCH_HOURS_DEFAULT.to;
  const days = b?.workDays?.length ? [...b.workDays].sort((x, y) => x - y) : [...BRANCH_HOURS_DEFAULT.days];
  return { from, to, days, custom: !!(b?.openFrom || b?.openTo || b?.workDays?.length) };
}

function toMin(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

/** Haftalik ochiq daqiqalar (bandlik foizining maxraji): kunlik oraliq × ish kunlari. */
export function weeklyOpenMinutes(h: BranchHours): number {
  return Math.max(0, toMin(h.to) - toMin(h.from)) * h.days.length;
}

/** «Du–Sha», «Du, Chor, Ju», «Har kuni» — ketma-ket kunlar chiziqcha bilan. */
export function workDaysLabel(days: readonly number[]): string {
  const d = [...new Set(days)].filter((x) => x >= 1 && x <= 7).sort((a, b) => a - b);
  if (d.length === 7) return "Har kuni";
  if (d.length === 0) return "—";
  const runs: number[][] = [];
  for (const x of d) {
    const last = runs[runs.length - 1];
    if (last && x === last[last.length - 1] + 1) last.push(x);
    else runs.push([x]);
  }
  return runs
    .map((r) => (r.length >= 3 ? `${WEEKDAY_SHORT[r[0] - 1]}–${WEEKDAY_SHORT[r[r.length - 1] - 1]}` : r.map((x) => WEEKDAY_SHORT[x - 1]).join(", ")))
    .join(", ");
}

/**
 * Filialning to'liq manzil qatori (ro'yxat, chek): hudud + aniq manzil. Yangi
 * formada (23-qism) «Manzil» bitta maydon — `address` ga to'liq yoziladi
 * («Uchqo'rg'on, Eski Agro sug'urta»); eski yozuvlarda hudud (`location`) va
 * aniq manzil alohida — takrorlanmasin deb hudud manzilda bo'lsa qo'shilmaydi.
 */
export function branchAddressLine(b: Pick<ManagementBranch, "location" | "address">): string {
  const loc = (b.location || "").trim();
  const addr = (b.address || "").trim();
  if (!addr) return loc;
  if (!loc || addr.toLowerCase().includes(loc.toLowerCase())) return addr;
  return `${loc}, ${addr}`;
}

/** Telefon — oxirgi 9 raqam («941118855»); yo'q bo'lsa bo'sh. */
export function branchPhoneDigits(phone: string | null | undefined): string {
  return String(phone ?? "").replace(/\D/g, "").slice(-9);
}

export type OpenHoursParse =
  | { ok: true; value: { openFrom: string | null; openTo: string | null } }
  | { ok: false; error: string };

/** Ish vaqti: ikkalasi bo'sh (→ sukut) yoki ikkalasi "HH:MM", tugashi boshlanishidan keyin. */
export function parseOpenHours(fromRaw: unknown, toRaw: unknown): OpenHoursParse {
  const f = parseWorkStart(fromRaw);
  const t = parseWorkStart(toRaw);
  if (!f.ok || !t.ok) return { ok: false, error: "Ish vaqti SS:DD ko'rinishida bo'lsin (masalan 08:00)" };
  if (!f.value && !t.value) return { ok: true, value: { openFrom: null, openTo: null } };
  if (!f.value || !t.value) return { ok: false, error: "Ish vaqtining boshlanishi va tugashini kiriting" };
  if (toMin(t.value) <= toMin(f.value)) return { ok: false, error: "Ish vaqti tugashi boshlanishidan keyin bo'lsin" };
  return { ok: true, value: { openFrom: f.value, openTo: t.value } };
}

export type WorkDaysParse = { ok: true; value: number[] | null } | { ok: false; error: string };

/** Ish kunlari: 1–7 sonlar ro'yxati; bo'sh/berilmagan — null (sukut Du–Sha). */
export function parseWorkDays(raw: unknown): WorkDaysParse {
  if (raw === null || raw === undefined || raw === "") return { ok: true, value: null };
  if (!Array.isArray(raw)) return { ok: false, error: "Ish kunlari noto'g'ri" };
  const days = [...new Set(raw.map(Number))].sort((a, b) => a - b);
  if (days.some((d) => !Number.isInteger(d) || d < 1 || d > 7)) return { ok: false, error: "Ish kunlari noto'g'ri" };
  if (days.length === 0) return { ok: false, error: "Kamida bitta ish kunini tanlang" };
  return { ok: true, value: days };
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
