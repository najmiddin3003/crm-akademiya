// O'qituvchilar — Boshqaruv → Xodimlar roster'idagi (MongoDB `hr_employees`)
// `turi: "teacher"` yozuvlari. Alohida kolleksiya YO'Q: o'qituvchi ham xodim,
// shuning uchun uni ikki joyda saqlash noto'g'ri bo'lardi.
//
// Ilgari o'qituvchilar tanlovlari qattiq yozilgan ro'yxatdan kelardi
// (lib/ordersData.ts → TEACHERS, constants/index.js → TEACHERS). Ular olib
// tashlandi: endi o'qituvchi kerak bo'lgan har qanday joy /api/teachers dan
// (klientda hooks/useTeachers.ts orqali) o'qiydi.

import type { HrEmployee } from "@/lib/hrEmployees";

export interface Teacher {
  id: number;
  name: string;
  phone: string;
  /** Qaysi kursni o'qitadi (xodim kartasidagi "Kurs"). */
  kurs: string;
  filial: string;
  /** Darajasi — Sozlamalar > Boshqaruv > O'qituvchi darajalari. */
  degree: string;
  /** Oladigan foizi — Sozlamalar > Moliya > Oylik foizlari. */
  percent: string;
  photoUrl?: string;
}

/** Xodim yozuvi — faol (arxivlanmagan) o'qituvchimi. */
export function isActiveTeacher(e: Pick<HrEmployee, "turi" | "archReason">): boolean {
  return e.turi === "teacher" && !e.archReason;
}

export function teacherFromEmployee(e: HrEmployee): Teacher {
  return {
    id: e.id,
    name: e.name,
    phone: e.phone ?? "",
    kurs: e.kurs ?? "",
    filial: e.filial ?? "",
    degree: e.degree ?? "",
    percent: e.percent ?? "",
    photoUrl: e.photoUrl,
  };
}
