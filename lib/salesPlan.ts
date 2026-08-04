// Sotuv va marketing → Savdo plani (sidebar: Sotuv va marketing > Savdo
// plani, href /sales-plan). MongoDB `sales_plans` kolleksiyasi.
//
// Kolleksiyada FAQAT plan raqami saqlanadi. Moderatorlar ro'yxati va
// "To'lovlar soni" mavjud haqiqiy manbalardan hisoblanadi.
//
// NIMA UCHUN KALIT — ISM, id emas:
// loyihada moderator ikki xil joydan keladi va ular kesishmaydi —
//   • `hr_employees` (turi = "moderator") — Boshqaruv > Xodimlar roster'i;
//   • `transaction_entries.moderator` — kassa yozuvlaridagi ism (manbasi
//     `constants/cashboxes.js`, hr_employees'da bunday xodim yo'q).
// Ikkalasini birlashtirish uchun yagona umumiy kalit — ism. Shu sababli
// to'lovi bor, lekin roster'da yo'q moderator ham jadvalga tushadi.
export interface SalesPlan {
  moderatorName: string;
  plan: number;
}

export interface SalesPlanRow {
  moderatorName: string;
  employeeId: number | null; // hr_employees'da bo'lsa — profilga havola uchun
  plan: number;
  paymentsCount: number;
}
