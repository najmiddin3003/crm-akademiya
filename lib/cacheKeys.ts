"use client";

import { invalidateCached } from "@/lib/clientCache";

// Kesh KALITLARI va ularni bekor qilish — URL'SIZ, ataylab.
//
// NEGA ALOHIDA FAYL: lib/apiPermissions.generated.ts sahifaning IMPORT
// GRAFIGINI kuzatib, yo'l-yo'lakay uchragan "/api/..." satrlarini yig'adi
// (scripts/gen-api-permissions.mjs). Ya'ni yozuvdan keyin keshni bekor
// qiladigan sahifa, o'sha endpoint'ni HECH QACHON chaqirmasa ham, faqat
// `invalidateX` ni import qilgani uchun unga ruxsat olib qo'yardi.
//
// Aniq misol: Kassalar va Oyliklar sahifalari `invalidateTransactions()`
// ni chaqiradi, lekin /api/transactions ni o'qimaydi — shunga qaramay
// ular ruxsat ro'yxatiga tushardi. Yuklovchi (URL bor) va bekor qiluvchi
// (URL yo'q) ajratilgach, ruxsat faqat HAQIQATAN o'qiydigan sahifalarda
// qoladi.
//
// QOIDA: ro'yxatni O'QIYDIGAN joy `lib/transactionsClient.ts` /
// `lib/balancesClient.ts` dan import qilsin; faqat BEKOR QILADIGAN joy —
// shu fayldan.

export const CACHE_KEYS = {
  /** hooks/useStudents.ts — "pupils:full" / "pupils:light" prefiksi. */
  pupils: "pupils:",
  /** lib/transactionsClient.ts */
  transactions: "transactions",
  /** lib/balancesClient.ts */
  balances: "student-balances",
} as const;

/** Kassa/oylik amallaridan keyin — ular yangi tranzaksiya yozadi. */
export function invalidateTransactions(): void {
  invalidateCached(CACHE_KEYS.transactions);
}

/**
 * O'quvchining TO'LAGAN puli o'zgarganda (payIn yozildi yoki bekor
 * qilindi). Kassalar aro ko'chirish, dividend, investitsiya va xodim
 * oyligi bunga KIRMAYDI — ular o'quvchi balansiga tegmaydi.
 */
export function invalidateBalances(): void {
  invalidateCached(CACHE_KEYS.balances);
}
