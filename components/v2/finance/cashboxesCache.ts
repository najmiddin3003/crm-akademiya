"use client";

import { cachedGet, dropCached, peekCached } from "@/lib/clientCache";
import type { Cashbox } from "@/lib/cashboxes";

// YANGI VERSIYA: SAHIFADAN TASHQARIDA OCHILADIGAN FORMALAR UCHUN KASSALAR
// («To'lov qabul qilish» — tezkor paneldan, «Kassa amali» — «+ Yangi» dan).
// Kassalar sahifasi o'z ro'yxatini o'zi yuritadi va formaga beradi.
//
// Kesh QISQA va maqsadi — tugma ustiga kelganda oldindan yuklab, bosilganda
// oynani kutmasdan ochish. Pul amalidan keyin kesh tashlanadi: keyingi oyna
// qoldiqni (Chiqim/Ko'chirish chegarasi) yangidan oladi. Chegarani baribir
// SERVER tekshiradi (lib/cashboxAdjust.ts, transfer-to).

const KEY = "v2:forms:cashboxes";
const TTL_MS = 30_000;

/** Arxivda bo'lmagan kassalar (xodimga — faqat o'ziniki, app/api/cashboxes). */
export function loadCashboxes(): Promise<Cashbox[]> {
  return cachedGet(KEY, TTL_MS, () =>
    fetch("/api/cashboxes")
      .then((r) => r.json())
      .then((d) => {
        if (!d?.ok) throw new Error(d?.error || "Kassalarni yuklab bo'lmadi");
        return (d.cashboxes as Cashbox[]).filter((c) => !c.archived);
      }),
  );
}

export function peekCashboxes(): Cashbox[] | null {
  return peekCached<Cashbox[]>(KEY);
}

/** Tugma ustiga kelganda — bosilganda oyna darhol ochilsin. */
export function prefetchCashboxes(): void {
  void loadCashboxes().catch(() => {});
}

/** Pul amalidan keyin — keyingi oyna qoldiqni yangidan olsin. */
export function dropCashboxes(): void {
  dropCached(KEY);
}
