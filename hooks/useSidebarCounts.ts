"use client";

import { useEffect, useState } from "react";
import { cachedGet } from "@/lib/clientCache";

// Sidebar yonidagi sonlar — /api/sidebar-counts dan.
//
// Ilgari bu sonlar `constants/sidebar.js` da qattiq yozilgan edi va
// bazadagi haqiqat bilan aloqasi yo'q edi (izoh: app/api/sidebar-counts).
//
// KESH 60 s: sidebar HAR BIR sahifada mount bo'ladi, ya'ni keshsiz har
// o'tishda to'rtta `countDocuments` ketardi. Filial almashganda
// `BranchContext` butun sahifani qayta yuklaydi — ya'ni yangi filialning
// sonlari o'z-o'zidan keladi, alohida bekor qilish kerak emas.

export type SidebarCounts = Record<string, number>;

export function useSidebarCounts(): SidebarCounts {
  const [counts, setCounts] = useState<SidebarCounts>({});

  useEffect(() => {
    let cancelled = false;
    cachedGet<{ ok?: boolean; counts?: SidebarCounts }>("sidebar-counts", 60_000, () =>
      fetch("/api/sidebar-counts").then((r) => r.json()),
    )
      .then((d) => {
        if (!cancelled && d?.ok && d.counts) setCounts(d.counts);
      })
      // Sonlar — bezak, ular kelmasa sidebar shunchaki sonsiz chiziladi.
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  return counts;
}
