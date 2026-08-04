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
