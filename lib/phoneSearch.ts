// Qidiruvda TELEFON RAQAMINI solishtirish uchun yagona qoida.
//
// NEGA ALOHIDA FAYL. Qoida ikki joyda kerak: serverda
// (app/api/search/students — Mongo naqshi) va klientda (lib/search.ts —
// natijalarni chizishdan oldingi filtr). Ular ayri yozilgan edi va aynan
// shu sabab bilan buzildi:
//
//   bazada raqam "94 111 88 55" ko'rinishida saqlanadi;
//   "1118855" deb qidirilganda SERVER uni to'g'ri topardi (ajratkichga
//   chidamli naqsh bilan), KLIENT esa oddiy `includes` bilan qayta
//   filtrlab, o'sha yagona natijani tashlab yuborardi — foydalanuvchi
//   "Natija topilmadi" ko'rardi.
//
// Endi ikkalasi ham shu yerdagi bitta funksiyadan boshlanadi.

/**
 * Qidiruv matnidan solishtirishga yaroqli RAQAMLARNI ajratadi.
 *
 * `null` — qidirishga arzimaydi (3 tadan kam raqam deyarli hamma raqamga
 * mos keladi).
 *
 * `998` prefiksi tashlanadi: bazada raqam 9 xonali saqlanadi, lekin odam
 * to'liq "+998 94 155 88 55" ko'rinishida nusxalashi mumkin.
 */
export function searchPhoneDigits(term: string): string | null {
  let d = term.replace(/\D/g, "");
  if (d.length > 9 && d.startsWith("998")) d = d.slice(3);
  return d.length >= 3 ? d : null;
}

/**
 * Mongo uchun ajratkichga chidamli naqsh: "941558855" ->
 * /9[^0-9]*4[^0-9]*1.../ — bo'shliq, qavs va chiziqchalar to'smaydi.
 */
export function phoneSearchPattern(term: string): string | null {
  const d = searchPhoneDigits(term);
  return d && d.split("").join("[^0-9]*");
}
