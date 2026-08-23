"use client";

import { useEffect, useState } from "react";
import type { EduCategory } from "@/lib/eduCategories";

// O'quv bo'limi → Kategoriya ro'yxatining YAGONA klient manbasi
// (/api/edu-categories). Ilgari kategoriyalarni faqat o'z boshqaruv
// sahifasi o'qirdi; onlayn kurs g'ilofchisidagi "Kategoriya" select'i
// ham shu yerdan oladi. Boshqa data hook'lar bilan bir xil qolip
// (hooks/useBranches.ts).
export function useEduCategories() {
  const [categories, setCategories] = useState<EduCategory[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/edu-categories")
      .then((r) => r.json())
      .then((d) => {
        if (!cancelled && d.ok) setCategories(d.categories);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return { categories, loading };
}
