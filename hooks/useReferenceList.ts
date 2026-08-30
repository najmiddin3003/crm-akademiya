"use client";

import { useEffect, useState } from "react";
import { peekCached } from "@/lib/clientCache";

/**
 * Keshlangan ma'lumotnoma ro'yxatini o'qiydigan umumiy hook.
 * `load` MODUL darajasida yasalgan barqaror funksiya bo'lishi kerak
 * (lib/referenceCache.ts → makeReferenceLoader).
 */
export function useReferenceList<T>(key: string, load: () => Promise<T[]>) {
  // Kesh tayyor bo'lsa birinchi renderdayoq to'liq ro'yxat bilan
  // boshlanadi — bo'sh tanlov "chaqnab" o'tmaydi (useStudents bilan bir xil).
  const [items, setItems] = useState<T[]>(() => peekCached<T[]>(key) ?? []);
  const [loading, setLoading] = useState(() => peekCached<T[]>(key) === null);

  useEffect(() => {
    let cancelled = false;
    load()
      .then((list) => { if (!cancelled) setItems(list); })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [key, load]);

  return { items, loading };
}
