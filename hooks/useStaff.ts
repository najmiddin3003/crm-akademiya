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
  const { items: employees, loading } = useSharedList<HrEmployee>(
    "shared:hr-employees",
    "/api/hr-employees",
    (d) => (d as { employees?: HrEmployee[] }).employees ?? [],
  );

  const names = useMemo(
    () => employees.filter((e) => !e.archReason).map((e) => e.name).filter(Boolean),
    [employees],
  );

  return { employees, names, loading };
}
