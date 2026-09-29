// XODIMLAR BOTI — sozlama.
//
// 29.09.2026 dan xodimlar @tizimli_akademiya_bot da ishlaydi (foydalanuvchi:
// "tizimli_akademiya botida xodimlar ishlashi kerak, crm_akademiya botimiz
// faqat to'lovlarni guruhga yozadi"). Token — o'quvchilar botiniki
// (`TELEGRAM_STUDENT_BOT_TOKEN`), webhook — `/api/telegram/student`: bitta
// botda ikki oqim, yozgan odam xodimmi yoki o'quvchi/ota-onami —
// lib/botDispatch.ts ajratadi.
//
// @akademiya_crm_bot (`TELEGRAM_BOT_TOKEN`) endi faqat GURUH boti: to'lov/
// oylik/lid xabarlari va lid tugmalari (lib/sync/telegram.ts,
// app/api/telegram/webhook). Unga shaxsiy yozgan xodim yangi botga
// yo'naltiriladi (lib/staffBot/moved.ts).

export interface StaffBotConfig {
  /** `TELEGRAM_STUDENT_BOT_TOKEN` — @tizimli_akademiya_bot kaliti (o'quvchilar bilan umumiy). */
  token: string;
  /**
   * Kassaga oid HAR BIR amal jurnalda shu belgi bilan yoziladi
   * (lib/transactionEntries.ts → `origin`).
   */
  origin: "telegram";
}

export function loadStaffBotConfig(): StaffBotConfig {
  return {
    token: (process.env.TELEGRAM_STUDENT_BOT_TOKEN || "").trim(),
    origin: "telegram",
  };
}

/**
 * Botning @nomi — QR havolasi (lib/attendanceQr.ts) va eski botdagi
 * yo'naltirish tugmasi uchun. `getMe` so'ralmaydi (QR ekrani har 30 soniyada
 * yangilanadi): `TELEGRAM_STUDENT_BOT_USERNAME`, bo'lmasa @tizimli_akademiya_bot.
 */
export function staffBotUsername(): string {
  return (process.env.TELEGRAM_STUDENT_BOT_USERNAME || "").trim().replace(/^@/, "") || "tizimli_akademiya_bot";
}

/**
 * `t.me/<bot>?start=xodim` — xodimlar bo'limini ochadigan havola parametri
 * (eski botdagi yo'naltirish tugmasi, lib/staffBot/moved.ts; lib/botDispatch.ts
 * uni xodim oqimiga beradi).
 */
export const STAFF_START_PARAM = "xodim";

/**
 * ESKI xodimlar botining (@akademiya_crm_bot) kaliti — faqat uning menyusida
 * qolgan Mini App tugmasini TANISH uchun (lib/staffBot/webapp.ts): imzo shu
 * kalitga mos kelsa, xodimga "bot ko'chdi" deyiladi.
 */
export function legacyStaffBotToken(): string {
  return (process.env.TELEGRAM_BOT_TOKEN || "").trim();
}

/**
 * «👤 Profilim» Mini App manzili (28.09.2026) — xodim o'z profilini saytdagidek
 * ko'radi. Kirish — `initData` imzosi shu bot kaliti bilan (app/api/xodim).
 */
export function staffProfileUrl(): string {
  const base = (process.env.PUBLIC_SITE_URL || "").trim().replace(/\/+$/, "") || "https://www.tizimli24.uz";
  return `${base}/xodim`;
}

/**
 * «📷 Ishga keldim» / «🏁 Ishdan ketdim» Mini App'i — Telegram ichidagi QR
 * skaner (28.09.2026, lib/attendanceQr.ts). Kirish — `initData` (app/api/xodim).
 */
export function staffCheckinUrl(kind: "in" | "out"): string {
  return `${staffProfileUrl()}/keldim${kind === "out" ? "?k=out" : ""}`;
}

export function isStaffBotReady(cfg: StaffBotConfig): boolean {
  return cfg.token.length > 0;
}
