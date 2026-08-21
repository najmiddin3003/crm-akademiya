// Xodim profili → "Eslatma" tabi. MongoDB `employee_notes` kolleksiyasi.
// Bitta yozuv = xodim faylida qoldirilgan bitta xabar (chat ko'rinishida,
// eskisidan yangisiga) — guruhdagi `group_notes` bilan bir xil g'oya, lekin
// u (guruh, o'quvchi) juftligiga bog'langan va bu yerda ishlatilmaydi.
//
// Bu kolleksiya DEMO ma'lumot bilan to'ldirilmaydi: unda faqat odam yozgan
// matn bo'ladi.
export interface EmployeeNote {
  id: number;
  employeeId: number; // hr_employees.id
  text: string;
  author: string; // yozgan foydalanuvchining F.I.Sh.
  createdAt: string; // "DD.MM.YYYY | HH:mm"
}

export const EMPLOYEE_NOTE_MAX = 2000;
