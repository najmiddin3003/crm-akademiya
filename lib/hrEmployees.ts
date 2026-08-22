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

/**
 * Mijozdan kelgan filial biriktiruvlarini xavfsiz ko'rinishga keltiradi.
 * POST /api/hr-employees va PATCH /api/hr-employees/:id ikkalasi ham shuni
 * ishlatadi — `salary` oylik hisobiga va kassadagi chiqim chegarasiga
 * ta'sir qiladi, shu bois u albatta SON bo'lishi kerak. Satr kelib qolsa,
 * yig'indi qo'shilish o'rniga birikib ketadi.
 */
export function sanitizeAssignments(raw: unknown): EmployeeBranchAssignment[] {
  if (!Array.isArray(raw)) return [];
  const out: EmployeeBranchAssignment[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const r = item as Record<string, unknown>;
    const branchId = Number(r.branchId);
    if (!Number.isFinite(branchId)) continue;
    const roleId = Number(r.roleId);
    const scheduleId = Number(r.scheduleId);
    const salary = Number(r.salary);
    out.push({
      branchId,
      roleId: Number.isFinite(roleId) && roleId > 0 ? roleId : null,
      scheduleId: Number.isFinite(scheduleId) && scheduleId > 0 ? scheduleId : null,
      salary: Number.isFinite(salary) && salary > 0 ? Math.trunc(salary) : 0,
    });
  }
  return out;
}

/** Filiallar bo'yicha ish haqi yig'indisi — "oklad". */
export function fixedSalaryOf(emp: { branchAssignments?: EmployeeBranchAssignment[] }): number {
  return (emp.branchAssignments ?? []).reduce((s, b) => s + (Number(b?.salary) || 0), 0);
}

/**
 * Xodimning ish haqi SOZLANGANMI. Bu "0 so'm" dan farq qiladi: sozlanmagan
 * xodim uchun hech qanday raqam ko'rsatilmasligi kerak (soxta 0 emas), va
 * kassadagi oylik chegarasi ham unga qo'llanmaydi.
 */
export function isSalaryConfigured(emp: { branchAssignments?: EmployeeBranchAssignment[] }): boolean {
  return fixedSalaryOf(emp) > 0;
}
