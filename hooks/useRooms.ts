"use client";

import { useMemo } from "react";
import { useReferenceList } from "@/hooks/useReferenceList";
import { makeReferenceLoader, REF_KEYS, invalidateReference } from "@/lib/referenceCache";
import type { Room } from "@/lib/rooms";

// Xonalarning YAGONA klient manbasi — /api/rooms (Guruh → Xonalar sahifasi
// boshqaradi). hooks/useTeachers.ts bilan bir xil qolip.
//
// Ilgari xona tanlanadigan joylar `constants/groups.js` dagi qattiq yozilgan
// "201 - xona … 219 - xona" ro'yxatidan o'qir edi. `/api/rooms` da seed yo'q,
// ya'ni foydalanuvchi yaratgan HAR QANDAY xona o'sha ro'yxatga tushmasdi —
// dars jadvalida esa bunday guruh umuman ko'rinmay ketardi (ustun topilmay
// `continue` bo'lardi).
const loadRooms = makeReferenceLoader<Room>(REF_KEYS.rooms, "/api/rooms", "rooms");

export function useRooms() {
  const { items: rooms, loading } = useReferenceList(REF_KEYS.rooms, loadRooms);

  const names = useMemo(() => rooms.map((r) => r.name).filter(Boolean), [rooms]);

  return { rooms, names, loading };
}

/** Xona qo'shilgan/o'zgartirilgan/o'chirilgandan keyin CHAQIRILSIN. */
export function invalidateRooms(): void {
  invalidateReference(REF_KEYS.rooms);
}
