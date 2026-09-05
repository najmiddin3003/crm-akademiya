import { CUSTOMER_TYPES } from "@/constants/transactionTypes";

// Kassa oynalarida tranzaksiya turiga qarab pastda KIM tanlanishi
// aniqlanadi.
//
// NIMA NOTO'G'RI EDI: bu yerda faqat turning NOMIGA qaralardi — nomda
// "xodim"/"hodim" bo'lsa xodimlar, "o'quvchi" bo'lsa o'quvchilar. Amalda:
//
//   "Oylik ish haqi — admin/xodim"  -> "xodim" bor    -> ishlardi
//   "Oylik ish haqi — o'qituvchi"   -> "xodim" YO'Q   -> tanlov CHIQMASDI
//   "Avans"                          -> "xodim" YO'Q   -> tanlov CHIQMASDI
//   "KPI bonusi (…o'quvchi saqlash)" -> "o'quvchi" bor -> O'QUVCHILAR chiqardi
//
// Ya'ni bir xil ma'nodagi to'rt tur to'rt xil ishlardi va xodimga avans
// berilganda yozuv EGASIZ qolardi — u hech kimning oylik hisobiga
// tushmasdi, oddiy xarajat bo'lib qolardi.
//
// Javob esa bazada bor edi: Sozlamalar -> Tranzaksiya turi formasidagi
// "Mijoz" maydoni (`transaction_types.customerType`). Endi asosiy manba shu.
//
// ──────────────────────────────────────────────────────────────────
// KO'P TANLOV (2026-09-05, markaz so'rovi)
//
// "Mijoz" endi BITTA emas, bir nechta bo'lishi mumkin — formada
// katakchalar (checkbox). Sabab hayotdan: "Kurs to'lovi (oylik)" da pulni
// O'QUVCHI to'laydi, lekin uning foizi O'QITUVCHI oyligiga tushadi, ya'ni
// oynada ikkala tanlov ham kerak. "Imtihon to'lovi" da esa faqat o'quvchi.
// Bitta qiymat bu farqni ifodalay olmasdi.
//
// SAQLASH SHAKLI: `customerType` — endi RO'YXAT (`string[]`). Eski
// hujjatlarda u satr bo'lib qolgan va o'qishda bir elementli ro'yxatga
// keltiriladi. Maydon NOMI ataylab o'zgarmadi: Mongo tenglik shartini
// massiv elementiga ham qo'llaydi, ya'ni
// app/api/salary-runs/route.ts dagi `{ customerType: "Xodim" }` so'rovi
// ikkala shaklda ham ishlayveradi. Yangi nom qo'yilsa o'sha so'rov
// jimgina bo'sh qaytarardi — oylik hisobi buzilardi.

export type TxTarget = "employee" | "student" | null;

/** `transaction_types.customerType` — eski (satr) yoki yangi (ro'yxat) shakl. */
export type CustomerTypeField = string | string[] | null | undefined;

/** Katakcha qiymatlari — constants/transactionTypes.js dagi CUSTOMER_TYPES. */
const STUDENT = "o'quvchilar";
const EMPLOYEE = "xodim";
const THIRD = "uchinchi shaxs";

/** Apostrof variantlarini (’ ‘ ` ´) oddiy ' ga keltiradi va kichik harfga o'giradi. */
function normalize(s: string): string {
  return s.toLowerCase().replace(/[‘’ʼ`´]/g, "'").trim();
}

/**
 * Tur NOMIDAGI kalit so'z bo'yicha — ZAXIRA yo'l.
 *
 * "Mijoz" maydoni UMUMAN to'ldirilmagan turlar uchun qoladi: yangi tur
 * qo'shishda u majburiy emas (app/api/transaction-types/route.ts bo'sh
 * ro'yxat yozadi). Ya'ni admin ertaga "Xodimga qarz" turini qo'shib,
 * Mijozga tegmasa, tanlov baribir chiqadi va bugungi xato qaytadan
 * tug'ilmaydi.
 */
export function targetOfName(category: string): TxTarget {
  const n = normalize(category);
  // "o'quvchi" birinchi tekshiriladi: nomda ikkalasi ham uchrasa
  // (masalan "o'quvchidan xodimga o'tkazma") o'quvchi ustun bo'lsin.
  if (n.includes("o'quvchi") || n.includes("oquvchi")) return "student";
  if (n.includes("hodim") || n.includes("xodim")) return "employee";
  return null;
}

/**
 * Turga belgilangan "Mijoz" katakchalari — bitta o'qilgan holat.
 *
 * `unset` — maydon UMUMAN bo'sh, ya'ni "qaror qilinmagan". Bu "Boshqa" dan
 * FARQ QILADI: "Boshqa" — ONGLI tanlov ("bu pul hech kimga biriktirilmaydi"),
 * bo'sh ro'yxat esa shunchaki to'ldirilmagan va nomga qaytariladi.
 * Farqni yo'qotish qimmatga tushardi — pastdagi `isThirdParty` izohiga qarang.
 */
export interface TxAudience {
  /** O'quvchi tanlovi ko'rsatilsinmi. */
  student: boolean;
  /** Xodim (Kirim oynasida — o'qituvchi) tanlovi ko'rsatilsinmi. */
  employee: boolean;
  /** "Uchinchi shaxs" — pul odamga bog'liq emas (masalan "Kitob sotuvi"). */
  thirdParty: boolean;
  /** Maydon to'ldirilmagan — chaqiruvchi o'z zaxira yo'lini tanlaydi. */
  unset: boolean;
}

const NO_AUDIENCE: TxAudience = { student: false, employee: false, thirdParty: false, unset: false };

export function txAudience(
  type: { name?: string; customerType?: CustomerTypeField } | null | undefined,
): TxAudience {
  if (!type) return NO_AUDIENCE;
  const raw = type.customerType;
  const list = (Array.isArray(raw) ? raw : [raw])
    .map((x) => normalize(String(x ?? "")))
    .filter((x) => x !== "");

  if (list.length === 0) {
    // Nomga qaytamiz. `unset: true` bilan qaytariladi — chaqiruvchi
    // "sozlanmagan" holatni "hech kim" dan ajrata olishi uchun.
    const t = targetOfName(type.name ?? "");
    return { student: t === "student", employee: t === "employee", thirdParty: false, unset: true };
  }

  return {
    student: list.includes(STUDENT),
    employee: list.includes(EMPLOYEE),
    thirdParty: list.includes(THIRD),
    unset: false,
  };
}

/**
 * BITTA tanlov maydoni bo'lgan oyna uchun (Chiqim — CashboxAdjustDrawer).
 * `null` — bu tur uchun umuman tanlov ko'rsatilmaydi.
 *
 * IKKALASI belgilangan bo'lsa XODIM ustun turadi. Sabab: chiqimda xodimga
 * ketgan pul oylik hisobiga ulanadi (lib/payrollSources.ts,
 * app/api/salary-runs) va o'sha bog'lanish yo'qolsa pul jimgina oddiy
 * xarajatga aylanadi — bu fayl aynan shu xatoni tuzatish uchun yozilgan.
 * O'quvchiga ketgan chiqimda (bonus, chegirma) bunday pastki hisob yo'q.
 *
 * Kirim oynasida ikkala tanlov ham bir vaqtda chiqadi, shu bois u bu
 * funksiyani emas, `txAudience` ni ishlatadi.
 */
export function txTarget(
  type: { name?: string; customerType?: CustomerTypeField } | null | undefined,
): TxTarget {
  const a = txAudience(type);
  if (a.employee) return "employee";
  if (a.student) return "student";
  return null;
}

/** Tanlov maydonining sarlavhasi. */
export function txTargetLabel(target: TxTarget): string {
  return target === "employee" ? "Xodimni tanlang" : "O'quvchini tanlang";
}

/**
 * Tur ONGLI ravishda "Uchinchi shaxs" deb belgilanganmi.
 *
 * NEGA `txTarget(...) === null` YETMAYDI: u IKKI boshqa-boshqa holatni
 * bitta `null` ga qorishtiradi:
 *
 *   "Uchinchi shaxs" — ONGLI tanlov: bu pul odamga bog'liq emas
 *                      (masalan "Kitob sotuvi").
 *   bo'sh / "Boshqa" — hech kim tanlanmaydi, lekin sababi boshqa.
 *
 * Farq muhim, chunki bu bayroq Kirim oynasida bitta "Qiymat" maydonini
 * (Qiymat + Oy) QATORLARIGA almashtiradi.
 */
export function isThirdParty(
  type: { customerType?: CustomerTypeField } | null | undefined,
): boolean {
  return txAudience(type).thirdParty;
}

/**
 * Klientdan kelgan "Mijoz" qiymatini tozalaydi: faqat tanish katakchalar,
 * takrorsiz, CUSTOMER_TYPES tartibida.
 *
 * `undefined` — maydon so'rovda umuman kelmagan (PATCH uni o'zgartirmaydi).
 * Bo'sh ro'yxat — ATAYLAB bo'sh (yuqoridagi `unset`).
 */
export function sanitizeCustomerTypes(raw: unknown): string[] | undefined {
  if (raw === undefined) return undefined;
  const list = Array.isArray(raw) ? raw : [raw];
  const picked = new Set(list.map((x) => normalize(String(x ?? ""))));
  return (CUSTOMER_TYPES as string[]).filter((c) => picked.has(normalize(c)));
}
