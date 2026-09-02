"use client";

import { useMemo } from "react";
import { useSharedList } from "@/hooks/useSharedList";
import type { Moderator } from "@/lib/moderatorsData";

// Moderatorlarning YAGONA klient manbasi — /api/moderators (MongoDB
// `hr_employees`, `turi: "moderator"`, Boshqaruv → Xodimlar sahifasi
// boshqaradi). hooks/useTeachers.ts bilan bir xil qolip.
//
// Ilgari moderator kerak bo'lgan joylar yo qattiq yozilgan ro'yxatdan
// o'qir edi (kassa panelida hatto O'QITUVCHILAR ro'yxati chiqardi), yo
// butun xodimlar ro'yxatini tortib olib klientda filtrlardi.
export function useModerators() {
  // Takroriy so'rov dedup qilinadi — hooks/useSharedList.ts (7 ta faylda).
  const { items: moderators, loading } = useSharedList<Moderator>(
    "shared:moderators",
    "/api/moderators",
    (d) => (d as { moderators?: Moderator[] }).moderators ?? [],
  );

  const names = useMemo(() => moderators.map((m) => m.name).filter(Boolean), [moderators]);

  return { moderators, names, loading };
}
