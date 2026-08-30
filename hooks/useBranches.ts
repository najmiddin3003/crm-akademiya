"use client";

import { useReferenceList } from "@/hooks/useReferenceList";
import { makeReferenceLoader, REF_KEYS, invalidateReference } from "@/lib/referenceCache";
import type { ManagementBranch } from "@/lib/managementBranches";

// Filiallar ro'yxatining YAGONA klient manbasi — /api/branches (MongoDB
// `branches`, Boshqaruv → Filiallar sahifasi boshqaradi).
//
// Ilgari loyihada filiallarning bir nechta mustaqil, qattiq yozilgan ro'yxati
// bor edi (Navbar, buyurtma transfer modali, xodim qo'shish, oflayn kurs
// formalari) va ular bir-biriga mos kelmasdi. Filial kerak bo'lgan har qanday
// klient komponent shu hook'dan foydalanishi kerak.
const loadBranches = makeReferenceLoader<ManagementBranch>(REF_KEYS.branches, "/api/branches", "branches");

export function useBranches() {
  const { items: branches, loading } = useReferenceList(REF_KEYS.branches, loadBranches);
  return { branches, loading };
}

/** Filial qo'shilgan/o'zgartirilgan/o'chirilgandan keyin CHAQIRILSIN. */
export function invalidateBranches(): void {
  invalidateReference(REF_KEYS.branches);
}
