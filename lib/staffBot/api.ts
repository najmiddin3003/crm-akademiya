import {
  answerCallbackQuery,
  callTelegram,
  editHtml,
  telegramErrorMessage,
  type InlineKeyboard,
  type ReplyMarkup,
} from "@/lib/telegramApi";
import type { StaffBotConfig } from "@/lib/staffBot/config";

// Xodimlar boti — SHAXSIY yozishma uchun yuborish qobig'i.
//
// lib/sync/telegram.ts dan FARQI: u guruhga yozadi va yiqilishi
// KO'RINADIGAN nosozlik (to'lov xabari yo'qoladi), shu bois OTADI. Bu
// yerda manzil — bitta kassirning shaxsiy chati; u botni bloklashi yoki
// suhbatni o'chirishi mumkin va bu xato emas. Shuning uchun
// `sendToStaff` otmaydi — natijani qaytaradi (o'quvchilar botidagi
// lib/studentBot/api.ts bilan bir xil qolip, premium emojisiz).

export type SendOutcome =
  | { ok: true; messageId: number }
  /** Odam botni bloklagan yoki suhbatni o'chirgan — qayta urinish ma'nosiz. */
  | { ok: false; blocked: true; error: string }
  | { ok: false; blocked: false; error: string };

function isBlocked(code: number | undefined, desc: string): boolean {
  if (code === 403) return true;
  return code === 400 && /chat not found|user is deactivated/i.test(desc);
}

export async function sendToStaff(
  cfg: StaffBotConfig,
  chatId: number,
  html: string,
  replyMarkup?: ReplyMarkup,
): Promise<SendOutcome> {
  if (!cfg.token) return { ok: false, blocked: false, error: "TELEGRAM_BOT_TOKEN sozlanmagan" };

  const data = await callTelegram(cfg.token, "sendMessage", {
    chat_id: chatId,
    text: html,
    parse_mode: "HTML",
    disable_web_page_preview: true,
    ...(replyMarkup ? { reply_markup: replyMarkup } : {}),
  });
  if (data.ok && data.result) return { ok: true, messageId: data.result.message_id };

  const desc = data.description || "noma'lum xato";
  return { ok: false, blocked: isBlocked(data.error_code, desc), error: telegramErrorMessage(desc, String(chatId)) };
}

/**
 * Menyu xabarini JOYIDA yangilaydi. `false` — tahrirlab bo'lmadi (xabar
 * juda eski yoki o'chirilgan), chaqiruvchi YANGI xabar yuboradi.
 */
export async function editStaffMenu(
  cfg: StaffBotConfig,
  chatId: number,
  messageId: number,
  html: string,
  keyboard?: InlineKeyboard,
): Promise<boolean> {
  try {
    await editHtml(cfg.token, String(chatId), messageId, html, keyboard);
    return true;
  } catch (e) {
    console.error("[staff-bot] menyu tahrirlanmadi:", e instanceof Error ? e.message : e);
    return false;
  }
}

/** Tugma bosilishiga javob — o'zi hech qachon otmaydi. */
export async function answerStaff(cfg: StaffBotConfig, callbackId: string, text = ""): Promise<void> {
  await answerCallbackQuery(cfg.token, callbackId, text);
}

/**
 * FOYDALANUVCHINING xabarini o'chiradi — PAROL uchun.
 *
 * Telegram Bot API shaxsiy chatda kiruvchi xabarni o'chirishga ruxsat
 * beradi (48 soatgacha). Parol yozilgan xabar chat tarixida qolmasin:
 * telefon boshqa odamning qo'liga tushsa CRM paroli ko'rinib turardi.
 * O'chirilmasa ham (masalan Telegram vaqtincha javob bermasa) kirish
 * to'xtamaydi — kassir ogohlantiriladi (lib/staffBot/router.ts).
 */
export async function deleteUserMessage(cfg: StaffBotConfig, chatId: number, messageId: number): Promise<boolean> {
  try {
    const data = await callTelegram(cfg.token, "deleteMessage", { chat_id: chatId, message_id: messageId });
    return data.ok;
  } catch (e) {
    console.error("[staff-bot] xabar o'chirilmadi:", e instanceof Error ? e.message : e);
    return false;
  }
}

/**
 * Oddiy ("reply") klaviaturani olib tashlaydi — telefon tugmasi kirish
 * maydonining ustida osilib qolmasin. Telegramda buni xabarsiz qilib
 * bo'lmaydi: xabar yuboriladi va darhol o'chiriladi
 * (lib/studentBot/api.ts dagi bilan bir xil sabab).
 */
export async function dropReplyKeyboard(cfg: StaffBotConfig, chatId: number): Promise<void> {
  const data = await callTelegram(cfg.token, "sendMessage", {
    chat_id: chatId,
    text: "⌛",
    reply_markup: { remove_keyboard: true },
  });
  if (!data.ok || !data.result) return;
  await callTelegram(cfg.token, "deleteMessage", { chat_id: chatId, message_id: data.result.message_id });
}
