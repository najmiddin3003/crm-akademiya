// Moliya → Shartnoma (sidebar: Moliya > Ma'lumotlar > Shartnoma, href
// /finance-fin-contract). MongoDB `finance_contracts` kolleksiyasi — har
// o'quvchi uchun bitta shartnoma, ichida bir nechta "qism" (installment):
// Qiymat/Shartnoma sanasi/Izoh. O'quvchi/moderator id+ism ikkalasi ham
// saqlanadi (denormalized) — id profil sahifasiga (/student-edit/[id],
// /management-xodimlar/[id]) o'tish uchun, ism jadvalda ko'rsatish uchun.
export interface ContractPart {
  id: number;
  amount: number; // Qiymat
  date: string | null; // Shartnoma sanasi, "YYYY-MM-DD"
  comment: string; // Izoh (shartnoma qismiga tegishli)
}

export interface FinanceContract {
  id: number;
  studentOrderId: number; // lib/ordersData.ts Order.id
  studentName: string;
  moderatorId: number; // lib/hrEmployees.ts HrEmployee.id
  moderatorName: string;
  comment: string; // yuqori (umumiy) Izoh
  parts: ContractPart[];
  archived: boolean;
  createdAt: string; // "DD.MM.YYYY | HH:mm"
}

// Jadvaldagi MIQDORI/KUTILAYOTGAN TO'LOV MIQDORI/TO'LANGAN MIQDOR ustunlari —
// manba saytida bu qiymatlar haqiqiy to'lov tarixidan hisoblanadi, bu portda
// to'lov yozib borish oynasi yo'q (add-shartnoma formasida ham ko'rsatilmagan),
// shuning uchun: miqdori = qismlar soni, kutilayotgan = barcha qismlar
// yig'indisi, to'langan = 0 (hali to'lov yozib borilmagan).
export function contractPartsTotal(c: FinanceContract): number {
  return c.parts.reduce((sum, p) => sum + p.amount, 0);
}
