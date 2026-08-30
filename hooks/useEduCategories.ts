"use client";

import { useReferenceList } from "@/hooks/useReferenceList";
import { makeReferenceLoader, REF_KEYS, invalidateReference } from "@/lib/referenceCache";
import type { EduCategory } from "@/lib/eduCategories";

// O'quv bo'limi → Kategoriya ro'yxatining YAGONA klient manbasi
// (/api/edu-categories). Ilgari kategoriyalarni faqat o'z boshqaruv
// sahifasi o'qirdi; onlayn kurs g'ilofchisidagi "Kategoriya" select'i
// ham shu yerdan oladi. Boshqa data hook'lar bilan bir xil qolip
// (hooks/useBranches.ts).
const loadEduCategories = makeReferenceLoader<EduCategory>(REF_KEYS.eduCategories, "/api/edu-categories", "categories");

export function useEduCategories() {
  const { items: categories, loading } = useReferenceList(REF_KEYS.eduCategories, loadEduCategories);
  return { categories, loading };
}

/** Yo'nalish qo'shilgan/o'zgartirilgan/o'chirilgandan keyin CHAQIRILSIN. */
export function invalidateEduCategories(): void {
  invalidateReference(REF_KEYS.eduCategories);
}
