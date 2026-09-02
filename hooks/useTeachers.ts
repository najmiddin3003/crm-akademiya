"use client";

import { useMemo } from "react";
import { useSharedList } from "@/hooks/useSharedList";
import type { Teacher } from "@/lib/teachersData";

// O'qituvchilarning YAGONA klient manbasi — /api/teachers (MongoDB
// `hr_employees`, `turi: "teacher"`, Boshqaruv → Xodimlar sahifasi boshqaradi).
//
// Ilgari o'qituvchi tanlanadigan har bir forma qattiq yozilgan ro'yxatdan
// (lib/ordersData.ts → TEACHERS) o'qir edi va u bazadagi haqiqiy xodimlar
// bilan bog'liq emas edi. O'qituvchi kerak bo'lgan har qanday klient
// komponent shu hook'dan foydalanishi kerak.
export function useTeachers() {
  // Bir vaqtda kelgan chaqiruvlar bitta so'rovni bo'lishadi — sabab
  // hooks/useSharedList.ts izohida (bu hook 9 ta faylda ishlatiladi).
  const { items: teachers, loading } = useSharedList<Teacher>(
    "shared:teachers",
    "/api/teachers",
    (d) => (d as { teachers?: Teacher[] }).teachers ?? [],
  );

  const names = useMemo(() => teachers.map((t) => t.name).filter(Boolean), [teachers]);

  return { teachers, names, loading };
}
