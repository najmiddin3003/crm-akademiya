"use client";

import { useMemo } from "react";
import { useReferenceList } from "@/hooks/useReferenceList";
import { makeReferenceLoader, REF_KEYS, invalidateReference } from "@/lib/referenceCache";
import type { TransactionType } from "@/lib/transactionTypes";

// Tranzaksiya turlarining YAGONA klient manbasi — /api/transaction-types
// (Moliya → Tranzaksiya turi sahifasi boshqaradi: Kirim / Chiqim / Vaucher /
// Jarima tablari).
//
// `names` — BARCHA turlarning nomi (to'rtala tab), Kassalar sahifasidagi
// "Tranzaksiya turi" filtri uchun. `namesOf(mainType)` — bitta tabniki,
// masalan kirim oynasidagi "Tranzaksiya" ro'yxati uchun.
const loadTransactionTypes = makeReferenceLoader<TransactionType>(REF_KEYS.transactionTypes, "/api/transaction-types", "types");

export function useTransactionTypes() {
  const { items: types, loading } = useReferenceList(REF_KEYS.transactionTypes, loadTransactionTypes);

  // Tartib API'dagidek (id bo'yicha) qoladi — sahifada qaysi tur birinchi
  // tursa, tanlash ro'yxatida ham birinchi bo'ladi.
  const names = useMemo(
    () => [...new Set(types.map((t) => t.name).filter(Boolean))],
    [types],
  );

  return { types, names, loading };
}

/** Tranzaksiya turi qo'shilgan/o'zgartirilgan/o'chirilgandan keyin CHAQIRILSIN. */
export function invalidateTransactionTypes(): void {
  invalidateReference(REF_KEYS.transactionTypes);
}

/** Bitta tab ("kirim" | "chiqim" | "voucher" | "jarima") turlarining nomlari. */
export function transactionTypeNames(types: TransactionType[], mainType: string): string[] {
  return [...new Set(types.filter((t) => t.mainType === mainType).map((t) => t.name).filter(Boolean))];
}
