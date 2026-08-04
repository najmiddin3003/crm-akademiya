// Moliya → Tranzaksiya turi. MongoDB `transaction_types` kolleksiyasi —
// loyihaning boshqa Moliya sahifalarida (Bonus/Jarima/Kirim-chiqim/Moliya
// analitikasi) ishlatilgan kategoriyalarning "administrativ" ro'yxati.
export interface TransactionType {
  id: number;
  name: string;
  minAmount: number;
  maxAmount: number;
  customerType: string; // "Boshqa" | "O'quvchilar" | "Xodim" | "Uchinchi shaxs"
  mainType: string; // "kirim" | "chiqim" | "voucher" | "jarima" — qaysi tabda ko'rinishi
  category: string; // "Kirim" | "Chiqim" — jadvaldagi belgi (mainType'dan mustaqil bo'lishi mumkin)
}
