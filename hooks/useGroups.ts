"use client";

import { useEffect, useState } from "react";
import type { Group } from "@/lib/groups";

// Guruhlarning YAGONA klient manbasi — /api/groups (MongoDB `groups`,
// Guruh sahifasi boshqaradi).
//
// Ilgari "Guruhga qo'shish" modali lib/groupsData.ts dagi qattiq yozilgan
// DEMO_GROUPS ro'yxatidan o'qir edi va u bazadagi haqiqiy guruhlar bilan
// bog'liq emas edi. Guruh kerak bo'lgan har qanday klient komponent shu
// hook'dan foydalanishi kerak.
export function useGroups() {
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/groups")
      .then((r) => r.json())
      .then((d) => { if (!cancelled && d.ok) setGroups(d.groups); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  return { groups, loading };
}
