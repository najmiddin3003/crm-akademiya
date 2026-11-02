// SINOV SAYTI QOROVULI — tashqi dunyoga YOZADIGAN kanallar uchun bitta qoida (02.11.2026).
//
// NEGA KERAK: CLAUDE.md bo'yicha har chiqarish avval sinov domenida (`v2-ui` → Vercel preview)
// ko'riladi. Preview Atlas'dagi zaxira nusxadan (kechagi prod ma'lumoti — haqiqiy o'quvchi va
// xodimlar, haqiqiy telefonlar) ishlaydi, Vercel loyihasida esa HAQIQIY kalitlar turibdi: Eskiz
// (SMS), Google service account (to'lovlar va oyliklar jadvali), Telegram bot. Qorovulsiz sinovda
// bosilgan tugma haqiqiy odamga SMS, haqiqiy jadvalga qator yoki guruhga xabar yuborardi — Sheets
// sinxroni sukut bo'yicha YOQIQ (lib/sync/config.ts: faqat `SYNC_ENABLED=false` o'chiradi).
//
// QOIDA: Vercel'da (`VERCEL=1` — Vercel har deploy'ga o'zi qo'yadi, unutib bo'lmaydi; VPS'da yo'q)
// uchala kanal O'CHIQ. Har birining o'z bayrog'i:
//   <KANAL>_SEND=on  — Vercel'da ham yozadi (Vercel'ga orqaga qaytish, deploy/README.md 13-band);
//   <KANAL>_SEND=off — istalgan joyda o'chiradi (masalan lokal sinov).
//
// QAYERDA:
//   TELEGRAM_SEND — lib/telegramApi.ts → callTelegram (`get*` dan boshqa hamma metod);
//   SMS_SEND      — lib/eskiz.ts → sendSms (taklif, parol tiklash, to'lov SMS'i, «Xabarlar» — hammasi
//                   shu yerdan); SMS taqlid qilinadi (`simulated`), oqim to'xtamaydi;
//   SHEETS_SEND   — lib/sync: isSheetsReady (jadval qadami jim o'tkazib yuboriladi) va sheetsFetch
//                   (Google'ga umuman chiqmaydi — o'qish ham, yozish ham).
// Cloudinary'ga faqat YUKLASH bor (o'chirish yo'q) — prod rasmlariga tegmaydi, qorovul shart emas.

export type OutboundChannel = "telegram" | "sms" | "sheets";

const FLAG: Record<OutboundChannel, string> = {
  telegram: "TELEGRAM_SEND",
  sms: "SMS_SEND",
  sheets: "SHEETS_SEND",
};

/** Sabab matni (log va Sinxronizatsiya sahifasi uchun; messages/en.json da kalit). */
export const MUTED_REASON: Record<OutboundChannel, string> = {
  telegram: "sinov sayti — Telegram'ga yozish o'chiq (TELEGRAM_SEND)",
  sms: "sinov sayti — SMS yuborish o'chiq (SMS_SEND)",
  sheets: "sinov sayti — Google jadvalga yozish o'chiq (SHEETS_SEND)",
};

/** Shu kanal orqali tashqariga yozish o'chiqmi. */
export function outboundMuted(channel: OutboundChannel): boolean {
  const flag = (process.env[FLAG[channel]] || "").trim().toLowerCase();
  if (flag === "on") return false;
  if (flag === "off") return true;
  return process.env.VERCEL === "1";
}
