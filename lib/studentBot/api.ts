import {
  answerCallbackQuery,
  callTelegram,
  editHtml,
  telegramErrorMessage,
  type InlineKeyboard,
  type ReplyMarkup,
} from "@/lib/telegramApi";
import type { StudentBotConfig } from "@/lib/studentBot/config";

// O'quvchilar boti uchun yuborish qobig'i.
//
// FARQI XODIMLAR BOTIDAN: u yerda xabar guruhga ketadi va yiqilishi
// KO'RINADIGAN nosozlik (kassa xabari yo'qoladi). Bu yerda esa manzil —
// bitta odamning shaxsiy yozishmasi va u botni istalgan payt bloklashi
// mumkin. Bu XATO EMAS, oddiy hol. Shu bois `sendToStudent` otmaydi:
// natijani qaytaradi va chaqiruvchi kerak bo'lsa belgi qo'yadi.

/** Yuborish natijasi — chaqiruvchi shunga qarab qaror qiladi. */
export type SendOutcome =
  | { ok: true; messageId: number }
  /** Odam botni bloklagan yoki suhbatni o'chirgan — qayta urinish ma'nosiz. */
  | { ok: false; blocked: true; error: string }
  | { ok: false; blocked: false; error: string };

/**
 * Telegram "bu odamga yozib bo'lmaydi" deyaptimi.
 *
 * 403 — bloklangan yoki suhbat o'chirilgan. 400 + "chat not found" —
 * hisob o'chirilgan. Ikkalasida ham qayta urinish foydasiz, shuning
 * uchun chat BELGILANADI va keyingi pushlar uni chetlab o'tadi.
 */
function isBlocked(code: number | undefined, desc: string): boolean {
  if (code === 403) return true;
  return code === 400 && /chat not found|user is deactivated/i.test(desc);
}

export async function sendToStudent(
  cfg: StudentBotConfig,
  chatId: number,
  html: string,
  replyMarkup?: ReplyMarkup,
): Promise<SendOutcome> {
  if (!cfg.token) return { ok: false, blocked: false, error: "TELEGRAM_STUDENT_BOT_TOKEN sozlanmagan" };

  const data = await callTelegram(cfg.token, "sendMessage", {
    chat_id: chatId,
    text: html,
    parse_mode: "HTML",
    disable_web_page_preview: true,
    ...(replyMarkup ? { reply_markup: replyMarkup } : {}),
  });

  if (data.ok && data.result) return { ok: true, messageId: data.result.message_id };

  const desc = data.description || "noma'lum xato";
  return {
    ok: false,
    blocked: isBlocked(data.error_code, desc),
    error: telegramErrorMessage(desc, String(chatId)),
  };
}

/**
 * Menyu xabarini JOYIDA yangilaydi.
 *
 * NEGA TAHRIRLASH, YANGI XABAR EMAS: o'quvchi menyuda o'nlab marta
 * yuradi ("Davomat" -> orqaga -> "To'lovlar" -> orqaga …). Har bosishda
 * yangi xabar yuborilsa yozishma bir necha kunda foydalanib bo'lmaydigan
 * holga kelardi.
 *
 * `false` qaytsa chaqiruvchi YANGI xabar yuboradi: xabar juda eski
 * bo'lsa yoki foydalanuvchi uni o'chirgan bo'lsa tahrirlash ishlamaydi
 * va bu holatda menyu umuman ko'rinmay qolishi mumkin emas.
 */
export async function editStudentMenu(
  cfg: StudentBotConfig,
  chatId: number,
  messageId: number,
  html: string,
  keyboard: InlineKeyboard,
): Promise<boolean> {
  try {
    await editHtml(cfg.token, String(chatId), messageId, html, keyboard);
    return true;
  } catch (e) {
    console.error("[student-bot] menyu tahrirlanmadi:", e instanceof Error ? e.message : e);
    return false;
  }
}

/** Tugma bosilishiga javob — o'zi hech qachon otmaydi. */
export async function answerStudent(cfg: StudentBotConfig, callbackId: string, text: string): Promise<void> {
  await answerCallbackQuery(cfg.token, callbackId, text);
}

/**
 * Oddiy ("reply") klaviaturani olib tashlaydi.
 *
 * Telefon so'ralgandan keyin "📱 Telefon raqamni yuborish" tugmasi
 * kirish maydonining ustida OSILIB QOLADI — `one_time_keyboard` uni
 * faqat yashiradi, o'chirmaydi. Bog'langan odamga bu tugma keraksiz va
 * chalg'ituvchi.
 */
export async function dropReplyKeyboard(cfg: StudentBotConfig, chatId: number, text: string): Promise<void> {
  await callTelegram(cfg.token, "sendMessage", {
    chat_id: chatId,
    text,
    parse_mode: "HTML",
    reply_markup: { remove_keyboard: true },
  });
}
