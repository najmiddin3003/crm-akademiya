// Moliya → Moliya analitikasi. MongoDB `transactions` kolleksiyasi — Kalendar/
// Journal/Pul oqimi tab'larining barchasi shu BIR XIL ma'lumotdan hisoblanadi
// (ichki mos kelishi uchun). Faqat Iyul 2026 uchun to'liq generatsiya qilingan
// (constants/transactions.js) — foydalanuvchi bilan kelishilgan yengil qamrov,
// boshqa oylar bo'sh.
export interface Transaction {
  id: number;
  date: string; // "YYYY-MM-DD"
  time: string; // "HH:mm"
  amount: number; // ishorali: musbat=kirim, manfiy=chiqim
  category: string;
  method: string;
  methodLabel: string;
  cashboxId: number;
}
