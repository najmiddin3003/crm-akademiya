"use client";

import { cachedGet, invalidateCached } from "@/lib/clientCache";

// Kichik "ma'lumotnoma" ro'yxatlari uchun umumiy kesh — filiallar, xonalar,
// ta'lim yo'nalishlari, tranzaksiya turlari.
//
// MUAMMO: bu ro'yxatlarni o'qiydigan hook'lar xom `fetch` ni mount
// effektida chaqirardi — na kesh, na in-flight dedup. Ro'yxatlar KICHIK
// (hammasi 14 KB dan past), ya'ni tashiladigan bayt muammo emas; muammo
// SO'ROVLAR SONI: `useBranches` 12 ta komponentda, va sahifa hamda uning
// ichidagi modal bir vaqtda mount bo'lganda bir xil endpoint ikki marta
// so'ralardi. Har biri — Atlas'gacha bitta round-trip (~150 ms).
//
// ======================================================================
// NEGA FAQAT SHU TO'RTTASI — qolganlari ATAYLAB keshlanmagan
// ======================================================================
//
// Keshlash bu ro'yxatlar uchun XAVFSIZ, chunki uchala shart ham bajariladi:
//   1) javob faqat o'z kolleksiyasidan o'qiladi (hosila maydon yo'q);
//   2) yozuvchi BITTA sozlamalar sahifasi (pastdagi invalidate joylari);
//   3) boshqa endpoint orqali bilvosita yozuv yo'q — tekshirilgan.
//
// Quyidagilar shu shartlarni BUZADI, shuning uchun ular xom `fetch` da
// qoldi (tekshirilgan, tasodifan emas):
//
//   • /api/groups — javobdagi `highlighted` maydoni SO'ROV PAYTIDA
//     hisoblanadi: bugungi hafta kuni + `attendance` kolleksiyasi
//     (app/api/groups/route.ts). Ya'ni uni butunlay boshqa kolleksiyaga
//     yozuv (davomat belgilash) va shunchaki yarim tunning o'tishi
//     eskirtiradi. "Davomat belgila → guruhlar ro'yxatiga qayt → qator
//     hali ham sariq" — kunlik va eng ko'p takrorlanadigan yo'l.
//
//   • /api/teachers, /api/moderators, /api/hr-employees — bitta
//     `hr_employees` kolleksiyasining uchta ko'rinishi, ustiga IKKITA ekran
//     sonlarni undan JONLI qayta sanaydi (EmployeesListPage dagi "Guruhlar"
//     ustuni, monthlyPercentStaff dagi daraja sonlari). Ikkalasida ham
//     kod izohi bor: bu sonlar ilgari muzlab qolgan maydondan o'qilardi va
//     ATAYLAB jonli hisobga o'tkazilgan. Keshlash o'sha xatoni qaytarardi.
//
//   • /api/settings-lists — `kind` parametri FILTR emas, u boshqa-boshqa
//     kolleksiyani tanlaydi (15 ta `settings_*`). Ustiga to'lov usullari
//     birinchi o'qishda SEED bo'ladi (lib/paymentMethods.ts) va seed'dan
//     oldingi javob `{ ok: true, items: [] }` — ya'ni "xato bo'lsa
//     keshlama" qoidasi bu teshikni yopmaydi.
//
// ESLATMA: `invalidateCached` faqat xaritadan yozuvni o'chiradi — u qayta
// render ham, qayta so'rov ham keltirib chiqarmaydi. Shu bois yozuvdan
// keyin ro'yxat FAQAT keyin MOUNT bo'ladigan iste'molchilarda yangilanadi.
// Doim mount turadigan Navbar bundan tashqarida qoladi — lekin u bugun ham
// shunday (mount'da bir marta o'qiydi), ya'ni bu orqaga qadam emas.

/** Ma'lumotnoma ro'yxatlari uchun TTL. */
export const REFERENCE_TTL_MS = 60_000;

export const REF_KEYS = {
  branches: "ref:branches",
  rooms: "ref:rooms",
  eduCategories: "ref:edu-categories",
  transactionTypes: "ref:transaction-types",
} as const;

/**
 * `{ ok, <field>: [...] }` shaklidagi GET uchun keshlangan yuklovchi yasaydi.
 * Qaytgan funksiya BARQAROR bo'lishi uchun modul darajasida chaqirilsin.
 */
export function makeReferenceLoader<T>(key: string, url: string, field: string): () => Promise<T[]> {
  return () =>
    cachedGet<T[]>(key, REFERENCE_TTL_MS, () =>
      fetch(url)
        .then((r) => r.json())
        .then((d) => {
          // Xato javob keshda qolib ketmasin — hooks/useStudents.ts dagi
          // bilan bir xil qoida.
          if (!d?.ok) throw new Error(`${key}: ok emas`);
          return (d[field] ?? []) as T[];
        }));
}

/** Yozuvdan keyin CHAQIRILSIN — aks holda ro'yxat TTL tugaguncha eski qoladi. */
export function invalidateReference(key: string): void {
  invalidateCached(key);
}
