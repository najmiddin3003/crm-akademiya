"use client";

import { useEffect, useMemo, useState } from "react";
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
  const [employees, setEmployees] = useState<HrEmployee[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/hr-employees")
      .then((r) => r.json())
      .then((d) => { if (!cancelled && d.ok) setEmployees(d.employees); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const names = useMemo(
    () => employees.filter((e) => !e.archReason).map((e) => e.name).filter(Boolean),
    [employees],
  );

  return { employees, names, loading };
}
