"use client";

import { useEffect, useMemo, useState } from "react";
import type { TransactionType } from "@/lib/transactionTypes";

// Tranzaksiya turlarining YAGONA klient manbasi — /api/transaction-types
// (Moliya → Tranzaksiya turi sahifasi boshqaradi: Kirim / Chiqim / Vaucher /
// Jarima tablari).
//
// `names` — BARCHA turlarning nomi (to'rtala tab), Kassalar sahifasidagi
// "Tranzaksiya turi" filtri uchun. `namesOf(mainType)` — bitta tabniki,
// masalan kirim oynasidagi "Tranzaksiya" ro'yxati uchun.
export function useTransactionTypes() {
  const [types, setTypes] = useState<TransactionType[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/transaction-types")
      .then((r) => r.json())
      .then((d) => { if (!cancelled && d.ok) setTypes(d.types); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  // Tartib API'dagidek (id bo'yicha) qoladi — sahifada qaysi tur birinchi
  // tursa, tanlash ro'yxatida ham birinchi bo'ladi.
  const names = useMemo(
    () => [...new Set(types.map((t) => t.name).filter(Boolean))],
    [types],
  );

  return { types, names, loading };
}

/** Bitta tab ("kirim" | "chiqim" | "voucher" | "jarima") turlarining nomlari. */
export function transactionTypeNames(types: TransactionType[], mainType: string): string[] {
  return [...new Set(types.filter((t) => t.mainType === mainType).map((t) => t.name).filter(Boolean))];
}
