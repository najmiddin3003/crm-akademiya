// Sotuv va marketing → Marketing (sidebar: Sotuv va marketing > Marketing,
// href /sales-marketing). MongoDB `surveys` kolleksiyasi.
//
// Bu "umumiy marketing" sahifasi emas — lid MANBALARI so'rovnomasi: har bir
// manba (Banner/Youtube/Telegram/Instagram) uchun alohida kod beriladi.
// G'oya shuki, lid o'sha kodli havola orqali kelsa, buyurtmaning `survey`
// maydoniga kod yozilib, lid qaysi manbadan kelgani ma'lum bo'ladi.
export interface Survey {
  id: number;
  title: string; // Sarlavha
  image: string; // Rasm (URL yoki bo'sh)
  code: string; // "s26" — manba kodi
}

// HAVOLA YASOVCHILAR OLIB TASHLANDI (surveyWebLink/surveyBotLink/
// surveyTildaLink va ular ostidagi SURVEY_*_BASE konstantalari).
//
// NEGA: ular uchta yolg'on havola hosil qilardi.
//   1) Veb havolasi "https://akademiya.edutizim.uz/order/entry/?survey=" —
//      bu loyiha KLON qilayotgan BEGONA sayt. Nusxalab tarqatilgan havola
//      mijozni boshqa odamning saytiga olib borardi, bu yerdagi bazaga esa
//      hech narsa tushmasdi.
//   2) Bot havolasi "https://telegram.me/Akademiya2025_bot?start=" —
//      loyihada Telegram bot umuman yo'q (na token, na webhook).
//   3) Tilda havolasi "https://tilda.cc/form/?survey=" — bu Tilda formasining
//      manzili ham emas, shunchaki o'ylab topilgan satr.
// Eng muhimi: butun loyihada `?survey=` kodini QAYTA O'QIYDIGAN birorta joy
// yo'q — ommaviy lid qabul qiladigan sahifa ham, API ham yo'q (app/ariza
// faqat ishga qabul anketasi). Ya'ni havola ishlaganda ham manba
// biriktirilmasdi.
//
// Kod (`code`) esa HAQIQIY va saqlanadi — buyurtmaning "So'rovnoma" maydoniga
// qo'lda yoziladi va buyurtmalar ro'yxatida shu bo'yicha filtrlash ishlaydi
// (lib/ordersData.ts). Shu bois sahifa endi kodning o'zini ko'rsatadi.
//
// Havolalarni tiklash uchun kerak bo'ladi: shu ilovaning O'Z manzilida
// ommaviy lid formasi (sahifa + ochiq POST endpoint) va u `?survey=` kodini
// yangi buyurtmaning `survey` maydoniga yozishi.
