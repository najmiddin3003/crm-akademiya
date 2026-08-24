"use client";

import { useEffect, useMemo, useState } from "react";
import type { Moderator } from "@/lib/moderatorsData";

// Moderatorlarning YAGONA klient manbasi — /api/moderators (MongoDB
// `hr_employees`, `turi: "moderator"`, Boshqaruv → Xodimlar sahifasi
// boshqaradi). hooks/useTeachers.ts bilan bir xil qolip.
//
// Ilgari moderator kerak bo'lgan joylar yo qattiq yozilgan ro'yxatdan
// o'qir edi (kassa panelida hatto O'QITUVCHILAR ro'yxati chiqardi), yo
// butun xodimlar ro'yxatini tortib olib klientda filtrlardi.
export function useModerators() {
  const [moderators, setModerators] = useState<Moderator[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/moderators")
      .then((r) => r.json())
      .then((d) => { if (!cancelled && d.ok) setModerators(d.moderators); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const names = useMemo(() => moderators.map((m) => m.name).filter(Boolean), [moderators]);

  return { moderators, names, loading };
}
