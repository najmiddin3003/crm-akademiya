// Boshqaruv → Xodimlar (edutizim dizayni) uchun umumiy tip. API route'lari va
// klient komponentlar (ro'yxat, qo'shish modali, profil) shuni bo'lishadi.
// MongoDB `hr_employees` kolleksiyasi — invite oqimidagi `employees`dan ALOHIDA.
/**
 * Xodimning bitta filialdagi biriktiruvi — Xodim qo'shish modalidagi
 * "Filiallar / Rollar / Ish jadvali / Ish haqi" jadvalining bir qatori.
 * Faqat galochka qo'yilgan filiallar saqlanadi.
 */
export interface EmployeeBranchAssignment {
  branchId: number;
  roleId: number | null;     // /api/roles
  scheduleId: number | null; // /api/work-schedules
  salary: number;            // UZS, butun son
}

export interface HrEmployee {
  id: number;
  name: string;
  gender: string; // "male" | "female"
  aktivOq: number;
  groups: number;
  turi: string; // "teacher" | "moderator" | "admin"
  filial: string;
  phone: string;
  kurs: string;
  created: string;
  lastActive: string;
  archReason: string;
  archDate: string; // "Sana" ustuni — arxivlash sababi qayd etilgan sana
  email?: string;
  // Faqat o'qituvchida to'ldiriladi (Xodim qo'shish modalidagi 3-qator).
  // Ixtiyoriy: eski hujjatlarda bu maydonlar yo'q.
  percent?: string; // Oladigan foizi — Sozlamalar > Moliya > Oylik foizlari
  degree?: string;  // Darajasi — Sozlamalar > Boshqaruv > O'qituvchi darajalari
  /** Cloudinary'dagi profil rasmi (secure_url). */
  photoUrl?: string;
  /** Belgilangan filiallar bo'yicha rol/jadval/ish haqi. */
  branchAssignments?: EmployeeBranchAssignment[];
}
