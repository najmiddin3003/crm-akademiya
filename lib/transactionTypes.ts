// Moliya → Tranzaksiya turi. MongoDB `transaction_types` kolleksiyasi —
// loyihaning boshqa Moliya sahifalarida (Bonus/Jarima/Kirim-chiqim/Moliya
// analitikasi) ishlatilgan kategoriyalarning "administrativ" ro'yxati.
export interface TransactionType {
  id: number;
  name: string;
  minAmount: number;
  maxAmount: number;
  /**
   * "Mijoz" katakchalari: "Boshqa" | "O'quvchilar" | "Xodim" | "Uchinchi shaxs".
   *
   * KO'P TANLOVLI — ro'yxat. Eski hujjatlarda bitta SATR bo'lib qolgan,
   * shu bois tip ikkalasini ham qamraydi; o'qish har doim
   * `lib/txTarget.ts` → `txAudience()` orqali (u shaklni o'zi tenglaydi).
   */
  customerType: string | string[];
  mainType: string; // "kirim" | "chiqim" | "voucher" | "jarima" — qaysi tabda ko'rinishi
  category: string; // "Kirim" | "Chiqim" — jadvaldagi belgi (mainType'dan mustaqil bo'lishi mumkin)
}
