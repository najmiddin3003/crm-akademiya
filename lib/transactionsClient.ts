"use client";

import { cachedGet, invalidateCached } from "@/lib/clientCache";
import type { Transaction } from "@/lib/transactions";

// `/api/transactions` — 21 921 yozuv, ~2.8 MB. Uni BESHTA analitika sahifasi
// (Moliya analitikasi, Hisobotlar, PnL, Cash Flow, Financial Analytics)
// to'liq yuklab, yig'indini brauzerda hisoblaydi. Hujjatlar allaqachon
// ixcham (id, sana, vaqt, summa, turkum, usul, kassa) — proyeksiya bilan
// qisqartiradigan joyi yo'q. Shuning uchun bu yerda foyda beradigan yagona
// narsa — qayta-qayta tashimaslik.
//
// TTL o'quvchilarnikidan qisqa: bu moliyaviy ko'rsatkichlar, va kassa
// amallari serverda yangi tranzaksiya yozadi.

const KEY = "transactions";
const TTL_MS = 15_000;

export function loadTransactionsCached(): Promise<Transaction[]> {
  return cachedGet(KEY, TTL_MS, () =>
    fetch("/api/transactions")
      .then((r) => r.json())
      .then((d) => {
        if (!d?.ok) throw new Error("transactions: ok emas");
        return d.transactions as Transaction[];
      }));
}

/** Kassa/oylik amallaridan keyin CHAQIRILSIN — ular yangi tranzaksiya yozadi. */
export function invalidateTransactions(): void {
  invalidateCached(KEY);
}
