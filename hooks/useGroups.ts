"use client";

import { useSharedList } from "@/hooks/useSharedList";

import type { Group } from "@/lib/groups";

// Guruhlarning YAGONA klient manbasi — /api/groups (MongoDB `groups`,
// Guruh sahifasi boshqaradi).
//
// Ilgari "Guruhga qo'shish" modali lib/groupsData.ts dagi qattiq yozilgan
// DEMO_GROUPS ro'yxatidan o'qir edi va u bazadagi haqiqiy guruhlar bilan
// bog'liq emas edi. Guruh kerak bo'lgan har qanday klient komponent shu
// hook'dan foydalanishi kerak.
export function useGroups(initial?: Group[]) {
  // Takroriy so'rov dedup qilinadi — hooks/useSharedList.ts (11 ta faylda).
  //
  // TTL ataylab QISQA (1.5 s): `highlighted` bayrog'i har so'rovda qaytadan
  // hisoblanadi (bugungi davomat), ya'ni ro'yxatni uzoq keshlash mumkin emas.
  //
  // `initial` — Server Component'dan kelgan ro'yxat; berilsa birinchi
  // so'rov umuman yuborilmaydi.
  const { items: groups, loading } = useSharedList<Group>(
    "shared:groups",
    "/api/groups",
    (d) => (d as { groups?: Group[] }).groups ?? [],
    initial,
  );

  return { groups, loading };
}
