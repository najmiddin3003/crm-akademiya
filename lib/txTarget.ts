// Kassa Kirim/Chiqim oynasida tranzaksiya turiga qarab pastda KIM tanlanishi
// aniqlanadi. Referensda (akademiya.edutizim.uz → Moliya → Kassa → Chiqim):
//
//   "Hodimga oylik", "Hodimga avans"   → XODIMLAR ro'yxati
//   "O'quvchiga pul qaytarildi"        → O'QUVCHILAR ro'yxati
//   "List", "Printer", "Suv", ...      → hech kim tanlanmaydi
//
// Tranzaksiya turlari admin boshqaradigan ro'yxat (/finance-tx-types), ya'ni
// nomlar o'zgarishi mumkin. Shu sabab qat'iy satr solishtirish emas, nomdagi
// kalit so'zga qaraymiz — "hodim"/"xodim" ham, "o'quvchi" ham imlo variantlari
// bilan yoziladi (H/X va turli apostroflar).

export type TxTarget = "employee" | "student" | null;

/** Apostrof variantlarini (’ ‘ ` ´) oddiy ' ga keltiradi va kichik harfga o'giradi. */
function normalize(s: string): string {
  return s.toLowerCase().replace(/[\u2018\u2019\u02BC\u0060\u00B4]/g, "'");
}

/**
 * Tranzaksiya turi nomiga qarab kim tanlanishi kerakligini aniqlaydi.
 * `null` — bu tur uchun umuman tanlov ko'rsatilmaydi.
 */
export function txTarget(category: string): TxTarget {
  const n = normalize(category);
  // "o'quvchi" birinchi tekshiriladi: nomda ikkalasi ham uchrasa
  // (masalan "o'quvchidan xodimga o'tkazma") o'quvchi ustun bo'lsin.
  if (n.includes("o'quvchi") || n.includes("oquvchi")) return "student";
  if (n.includes("hodim") || n.includes("xodim")) return "employee";
  return null;
}

/** Tanlov maydonining sarlavhasi. */
export function txTargetLabel(target: TxTarget): string {
  return target === "employee" ? "Xodimni tanlang" : "O'quvchini tanlang";
}
