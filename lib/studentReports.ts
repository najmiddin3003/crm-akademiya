// Hisobotlar bo'limidagi o'quvchi to'lov/davomat hisobotlari uchun umumiy
// tiplar. Har biri o'z MongoDB kolleksiyasiga ega:
//   unpaid_students        → O'quvchining umumiy to'lanmagani
//   price_differences      → Kurs narxidan farqli to'lovlar
//   cancelled_payments     → Bekor qilingan to'lovlar
//   student_discounts      → Umumiy chegirmalar
//   cancelled_attendance   → Davomati bekor qilinganlar
//   leave_reasons          → Ketish sabablari
//
// Seed'lar API route'larida `createInitialOrders()` dan (haqiqiy o'quvchi/
// guruh/kurs/o'qituvchi nomlari) deterministik tarzda quriladi — shu sababli
// hisobotlar loyihaning qolgan qismidagi ismlar bilan izchil bo'ladi.

export interface UnpaidStudent {
  id: number;
  studentName: string;
  groups: string; // Guruhlar (raqam yoki nom)
  unpaidLessons: number; // To'lanmagan darslar
  totalUnpaid: number; // Jami to'lanmagan
}

export interface PriceDifference {
  id: number;
  studentName: string;
  type: string; // Turi — "Chegirma" | "Qo'shimcha"
  group: string;
  studentPrice: number; // O'quvchi narxi
  coursePrice: number; // Kurs narxi
  createdAt: string; // "DD.MM.YYYY"
}

export interface CancelledPayment {
  id: number;
  studentName: string;
  unpaidLessons: number; // To'lanmagan darslar soni
  totalAmount: number; // Jami to'lanmagan summa
  teacher: string;
  group: string;
  note: string; // Izoh
}

export interface StudentDiscount {
  id: number;
  studentName: string;
  course: string;
  group: string;
  totalDiscount: number; // Umumiy olgan chegirmasi
  bonus: number;
}

export interface CancelledAttendance {
  id: number;
  studentName: string;
  amount: number; // Miqdori
  group: string;
  course: string;
  cancelledBy: string; // Kim bekor qildi?
  date: string; // "DD.MM.YYYY"
}

// Ketish sabablari — referensdagi 4 tab.
export type LeaveCategory = "umumiy" | "buyurtmadan" | "tolovsiz" | "tolovli";

export const LEAVE_TABS: { key: LeaveCategory; label: string }[] = [
  { key: "umumiy", label: "Umumiy ketganlar" },
  { key: "buyurtmadan", label: "Buyurtmadan ketganlar" },
  { key: "tolovsiz", label: "To'lov qilmasdan ketganlar" },
  { key: "tolovli", label: "To'lov qilib ketganlar" },
];

export interface LeaveReason {
  id: number;
  category: LeaveCategory;
  reason: string; // Sabab nomi
  count: number; // Ketgan o'quvchi soni
}
