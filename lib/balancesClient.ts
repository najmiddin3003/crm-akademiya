"use client";

import { cachedGet, invalidateCached } from "@/lib/clientCache";

// `/api/students/balances` — o'quvchi → to'lagan pul yig'indisi.
//
// MUAMMO: bu javobni ON BIRTA komponent alohida `fetch` bilan olardi, kesh
// ham, in-flight dedup ham yo'q. Server tomonda u `transaction_entries`
// bo'yicha 16 937 hujjatni ko'rib chiqadi. Ya'ni /parents → /active-students
// → /parents yo'lini bosib o'tish o'sha og'ir hisobni UCH marta yugurtirardi.
//
// Eng yomoni /finance-cash da edi: CashboxKirimDrawer va CashboxAdjustDrawer
// uni drawer HAR OCHILGANDA so'rardi, ya'ni Kirim oynasini uch marta ochish
// — uchta to'liq hisob.
//
// Bu aynan /api/pupils va /api/transactions uchun allaqachon yechilgan
// muammo (lib/clientCache.ts), shu bois yechim ham o'sha.
//
// TTL tranzaksiyalarnikidek qisqa (15 s): balans — moliyaviy son, va uni
// kassa amallari o'zgartiradi.

const KEY = "student-balances";
const TTL_MS = 15_000;

/** Ism (kichik harfda, chetlari kesilgan) → to'langan summa. */
export type StudentBalances = Record<string, number>;

export function loadBalancesCached(): Promise<StudentBalances> {
  return cachedGet(KEY, TTL_MS, () =>
    fetch("/api/students/balances")
      .then((r) => r.json())
      .then((d) => {
        // Xatoni bo'sh xaritaga aylantirmaymiz — aks holda "balans 0" deb
        // ko'rsatilib, ustiga o'sha noto'g'ri javob keshlanib qolardi.
        if (!d?.ok) throw new Error("balances: ok emas");
        return d.balances as StudentBalances;
      }));
}

/**
 * Kassa amalidan keyin CHAQIRILSIN — kirim/chiqim yozuvi balansni
 * o'zgartiradi. `invalidateTransactions()` chaqiriladigan joylarda shu ham
 * chaqirilishi kerak.
 */
export function invalidateBalances(): void {
  invalidateCached(KEY);
}
