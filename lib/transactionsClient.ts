"use client";

import { cachedGet } from "@/lib/clientCache";
import { CACHE_KEYS } from "@/lib/cacheKeys";
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

const KEY = CACHE_KEYS.transactions;
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

// invalidateTransactions() ATAYLAB bu yerda emas — u lib/cacheKeys.ts da.
// Sabab: ruxsatlar xaritasi (lib/apiPermissions.generated.ts) sahifaning
// import grafigini kuzatadi, shu bois faqat keshni bekor qiladigan sahifa
// shu fayldagi "/api/transactions" satri tufayli o'sha endpoint'ga ruxsat
// olib qo'yardi.
