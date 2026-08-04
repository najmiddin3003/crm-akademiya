// Moliya → Jarima. MongoDB `penalties` kolleksiyasi — audit-log: yozuv hech
// qachon o'chirilmaydi, faqat "bekor qilish" orqali status="cancelled" +
// sababi belgilanadi (foydalanuvchi tasdiqlagan xatti-harakat).
export interface Penalty {
  id: number;
  type: string; // "employee" | "student" — constants/penalties.js PENALTY_TYPES
  cashboxId: number | null; // Moliya → Kirim chiqim'dagi "Kassa" filtri uchun
  recipientName: string;
  before: number;
  amount: number;
  after: number;
  note: string; // Izoh
  reason: string; // Sababi — bekor qilish sababi (ixtiyoriy)
  status: string; // "" | "cancelled"
  image: string; // Rasm — fayl mahalliy tanlanadi, faqat NOMI saqlanadi (loyihadagi mavjud konventsiya)
  createdAt: string; // "DD.MM.YYYY HH:mm"
}
