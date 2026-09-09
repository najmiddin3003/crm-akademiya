// Telegram Bot API — TOKEN bilan ishlaydigan quyi qatlam.
//
// NEGA ALOHIDA FAYL. Ilgari butun Telegram mantiqi lib/sync/telegram.ts da
// edi va u `SyncConfig` ni qabul qilardi, ya'ni `TELEGRAM_BOT_TOKEN` ga
// QATTIQ bog'langan edi. Endi tizimda IKKITA bot bor:
//
//   xodimlar boti    — ichki guruhlarga to'lov/oylik xabarlari, lid tugmalari
//                      (lib/sync/telegram.ts, TELEGRAM_BOT_TOKEN);
//   o'quvchilar boti — o'quvchi bilan shaxsiy yozishma
//                      (lib/studentBot/*, TELEGRAM_STUDENT_BOT_TOKEN).
//
// Ikkalasiga ham bir xil narsa kerak: qayta urinish qoidasi (429/5xx),
// HTML eskeyplash va Telegram xatolarini odam tushunadigan tilga o'girish.
// Ular shu yerda BITTA marta yozilgan. lib/sync/telegram.ts endi shu
// faylning ustidagi yupqa qobiq — uning tashqi imzosi o'zgarmadi, ya'ni
// sinxronizatsiya moduli avvalgidek ishlayveradi.

const API = "https://api.telegram.org";

/**
 * HTML rejimida yuboriladigan matnda foydalanuvchi kiritgan qism
 * (o'quvchi ismi, izoh) ESKEYP QILINISHI shart. Aks holda ismda "<" yoki
 * "&" bo'lsa Telegram butun xabarni rad etadi, ya'ni bitta g'alati ism
 * tufayli to'lov haqidagi xabar umuman ketmay qoladi.
 */
export function esc(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/**
 * Xabar ostidagi tugmalar. `callback_data` bosilganda Telegram uni
 * webhook'ga qaytaradi — 64 BAYTdan oshmasin.
 */
export interface InlineButton {
  text: string;
  callback_data?: string;
  url?: string;
}

export interface InlineKeyboard {
  inline_keyboard: InlineButton[][];
}

/**
 * Kirish maydoni ustidagi ODDIY tugmalar. O'quvchilar botida faqat bitta
 * joyda kerak: "Telefon raqamni yuborish" — `request_contact` bosilganda
 * Telegram raqamni O'ZI qo'shadi, ya'ni odam qo'lda yozgan (va boshqa
 * odamniki bo'lishi mumkin bo'lgan) raqamga ishonish shart emas.
 */
export interface ReplyKeyboard {
  keyboard: { text: string; request_contact?: boolean }[][];
  resize_keyboard?: boolean;
  one_time_keyboard?: boolean;
  input_field_placeholder?: string;
}

export interface RemoveKeyboard {
  remove_keyboard: true;
}

export type ReplyMarkup = InlineKeyboard | ReplyKeyboard | RemoveKeyboard;

export interface TelegramApiResponse {
  ok: boolean;
  result?: { message_id: number };
  description?: string;
  error_code?: number;
  parameters?: { retry_after?: number };
}

/**
 * Telegram metodini chaqiradi va vaqtinchalik xatolarda qayta uriniladi.
 *
 * Qaytadigan qiymat XOM javob — otmaydi. Chaqiruvchi `ok` ni o'zi
 * tekshiradi; shu bois "xabar ketmadi, lekin bu muhim emas" holatini
 * (masalan bot bloklangan o'quvchi) `try/catch` siz hal qilib bo'ladi.
 */
export async function callTelegram(
  token: string,
  method: string,
  payload: Record<string, unknown>,
  attempt = 0,
): Promise<TelegramApiResponse> {
  const res = await fetch(`${API}/bot${token}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = (await res.json()) as TelegramApiResponse;

  if (data.ok) return data;

  // 429 — juda tez yuborilyapti. Telegram o'zi necha soniya kutishni
  // aytadi; shuni kutamiz (lekin 30 soniyadan ko'p emas, aks holda
  // serverless funksiya vaqti tugab qoladi).
  if (data.error_code === 429 && attempt < 2) {
    const wait = Math.min((data.parameters?.retry_after ?? 1) * 1000, 30_000);
    await new Promise((r) => setTimeout(r, wait));
    return callTelegram(token, method, payload, attempt + 1);
  }
  if ((data.error_code ?? 0) >= 500 && attempt < 2) {
    await new Promise((r) => setTimeout(r, 800 * 2 ** attempt));
    return callTelegram(token, method, payload, attempt + 1);
  }
  return data;
}

/**
 * Telegram xatosini odam tushunadigan tilga o'giradi.
 *
 * "Bad Request: chat not found" degan matn kassaga hech narsa
 * tushuntirmaydi — nima qilish kerakligini aytadigan jumla kerak.
 */
export function telegramErrorMessage(desc: string, chatId = "", threadId = ""): string {
  if (/chat not found/i.test(desc)) {
    return `Telegram guruh topilmadi (${chatId}) — bot guruhga qo'shilganini tekshiring`;
  }
  if (/not enough rights|CHAT_WRITE_FORBIDDEN|bot is not a member/i.test(desc)) {
    return "Telegram: botga guruhda yozish huquqi berilmagan — uni admin qiling";
  }
  if (/unauthorized/i.test(desc)) {
    return "Telegram: bot tokeni noto'g'ri";
  }
  // Topic bilan bog'liq xatolar — "message thread not found" ko'pincha
  // topic id noto'g'ri yoki guruh umuman forum emasligini bildiradi.
  if (/message thread not found|TOPIC_DELETED/i.test(desc)) {
    return `Telegram: ${threadId} raqamli topic topilmadi — id noto'g'ri, topic o'chirilgan yoki guruhda "Topics" yoqilmagan`;
  }
  if (/TOPIC_CLOSED/i.test(desc)) {
    return "Telegram: topic yopilgan — uni oching yoki boshqa topic tanlang";
  }
  return `Telegram xatosi: ${desc}`;
}

export interface SendOptions {
  /** Guruh ichidagi TOPIC raqami (`message_thread_id`). Shaxsiy yozishmada kerak emas. */
  threadId?: string;
  replyMarkup?: ReplyMarkup;
}

/** HTML xabar yuboradi. Xato bo'lsa OTADI — chaqiruvchi hal qiladi. */
export async function sendHtml(
  token: string,
  chatId: string,
  html: string,
  opts: SendOptions = {},
): Promise<{ messageId: number }> {
  const data = await callTelegram(token, "sendMessage", {
    chat_id: chatId,
    text: html,
    parse_mode: "HTML",
    disable_web_page_preview: true,
    // Maydon faqat KERAK bo'lgandagina qo'shiladi: forum bo'lmagan
    // guruhga `message_thread_id` yuborilsa Telegram xato qaytaradi.
    ...(opts.threadId ? { message_thread_id: Number(opts.threadId) } : {}),
    ...(opts.replyMarkup ? { reply_markup: opts.replyMarkup } : {}),
  });

  if (!data.ok || !data.result) {
    throw new Error(telegramErrorMessage(data.description || "noma'lum xato", chatId, opts.threadId));
  }
  return { messageId: data.result.message_id };
}

/**
 * Yuborilgan xabarni tahrirlash — menyu navigatsiyasining asosi.
 *
 * O'quvchilar botida har bosishda YANGI xabar yubormaymiz: bitta xabar
 * qayta chiziladi, shunda yozishma o'nlab eski menyular bilan to'lib
 * ketmaydi.
 */
export async function editHtml(
  token: string,
  chatId: string,
  messageId: number,
  html: string,
  replyMarkup?: InlineKeyboard,
): Promise<void> {
  const data = await callTelegram(token, "editMessageText", {
    chat_id: chatId,
    message_id: messageId,
    text: html,
    parse_mode: "HTML",
    disable_web_page_preview: true,
    // Berilmasa Telegram tugmalarni OLIB TASHLAYDI.
    ...(replyMarkup ? { reply_markup: replyMarkup } : {}),
  });
  // "message is not modified" — xato emas, matn allaqachon o'sha.
  if (!data.ok && !/message is not modified/i.test(data.description || "")) {
    throw new Error(`Telegram tahrirlanmadi: ${data.description || "noma'lum xato"}`);
  }
}

/**
 * Tugma bosilishiga JAVOB — Telegram buni kutadi.
 *
 * Chaqirilmasa bosgan odamning tugmasida aylanuvchi belgi ~30 soniya
 * turib qoladi va u tugma "ishlamadi" deb o'ylaydi. Shu bois xato
 * bo'lganda ham chaqiriladi va o'zi HECH QACHON otmaydi: javob
 * berolmaganimiz asosiy ishni bekor qilmasligi kerak.
 */
export async function answerCallbackQuery(
  token: string,
  callbackId: string,
  text: string,
): Promise<void> {
  try {
    await callTelegram(token, "answerCallbackQuery", {
      callback_query_id: callbackId,
      // 200 belgigacha; uzunroq matnni Telegram rad etadi.
      text: text.slice(0, 200),
    });
  } catch (e) {
    console.error("[telegram] answerCallbackQuery:", e instanceof Error ? e.message : e);
  }
}

/** Bot tirikmi va nomi nima — sozlamalarni tekshirish uchun. */
export async function getMe(token: string): Promise<{ ok: boolean; username?: string; error?: string }> {
  if (!token) return { ok: false, error: "bot tokeni sozlanmagan" };
  try {
    const res = await fetch(`${API}/bot${token}/getMe`);
    const data = (await res.json()) as { ok: boolean; result?: { username: string }; description?: string };
    if (!data.ok) return { ok: false, error: data.description || "bot javob bermadi" };
    return { ok: true, username: data.result?.username };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "ulanib bo'lmadi" };
  }
}
