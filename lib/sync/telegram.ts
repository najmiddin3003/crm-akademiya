import type { SyncConfig } from "@/lib/sync/config";
import {
  answerCallbackQuery,
  editHtml,
  getMe,
  sendHtml,
  type InlineKeyboard,
} from "@/lib/telegramApi";

// XODIMLAR boti — ichki guruhlarga xabar yuborish. Paket kerak emas,
// oddiy fetch yetadi.
//
// Bot ikkala guruhga ADMIN qilib qo'shilishi kerak: oddiy a'zo sifatida
// bot guruhga yoza olmaydi (Telegram cheklovi).
//
// HTTP QATLAMI BU YERDA EMAS. Qayta urinish, eskeyplash va xato
// matnlari lib/telegramApi.ts ga ko'chirildi — o'quvchilar boti ham
// aynan o'shalarni ishlatadi (lib/studentBot/api.ts). Bu yerda faqat
// `SyncConfig` ni tokenga aylantiradigan yupqa qobiq qoldi, ya'ni
// chaqiruvchilar uchun hech narsa o'zgarmadi.

// Eskeyplash qoidasi ikkala botda bir xil — bitta joydan tarqaladi.
export { esc } from "@/lib/telegramApi";
export type { InlineKeyboard } from "@/lib/telegramApi";

export interface TelegramResult {
  messageId: number;
}

/**
 * @param threadId Guruh ichidagi TOPIC raqami. Bo'sh bo'lsa xabar umumiy
 *   oqimga tushadi. Bitta forum-guruhni ikki oqimga bo'lish uchun shu
 *   yetadi — alohida guruh ochish shart emas.
 */
export async function sendMessage(
  cfg: SyncConfig,
  chatId: string,
  html: string,
  threadId = "",
  replyMarkup?: InlineKeyboard,
): Promise<TelegramResult> {
  // Xabar matni XODIMLAR botining sozlamasini nomma-nom aytadi: bu
  // yerga tushgan odam aynan qaysi o'zgaruvchini to'ldirishni bilishi
  // kerak (o'quvchilar botiniki boshqacha nomlanadi).
  if (!cfg.telegramToken) throw new Error("TELEGRAM_BOT_TOKEN sozlanmagan");
  if (!chatId) throw new Error("Telegram guruh id'si sozlanmagan");

  return sendHtml(cfg.telegramToken, chatId, html, { threadId, replyMarkup });
}

/**
 * Yuborilgan xabarni tahrirlash. Lid statusi tugmasi bosilganda aynan shu
 * ishlatiladi: matn qayta chiziladi, tugmalar joyida qoladi (status
 * keyin ham o'zgartirilishi mumkin).
 */
export async function editMessage(
  cfg: SyncConfig,
  chatId: string,
  messageId: number,
  html: string,
  replyMarkup?: InlineKeyboard,
): Promise<void> {
  return editHtml(cfg.telegramToken, chatId, messageId, html, replyMarkup);
}

/** Tugma bosilishiga javob. O'zi hech qachon otmaydi. */
export async function answerCallback(
  cfg: SyncConfig,
  callbackId: string,
  text: string,
): Promise<void> {
  return answerCallbackQuery(cfg.telegramToken, callbackId, text);
}

/** Bot va guruh ulanishini tekshirish — CRM sahifasidagi "Tekshirish" uchun. */
export async function checkBot(cfg: SyncConfig): Promise<{ ok: boolean; username?: string; error?: string }> {
  if (!cfg.telegramToken) return { ok: false, error: "TELEGRAM_BOT_TOKEN sozlanmagan" };
  return getMe(cfg.telegramToken);
}
