"use client";

import { useSharedList } from "@/hooks/useSharedList";

import { useMemo } from "react";
import type { HrEmployee } from "@/lib/hrEmployees";

// "Mas'ul shaxs" tanlovlarining YAGONA klient manbasi — /api/hr-employees
// (MongoDB `hr_employees`, Boshqaruv → Xodimlar sahifasi boshqaradi).
// Arxivdagi xodimga yangi topshiriq biriktirilmaydi, shuning uchun
// ro'yxatda faqat aktivlari.
//
// Ilgari bu ro'yxat lib/tasksData.ts dagi qattiq yozilgan 8 ta ismdan
// iborat edi va bazadagi haqiqiy xodimlar bilan bog'liq emas edi — ya'ni
// topshiriq tizimda mavjud bo'lmagan odamga biriktirilishi mumkin edi.
export function useStaff() {
  // Takroriy so'rov dedup qilinadi — hooks/useSharedList.ts (4 ta faylda).
  // MANBA `/api/hr-employees/ref` — FILIALGA KESILMAGAN, tor proyeksiyali.
  //
  // NIMA UCHUN asosiy ro'yxat emas: u endi filial bo'yicha kesiladi
  // (Boshqaruv → Xodimlar aynan shuni talab qiladi). Bu hook esa
  // "mas'ul shaxs" tanlovlari va tug'ilgan kunlar uchun — u yerda
  // markaz butun jamoani ko'rishi kerak. Kesilgan ro'yxat bilan
  // 3-filial admini 1-filial xodimiga topshiriq bera olmasdi va
  // Tug'ilgan kunlar sahifasi jamoaning to'rtdan birini ko'rsatardi.
  //
  // `ref` dan pul va filial maydonlari CHIQMAYDI — tanlov ro'yxatiga
  // ular kerak ham emas (route izohiga qarang).
  const { items: employees, loading } = useSharedList<HrEmployee>(
    "shared:hr-employees-ref",
    "/api/hr-employees/ref",
    (d) => (d as { employees?: HrEmployee[] }).employees ?? [],
  );

  const names = useMemo(
    () => employees.filter((e) => !e.archReason).map((e) => e.name).filter(Boolean),
    [employees],
  );

  return { employees, names, loading };
}
