"use client";

import { cachedGet } from "@/lib/clientCache";
import { CACHE_KEYS } from "@/lib/cacheKeys";

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

const KEY = CACHE_KEYS.balances;
const TTL_MS = 15_000;

/** Ism (kichik harfda, chetlari kesilgan) → to'langan summa. */
export type StudentBalances = Record<string, number>;

/** `pupils.id` → to'langan summa. ISMDOSHLAR AJRALGAN holat. */
export type StudentBalancesById = Record<number, number>;

interface BalancesResponse {
  balances: StudentBalances;
  byId: StudentBalancesById;
  /** `byId` ning tanga evaziga chegirma qismi (faqat bori). */
  discountById: StudentBalancesById;
}

/**
 * Javobning O'ZI keshlanadi (ikkala xarita bilan). Ism bo'yicha va id
 * bo'yicha chaqiruvlar shu bitta so'rovni bo'lishadi — aks holda bir
 * sahifada ikkita og'ir hisob ketardi.
 */
function loadBalancesResponse(): Promise<BalancesResponse> {
  return cachedGet(KEY, TTL_MS, () =>
    fetch("/api/students/balances")
      .then((r) => r.json())
      .then((d) => {
        // Xatoni bo'sh xaritaga aylantirmaymiz — aks holda "balans 0" deb
        // ko'rsatilib, ustiga o'sha noto'g'ri javob keshlanib qolardi.
        if (!d?.ok) throw new Error("balances: ok emas");
        return {
          balances: (d.balances ?? {}) as StudentBalances,
          byId: (d.byId ?? {}) as StudentBalancesById,
          discountById: (d.discountById ?? {}) as StudentBalancesById,
        };
      }));
}

export function loadBalancesCached(): Promise<StudentBalances> {
  return loadBalancesResponse().then((d) => d.balances);
}

/**
 * BALANS ID BO'YICHA — o'quvchisi ma'lum bo'lgan HAR JOY shuni ishlatsin.
 *
 * Ism bo'yicha xarita ismdoshlarni bitta kalitga qo'shib yuboradi: bazada
 * 545 ta ism takrorlanadi va ular bir-birining to'lovini "o'ziniki" deb
 * ko'rsatardi (lib/pupilEntries.ts). Ro'yxatlar o'quvchini baribir
 * `pupils.id` bilan chizadi, ya'ni kalit tayyor turibdi.
 */
export function loadBalancesByIdCached(): Promise<StudentBalancesById> {
  return loadBalancesResponse().then((d) => d.byId);
}

/**
 * FAQAT NAQD to'langani — ID bo'yicha: balans minus tanga evaziga chegirma
 * (lib/transactionEntries.ts → discountSom). O'quvchiga pul QAYTARISH
 * chegarasi shu: chegirma balansda turadi, lekin naqd qaytarilmaydi
 * (server ham xuddi shunday tekshiradi — lib/cashboxAdjust.ts).
 */
export function loadCashBalancesByIdCached(): Promise<StudentBalancesById> {
  return loadBalancesResponse().then((d) => {
    const out: StudentBalancesById = { ...d.byId };
    for (const [id, disc] of Object.entries(d.discountById)) out[Number(id)] = (out[Number(id)] ?? 0) - disc;
    return out;
  });
}

// invalidateBalances() ATAYLAB bu yerda emas — u lib/cacheKeys.ts da
// (yuqoridagi transactionsClient bilan bir xil sabab).
