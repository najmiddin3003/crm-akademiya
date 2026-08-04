// Sotuv va marketing → Marketing (sidebar: Sotuv va marketing > Marketing,
// href /sales-marketing). MongoDB `surveys` kolleksiyasi.
//
// Bu "umumiy marketing" sahifasi emas — lid MANBALARI so'rovnomasi: har bir
// manba (Banner/Youtube/Telegram/Instagram) uchun alohida kod beriladi va
// shu koddan veb/bot/Tilda havolalari hosil qilinadi. Buyurtma shu havola
// orqali kelsa, lid qaysi manbadan kelgani ma'lum bo'ladi.
export interface Survey {
  id: number;
  title: string; // Sarlavha
  image: string; // Rasm (URL yoki bo'sh)
  code: string; // "s26" — havolalar shundan yasaladi
}

// Havolalar saqlanmaydi, koddan hosil qilinadi — domen/bot nomi
// o'zgarganda barcha yozuvlarni yangilash kerak bo'lmasligi uchun.
export const SURVEY_WEB_BASE = "https://akademiya.edutizim.uz/order/entry/?survey=";
export const SURVEY_BOT_BASE = "https://telegram.me/Akademiya2025_bot?start=";
export const SURVEY_TILDA_BASE = "https://tilda.cc/form/?survey=";

export function surveyWebLink(s: Survey): string {
  return SURVEY_WEB_BASE + s.code;
}
export function surveyBotLink(s: Survey): string {
  return SURVEY_BOT_BASE + s.code;
}
export function surveyTildaLink(s: Survey): string {
  return SURVEY_TILDA_BASE + s.code;
}
