// XODIMLAR BOTI — sozlama. Xodimlar QAYSI BOTDA ishlashi — shu fayldagi
// `STAFF_BOT_HOST` (YAGONA joy: token, @nom, QR havolasi, Mini App imzosi,
// webhook'lardagi yo'naltirish hammasi shundan).
//
// TARIX:
//   18.09.2026 — @akademiya_crm_bot (guruh boti bilan bitta: kassa).
//   29.09.2026 — @tizimli_akademiya_bot (o'quvchilar bilan bitta bot,
//                lib/botDispatch.ts ajratadi).
//   17.10.2026 — YANA @akademiya_crm_bot. @tizimli_akademiya_bot ga ManyChat
//                ulandi (yangi o'quvchilarga avtomatik javob), Telegram esa
//                botga BITTA webhook beradi — o'sha botning xabarlari endi
//                CRM'ga kelmaydi, xodimlar kira olmay qoldi. Foydalanuvchi:
//                «xodimlarni akademiya_crm_bot ga o'tkaz».
//
// Ikkinchi bot (xodimlar ISHLAMAYDIGAN) unga yozgan xodimni to'g'ri botga
// yo'naltiradi (lib/staffBot/moved.ts), Mini App'da esa uning imzosi tanilib,
// o'sha gap aytiladi (lib/staffBot/webapp.ts). Sessiyalar ko'chirilmaydi:
// `staff_bot_users.chatId` — Telegram foydalanuvchi id'si, ikki botda bir xil.

/**
 * "crm"     — @akademiya_crm_bot (`TELEGRAM_BOT_TOKEN`, webhook /api/telegram/webhook);
 * "student" — @tizimli_akademiya_bot (`TELEGRAM_STUDENT_BOT_TOKEN`, webhook
 *             /api/telegram/student, o'quvchilar bilan bitta).
 */
export type StaffBotHost = "crm" | "student";

export const STAFF_BOT_HOST: StaffBotHost = "crm";

/** Xodimlar ISHLAMAYDIGAN bot — u yerga kelgan xodim yo'naltiriladi. */
export const OTHER_BOT_HOST: StaffBotHost = STAFF_BOT_HOST === "crm" ? "student" : "crm";

export interface StaffBotConfig {
  /** Xodimlar ishlaydigan botning kaliti (`STAFF_BOT_HOST`). */
  token: string;
  /**
   * Kassaga oid HAR BIR amal jurnalda shu belgi bilan yoziladi
   * (lib/transactionEntries.ts → `origin`).
   */
  origin: "telegram";
}

function tokenOf(host: StaffBotHost): string {
  return ((host === "crm" ? process.env.TELEGRAM_BOT_TOKEN : process.env.TELEGRAM_STUDENT_BOT_TOKEN) || "").trim();
}

/**
 * Botning @nomi. `getMe` so'ralmaydi (QR ekrani har 30 soniyada yangilanadi):
 * `TELEGRAM_BOT_USERNAME` / `TELEGRAM_STUDENT_BOT_USERNAME`, bo'lmasa
 * haqiqiy nomlar.
 */
function usernameOf(host: StaffBotHost): string {
  const raw = host === "crm" ? process.env.TELEGRAM_BOT_USERNAME : process.env.TELEGRAM_STUDENT_BOT_USERNAME;
  return (raw || "").trim().replace(/^@/, "") || (host === "crm" ? "akademiya_crm_bot" : "tizimli_akademiya_bot");
}

export function loadStaffBotConfig(): StaffBotConfig {
  return {
    token: tokenOf(STAFF_BOT_HOST),
    origin: "telegram",
  };
}

/** Xodimlar botining @nomi — QR havolasi (lib/attendanceQr.ts) va yo'naltirish tugmasi uchun. */
export function staffBotUsername(): string {
  return usernameOf(STAFF_BOT_HOST);
}

/**
 * Xodimlar ISHLAMAYDIGAN botning kaliti — unga yozgan xodimga javob berish
 * (lib/staffBot/moved.ts) va o'sha bot menyusidan ochilgan Mini App'ni TANISH
 * uchun (lib/staffBot/webapp.ts).
 */
export function otherBotToken(): string {
  return tokenOf(OTHER_BOT_HOST);
}

/**
 * `t.me/<bot>?start=xodim` — xodimlar bo'limini ochadigan havola parametri
 * (yo'naltirish tugmasi, lib/staffBot/moved.ts; o'quvchilar bilan umumiy botda
 * lib/botDispatch.ts uni xodim oqimiga beradi).
 */
export const STAFF_START_PARAM = "xodim";

/** Saytning tashqi manzili — botdagi havolalar uchun (oxirida `/` yo'q). */
export function publicSiteUrl(): string {
  return (process.env.PUBLIC_SITE_URL || "").trim().replace(/\/+$/, "") || "https://www.tizimli24.uz";
}

/**
 * «👤 Profilim» Mini App manzili (28.09.2026) — xodim o'z profilini saytdagidek
 * ko'radi. Kirish — `initData` imzosi shu bot kaliti bilan (app/api/xodim).
 */
export function staffProfileUrl(): string {
  return `${publicSiteUrl()}/xodim`;
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
