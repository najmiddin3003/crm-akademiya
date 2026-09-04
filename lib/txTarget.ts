// Kassa Chiqim oynasida tranzaksiya turiga qarab pastda KIM tanlanishi
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
// "Mijoz" maydoni (`transaction_types.customerType`), va u 51 turning
// HAMMASIDA to'ldirilgan. Endi asosiy manba shu.

export type TxTarget = "employee" | "student" | null;

/** Apostrof variantlarini (’ ‘ ` ´) oddiy ' ga keltiradi va kichik harfga o'giradi. */
function normalize(s: string): string {
  return s.toLowerCase().replace(/[‘’ʼ`´]/g, "'").trim();
}

/**
 * Tur NOMIDAGI kalit so'z bo'yicha — ZAXIRA yo'l.
 *
 * "Mijoz" maydoni to'ldirilmagan turlar uchun qoladi: yangi tur qo'shishda
 * u majburiy emas va standart qiymati "Boshqa"
 * (app/api/transaction-types/route.ts -> `body.customerType || "Boshqa"`).
 * Ya'ni admin ertaga "Xodimga qarz" turini qo'shib, Mijozga tegmasa,
 * tanlov baribir chiqadi va bugungi xato qaytadan tug'ilmaydi.
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
 * "Mijoz" maydoni bo'yicha (constants/transactionTypes.js -> CUSTOMER_TYPES).
 *
 * `undefined` — "maydon qaror qilmadi, nomga qayt";
 * `null`      — "ATAYLAB hech kim tanlanmaydi".
 *
 * Farqi muhim: "Uchinchi shaxs" — ongli tanlov, "Boshqa" esa maydonning
 * standart qiymati, ya'ni ko'pincha shunchaki to'ldirilmagan.
 */
function targetOfCustomerType(customerType: unknown): TxTarget | undefined {
  switch (normalize(String(customerType ?? ""))) {
    case "xodim": return "employee";
    case "o'quvchilar": return "student";
    // Uchinchi shaxs uchun tizimda na ro'yxat, na jurnalda maydon bor —
    // yetkazib beruvchi nomini `studentName` ga yozish "KIM" ustunini
    // ifloslantirardi (u yerdan /student-edit ga havola yasaladi).
    case "uchinchi shaxs": return null;
    default: return undefined; // "Boshqa", bo'sh yoki notanish qiymat
  }
}

/**
 * Tanlangan tranzaksiya turi uchun kim tanlanishi kerakligini aniqlaydi.
 * `null` — bu tur uchun umuman tanlov ko'rsatilmaydi.
 *
 * OBYEKT qabul qiladi, ikkita alohida argument emas: chaqiruvchi ikkala
 * maydonni ham bitta joydan (tanlangan `TransactionType`) oladi, va ikki
 * argumentli imzoda `customerType` ni uzatishni unutish oson bo'lardi —
 * u holda kod jimgina eski, nosoz xulqqa qaytardi.
 */
export function txTarget(type: { name?: string; customerType?: string } | null | undefined): TxTarget {
  if (!type) return null;
  const byCustomer = targetOfCustomerType(type.customerType);
  if (byCustomer !== undefined) return byCustomer;
  return targetOfName(type.name ?? "");
}

/** Tanlov maydonining sarlavhasi. */
export function txTargetLabel(target: TxTarget): string {
  return target === "employee" ? "Xodimni tanlang" : "O'quvchini tanlang";
}

/**
 * Tur ONGLI ravishda "Uchinchi shaxs" deb belgilanganmi.
 *
 * NEGA `txTarget(...) === null` YETMAYDI: u IKKI boshqa-boshqa holatni
 * bitta `null` ga qorishtiradi (yuqoridagi `targetOfCustomerType`
 * izohiga qarang):
 *
 *   "Uchinchi shaxs" — ONGLI tanlov: bu pul odamga bog'liq emas
 *                      (masalan "Kitob sotuvi").
 *   "Boshqa"         — maydonning STANDART qiymati, ya'ni ko'pincha
 *                      shunchaki to'ldirilmagan
 *                      (app/api/transaction-types/route.ts →
 *                      `body.customerType || "Boshqa"`).
 *
 * Farq muhim, chunki bu funksiya Kirim oynasida o'quvchi va o'qituvchi
 * tanlovlarini YASHIRADI. Ularsiz yozuv hech kimga biriktirilmaydi va
 * uch joydan chiqib ketadi: o'quvchi balansi
 * (app/api/students/balances), Tushum rejasi (revenue-summary) va
 * o'qituvchining foizli oyligi (lib/payrollSources.ts). "Boshqa kirim"
 * turi uchun bu JIMGINA regressiya bo'lardi — u zaxira yo'l bo'lib,
 * unda kassir odamni tanlaydi.
 *
 * Ya'ni qaror KODDA emas, BAZADA turadi: Sozlamalar → Moliya →
 * Tranzaksiya turi sahifasida "Mijoz" maydonini "Uchinchi shaxs" ga
 * o'tkazish kifoya.
 */
export function isThirdParty(type: { customerType?: string } | null | undefined): boolean {
  return normalize(String(type?.customerType ?? "")) === "uchinchi shaxs";
}
