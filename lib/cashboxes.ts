// Moliya → Kassalar. MongoDB `cashboxes` kolleksiyasi.
//
// To'lov turlari ro'yxati BU YERDA EMAS — u Sozlamalar → Moliya → To'lov
// turlaridan keladi (lib/paymentMethods.ts). Ilgari bu yerda qattiq yozilgan
// CASHBOX_METHODS bor edi va sozlamadagi ro'yxat bilan mos kelmasdi.
//
// Shu sababli `methodTotals` endi qat'iy interfeys emas, kalit→summa
// xaritasi: kalitlar to'lov turlarining `key` maydonlari.
export type CashboxMethodTotals = Record<string, number>;

export interface Cashbox {
  id: number;
  name: string;
  balance: number;
  moderator: string;
  onlinePayment: boolean; // "Onlayn to'lov qabul qiladi"
  archived: boolean; // "Kassani arxiv qilish"
  isPrimary: boolean; // "Bosh kassa" — bir vaqtda faqat bitta kassada true
  methodTotals: CashboxMethodTotals;
  /**
   * Boshqa kassaga jo'natilgan, ammo hali TASDIQLANMAGAN summa — to'lov
   * turi kesimida. `methodTotals` NING ICHIDA turadi, undan ayrilgan
   * emas: pul qabul qiluvchi ✓ bosgunicha shu kassada qoladi
   * (lib/transferPending.ts).
   *
   * MongoDB hujjatida SAQLANMAYDI — har so'rovda jurnaldan hisoblanadi,
   * shu bois `GET /api/cashboxes` javobida bor, boshqa joyda yo'q
   * bo'lishi mumkin.
   */
  pendingOut?: CashboxMethodTotals;
  /**
   * Kartochkadagi ikkita raqam — bugungi tushum va bu oy bosh kassaga
   * o'tkazilgan pul (lib/cashboxStats.ts).
   *
   * `pendingOut` bilan bir xil qoida: MongoDB hujjatida saqlanmaydi, har
   * so'rovda jurnaldan hisoblanadi va faqat `GET /api/cashboxes`
   * javobida bo'ladi. Kirim/Chiqim/Ko'chirish route'lari kassani
   * qaytarganda bu maydonlar YO'Q — sahifa ularni eski qiymat ustiga
   * yozib yubormasligi kerak (CashboxesPage → patchCashbox).
   */
  todayIncome?: number;
  /**
   * Bugungi tushumning to'lov turi kesimi — kartochkadagi "Naqd /
   * Plastik / …" qatorining IZOHIDA ("bugun X so'm tushgan").
   *
   * Qatordagi RAQAM esa `methodTotals` dan — kassadagi qoldiq. Ikkalasini
   * adashtirmaslik kerak: chiqim va ko'chirma qoldiqni kamaytiradi, bugungi
   * tushumga esa tegmaydi (u faqat `payIn` ni sanaydi).
   */
  todayByMethod?: CashboxMethodTotals;
  monthToPrimary?: number;
  /** Shu kassaga kelib, ✓ kutayotgan ko'chirmalar yig'indisi (lib/cashboxStats.ts). */
  pendingIn?: number;
}

/**
 * Kassaning faqat NOMI — `GET /api/cashboxes?names=1` javobidagi shakl.
 *
 * Jadval va hisobotlarda qatorning yonida kassa nomi turadi. Ular butun
 * `Cashbox` ni (balans, moderator, to'lov turlari kesimi) so'ramaydi va
 * so'ramasligi ham kerak: kassa qamrovi xodimga bog'langanidan keyin
 * to'liq ro'yxat faqat adminga ochiq, nom esa hammaga kerak — aks holda
 * jadvalda "kassa: —" degan bo'sh katak chiqib qolardi.
 */
export interface CashboxName {
  id: number;
  name: string;
  archived?: boolean;
}

export function zeroMethodTotals(keys: string[]): CashboxMethodTotals {
  return Object.fromEntries(keys.map((k) => [k, 0]));
}

// To'lov turi ro'yxatiga keyin qo'shilgan kalitlar eski MongoDB hujjatlarida
// yo'q. API'dan qaytadigan har bir kassa shu yerdan o'tkaziladi — aks holda
// Kassalar sahifasidagi karta `undefined` qiymat oladi.
export function normalizeCashbox(row: Record<string, unknown>, keys: string[]): Cashbox {
  const c = row as unknown as Cashbox;
  return { ...c, methodTotals: { ...zeroMethodTotals(keys), ...c.methodTotals } };
}
