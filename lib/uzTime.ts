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

/** "29.08.2026 | 11:42" — loyihadagi eng ko'p uchraydigan format. */
export function uzStamp(d: Date = new Date()): string {
  const u = toUz(d);
  return `${p2(u.getDate())}.${p2(u.getMonth() + 1)}.${u.getFullYear()} | ${p2(u.getHours())}:${p2(u.getMinutes())}`;
}
