"use client";

import { useEffect, useMemo, useState } from "react";
import type { Teacher } from "@/lib/teachersData";

// O'qituvchilarning YAGONA klient manbasi — /api/teachers (MongoDB
// `hr_employees`, `turi: "teacher"`, Boshqaruv → Xodimlar sahifasi boshqaradi).
//
// Ilgari o'qituvchi tanlanadigan har bir forma qattiq yozilgan ro'yxatdan
// (lib/ordersData.ts → TEACHERS) o'qir edi va u bazadagi haqiqiy xodimlar
// bilan bog'liq emas edi. O'qituvchi kerak bo'lgan har qanday klient
// komponent shu hook'dan foydalanishi kerak.
export function useTeachers() {
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/teachers")
      .then((r) => r.json())
      .then((d) => { if (!cancelled && d.ok) setTeachers(d.teachers); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const names = useMemo(() => teachers.map((t) => t.name).filter(Boolean), [teachers]);

  return { teachers, names, loading };
}
