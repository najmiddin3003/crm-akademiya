// Moliya → Oylik chiqarish. MongoDB `salary_runs` kolleksiyasi — har bir
// yozuv bitta "oylik chiqarish" partiyasi (tanlangan xodimlar bo'yicha
// umumlashtirilgan hisobot, audit-log — o'chirilmaydi/tahrirlanmaydi).
export interface SalaryRun {
  id: number;
  employeeCount: number;
  oylik: number;
  davomat: number;
  davomatFoizi: number;
  bonus: number;
  avans: number;
  jarima: number;
  akladi: number;
  tolanmagan: number;
  createdAt: string; // "DD.MM.YYYY | HH:mm"
}

// Xodim uchun joriy hisoblangan oylik-komponentlar (Oylik chiqarish →
// xodim tanlash jadvalidagi bitta qator).
export interface EmployeePayroll {
  id: number;
  name: string;
  phone: string;
  ishHaqi: number;
  davomat: number;
  davomatFoizi: number;
  bonus: number;
  avans: number;
  jarima: number;
  akladi: number;
  tolanmagan: number;
}
