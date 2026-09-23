// XODIMLAR BOTI (@akademiya_crm_bot — @tizimli_akademiya_bot EMAS, u
// o'quvchilar boti, lib/studentBot) — sozlama.
//
// Bu O'SHA BOT: guruh topiklariga to'lov/oylik/lid xabarlarini yuboradigan
// va lid tugmalarini qabul qiladigan (lib/sync/telegram.ts,
// app/api/telegram/webhook). 18.09.2026 dan u kassir bilan SHAXSIY
// yozishmada ham ishlaydi — to'lov kiritish va kassa holati
// (lib/staffBot/*). Yangi token yo'q: `TELEGRAM_BOT_TOKEN` ning o'zi.
//
// Webhook `allowed_updates` ga `message` QO'SHILGAN bo'lishi shart
// (scripts/set-telegram-webhook.mjs), aks holda Telegram xabarlarni
// umuman yubormaydi va bot faqat tugmalarga javob beradi.

export interface StaffBotConfig {
  /** `TELEGRAM_BOT_TOKEN` — xodimlar botining kaliti. */
  token: string;
  /**
   * Kassaga oid HAR BIR amal jurnalda shu belgi bilan yoziladi
   * (lib/transactionEntries.ts → `origin`).
   */
  origin: "telegram";
}

export function loadStaffBotConfig(): StaffBotConfig {
  return {
    token: (process.env.TELEGRAM_BOT_TOKEN || "").trim(),
    origin: "telegram",
  };
}

export function isStaffBotReady(cfg: StaffBotConfig): boolean {
  return cfg.token.length > 0;
}
