// Moliya → Bonus. MongoDB `bonuses` kolleksiyasi — har bir yozuv bitta
// xodim/o'quvchiga berilgan bonus tranzaksiyasi (audit-log, tahrirlanmaydi —
// faqat yaratiladi/o'chiriladi).
export interface Bonus {
  id: number;
  type: string; // "employee" | "student" — constants/bonuses.js BONUS_TYPES
  cashboxId: number | null; // Moliya → Kirim chiqim'dagi "Kassa" filtri uchun
  recipientName: string;
  givenBy: string;
  before: number;
  amount: number;
  after: number;
  note: string;
  reason: string; // "Sababi" — bu forma orqali hech qachon to'ldirilmaydi (manba ham bo'sh)
  status: string; // "Holat" — xuddi shu sababga ko'ra bo'sh
  createdAt: string; // "DD.MM.YYYY HH:mm"
}
