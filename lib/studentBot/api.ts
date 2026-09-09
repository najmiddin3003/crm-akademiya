import {
  answerCallbackQuery,
  callTelegram,
  editHtml,
  telegramErrorMessage,
  type InlineKeyboard,
  type ReplyMarkup,
} from "@/lib/telegramApi";
import type { StudentBotConfig } from "@/lib/studentBot/config";
import { hasCustomEmoji, stripCustomEmoji } from "@/lib/studentBot/premiumEmoji";

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

/**
 * MAXSUS EMOJI xabarni yiqitdimi.
 *
 * Telegram botga maxsus (premium) emoji yuborishga ruxsat berishi uchun
 * bot egasi Fragment'da username sotib olgan bo'lishi kerak. Ruxsat
 * bo'lmasa yoki ID eskirgan bo'lsa BUTUN xabar rad etiladi — ya'ni
 * o'quvchi xush kelibsiz matnini umuman ko'rmay qolardi.
 *
 * Xatoning aniq matni Telegram tomonida bir necha xil ("can't parse
 * entities", "CUSTOM_EMOJI_INVALID", oddiy "Bad Request"), shu bois
 * unga TAYANMAYMIZ: matnda maxsus emoji bo'lsa va yuborish bloklanish
 * sababidan boshqa sababga ko'ra bo'lmasa — bir marta oddiy emoji
 * bilan qayta uriniladi.
 */
function shouldRetryPlain(html: string, blocked: boolean): boolean {
  return !blocked && hasCustomEmoji(html);
}

export async function sendToStudent(
  cfg: StudentBotConfig,
  chatId: number,
  html: string,
  replyMarkup?: ReplyMarkup,
): Promise<SendOutcome> {
  if (!cfg.token) return { ok: false, blocked: false, error: "TELEGRAM_STUDENT_BOT_TOKEN sozlanmagan" };

  const post = async (text: string): Promise<SendOutcome> => {
    const data = await callTelegram(cfg.token, "sendMessage", {
      chat_id: chatId,
      text,
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
  };

  const first = await post(html);
  if (first.ok || !shouldRetryPlain(html, first.blocked)) return first;

  console.error("[student-bot] maxsus emoji bilan ketmadi, oddiysi bilan qayta:", first.error);
  return post(stripCustomEmoji(html));
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
  }

  // Sabab maxsus emoji bo'lishi mumkin — oddiysi bilan bir marta qayta.
  if (!hasCustomEmoji(html)) return false;
  try {
    await editHtml(cfg.token, String(chatId), messageId, stripCustomEmoji(html), keyboard);
    return true;
  } catch {
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
