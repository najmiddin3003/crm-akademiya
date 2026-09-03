// O'zbekiston vaqti (UTC+5) — sana/vaqt SATRLARI uchun yagona manba.
//
// NIMA NOTO'G'RI EDI: kod hamma joyda `new Date()` ning LOKAL getterlarini
// (`getHours()`, `getDate()` ...) o'qirdi. Dev mashinada bu to'g'ri
// ishlardi, chunki kompyuter allaqachon UTC+5 da. Vercel'da esa server
// UTC'da ishlaydi va bazaga 5 soat orqada qolgan vaqt yozilardi:
//
//     bizning yozuv:   time "06:42",  createdAt "...T06:42Z"   ← noto'g'ri
//     edutizim importi: time "18:09",  createdAt "...T13:09Z"   ← to'g'ri
//
// Ya'ni bitta jadvalda ikki xil vaqt turardi.
//
// O'zbekistonda yozgi/qishki vaqt (DST) yo'q — yil bo'yi qat'iy UTC+5.

const UZ_OFFSET_MIN = 5 * 60;

/**
 * Berilgan lahzani Toshkent devor-soatiga keltiradi.
 *
 * Qaytgan `Date` ning LOKAL getterlari (`getDate()`, `getHours()` ...)
 * Toshkent qiymatlarini beradi — server qaysi zonada ishlashidan qat'i
 * nazar. Shu sabab mavjud formatlash shablonlarini o'zgartirish shart
 * emas, faqat sanani shu funksiyadan o'tkazish kifoya.
 *
 * DIQQAT: natija — FORMATLASH uchun mo'ljallangan "siljitilgan" sana.
 * Uni haqiqiy lahza sifatida saqlamang (`createdAt: new Date()` kabi
 * joylar o'z holicha qolishi kerak), aks holda baza 5 soat oldinga
 * ketadi.
 */
export function toUz(d: Date): Date {
  return new Date(d.getTime() + (d.getTimezoneOffset() + UZ_OFFSET_MIN) * 60_000);
}

/** Toshkent vaqtidagi "hozir" — formatlash uchun (toUz izohiga qarang). */
export function uzNow(): Date {
  return toUz(new Date());
}

const p2 = (n: number) => String(n).padStart(2, "0");

/** "2026-08-29" — Toshkent kuni. */
export function uzDateIso(d: Date = new Date()): string {
  const u = toUz(d);
  return `${u.getFullYear()}-${p2(u.getMonth() + 1)}-${p2(u.getDate())}`;
}

/** "11:42" — Toshkent soati. */
export function uzTimeHm(d: Date = new Date()): string {
  const u = toUz(d);
  return `${p2(u.getHours())}:${p2(u.getMinutes())}`;
}

/**
 * Toshkent taqvimidagi kun kaliti — masalan 29.08.2026 uchun `20260829`.
 *
 * SANALARNI SOLISHTIRISH uchun shu ishlatilsin, `Date` obyektlari emas.
 * Sabab: bir tomoni siljitilgan (`toUz`), ikkinchisi siljitilmagan ikkita
 * `Date` ni taqqoslash 5 soatlik jimgina xatoga olib keladi. Kun kaliti
 * oddiy son — uni noto'g'ri o'lchovda taqqoslab bo'lmaydi.
 */
export function uzDayKey(d: Date = new Date()): number {
  const u = toUz(d);
  return u.getFullYear() * 10000 + (u.getMonth() + 1) * 100 + u.getDate();
}

/** Bugundan `days` kun keyingi Toshkent kunining kaliti. */
export function uzDayKeyIn(days: number): number {
  return uzDayKey(new Date(Date.now() + days * 86_400_000));
}

/** "29.08.2026 | 11:42" — loyihadagi eng ko'p uchraydigan format. */
export function uzStamp(d: Date = new Date()): string {
  const u = toUz(d);
  return `${p2(u.getDate())}.${p2(u.getMonth() + 1)}.${u.getFullYear()} | ${p2(u.getHours())}:${p2(u.getMinutes())}`;
}

/**
 * "2026-09-03T14:30:00" — Toshkent DEVOR-SOATI satri.
 *
 * `tasks.date` aynan shu shaklda saqlanadi (topshiriq oynasi shuni yozadi).
 * `new Date(...).toISOString().slice(0,16)` bilan ADASHTIRMANG: u UTC
 * beradi, ya'ni Toshkentdagi 14:30 bazaga 09:30 bo'lib tushadi.
 */
export function uzWall(d: Date = new Date()): string {
  const u = toUz(d);
  return `${u.getFullYear()}-${p2(u.getMonth() + 1)}-${p2(u.getDate())}T${p2(u.getHours())}:${p2(u.getMinutes())}:00`;
}

/**
 * `tasks.date` ni HAQIQIY LAHZAGA (epoch ms) aylantiradi. Yaroqsiz bo'lsa
 * `null`.
 *
 * NEGA ALOHIDA PARSER KERAK. Bu maydonni bir nechta joy to'ldiradi va
 * yozuvdagi yagona tekshiruv — `isTaskDate` (lib/tasksData.ts) — `new Date()`
 * o'qiy oladigan HAR QANDAY satrni qabul qiladi. Bazada shu sabab ikki xil
 * shakl yonma-yon yotibdi:
 *   • "2026-09-03T14:30:00"       — Toshkent devor-soati (topshiriq oynasi)
 *   • "2026-09-02T04:00:00.000Z"  — haqiqiy lahza (kanban surish, ko'chirish)
 *
 * Mintaqa belgisi BOR bo'lsa satr haqiqiy lahza — o'z holicha o'qiladi.
 * BO'LMASA u Toshkent devor-soati va +05:00 qo'shiladi: `new Date(s)` uni
 * SERVER zonasida o'qiydi, ya'ni Vercel'da (UTC) 5 soatlik xato beradi.
 *
 * `NaN` emas, `null` QAYTARADI. `new Date(NaN).toISOString()` RangeError
 * otadi — bitta buzuq qator butun bildirishnomalar so'rovini yiqitardi.
 */
export function uzParseStamp(s: unknown): number | null {
  if (typeof s !== "string") return null;
  const t = /(?:Z|[+-]\d{2}:?\d{2})$/.test(s)
    ? Date.parse(s)
    : /^\d{4}-\d{2}-\d{2}$/.test(s)
      ? Date.parse(`${s}T00:00:00+05:00`)
      : /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(s)
        ? Date.parse(`${s}:00+05:00`)
        : /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?$/.test(s)
          ? Date.parse(`${s}+05:00`)
          : NaN;
  return Number.isFinite(t) ? t : null;
}
