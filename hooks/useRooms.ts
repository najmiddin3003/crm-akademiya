"use client";

import { useEffect, useMemo, useState } from "react";
import type { Room } from "@/lib/rooms";

// Xonalarning YAGONA klient manbasi — /api/rooms (Guruh → Xonalar sahifasi
// boshqaradi). hooks/useTeachers.ts bilan bir xil qolip.
//
// Ilgari xona tanlanadigan joylar `constants/groups.js` dagi qattiq yozilgan
// "201 - xona … 219 - xona" ro'yxatidan o'qir edi. `/api/rooms` da seed yo'q,
// ya'ni foydalanuvchi yaratgan HAR QANDAY xona o'sha ro'yxatga tushmasdi —
// dars jadvalida esa bunday guruh umuman ko'rinmay ketardi (ustun topilmay
// `continue` bo'lardi).
export function useRooms() {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/rooms")
      .then((r) => r.json())
      .then((d) => { if (!cancelled && d.ok) setRooms(d.rooms); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const names = useMemo(() => rooms.map((r) => r.name).filter(Boolean), [rooms]);

  return { rooms, names, loading };
}
