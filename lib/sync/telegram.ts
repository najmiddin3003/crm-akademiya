import type { SyncConfig } from "@/lib/sync/config";

// Telegram Bot API — xabar yuborish. Paket kerak emas, oddiy fetch yetadi.
//
// Bot ikkala guruhga ADMIN qilib qo'shilishi kerak: oddiy a'zo sifatida
// bot guruhga yoza olmaydi (Telegram cheklovi).

const API = "https://api.telegram.org";

/**
 * HTML rejimida yuboriladigan matnda foydalanuvchi kiritgan qism
 * (o'quvchi ismi, izoh) ESKAPE QILINISHI shart. Aks holda ismda "<" yoki
 * "&" bo'lsa Telegram butun xabarni rad etadi, ya'ni bitta g'alati ism
 * tufayli to'lov haqidagi xabar umuman ketmay qoladi.
 */
export function esc(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export interface TelegramResult {
  messageId: number;
}

interface TelegramApiResponse {
  ok: boolean;
  result?: { message_id: number };
  description?: string;
  error_code?: number;
  parameters?: { retry_after?: number };
}

async function callTelegram(
  cfg: SyncConfig,
  method: string,
  payload: Record<string, unknown>,
  attempt = 0,
): Promise<TelegramApiResponse> {
  const res = await fetch(`${API}/bot${cfg.telegramToken}/${method}`, {
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
    return callTelegram(cfg, method, payload, attempt + 1);
  }
  if ((data.error_code ?? 0) >= 500 && attempt < 2) {
    await new Promise((r) => setTimeout(r, 800 * 2 ** attempt));
    return callTelegram(cfg, method, payload, attempt + 1);
  }
  return data;
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
): Promise<TelegramResult> {
  if (!cfg.telegramToken) throw new Error("TELEGRAM_BOT_TOKEN sozlanmagan");
  if (!chatId) throw new Error("Telegram guruh id'si sozlanmagan");

  const data = await callTelegram(cfg, "sendMessage", {
    chat_id: chatId,
    text: html,
    parse_mode: "HTML",
    disable_web_page_preview: true,
    // Maydon faqat KERAK bo'lgandagina qo'shiladi: forum bo'lmagan
    // guruhga `message_thread_id` yuborilsa Telegram xato qaytaradi.
    ...(threadId ? { message_thread_id: Number(threadId) } : {}),
  });

  if (!data.ok || !data.result) {
    const desc = data.description || "noma'lum xato";
    // Eng ko'p uchraydigan sabablarni odam tushunadigan tilga o'giramiz —
    // "Bad Request: chat not found" degan matn kassaga hech narsa
    // tushuntirmaydi.
    if (/chat not found/i.test(desc)) {
      throw new Error(`Telegram guruh topilmadi (${chatId}) — bot guruhga qo'shilganini tekshiring`);
    }
    if (/not enough rights|CHAT_WRITE_FORBIDDEN|bot is not a member/i.test(desc)) {
      throw new Error("Telegram: botga guruhda yozish huquqi berilmagan — uni admin qiling");
    }
    if (/unauthorized/i.test(desc)) {
      throw new Error("Telegram: TELEGRAM_BOT_TOKEN noto'g'ri");
    }
    // Topic bilan bog'liq xatolar — "message thread not found" ko'pincha
    // topic id noto'g'ri yoki guruh umuman forum emasligini bildiradi.
    if (/message thread not found|TOPIC_DELETED/i.test(desc)) {
      throw new Error(
        `Telegram: ${threadId} raqamli topic topilmadi — id noto'g'ri, topic o'chirilgan yoki guruhda "Topics" yoqilmagan`,
      );
    }
    if (/TOPIC_CLOSED/i.test(desc)) {
      throw new Error("Telegram: topic yopilgan — uni oching yoki boshqa topic tanlang");
    }
    throw new Error(`Telegram xatosi: ${desc}`);
  }
  return { messageId: data.result.message_id };
}

/**
 * Yuborilgan xabarni tahrirlash. Hozircha bekor qilishda ALOHIDA yangi
 * xabar yuborilyapti (kelishilgan qoida — eski xabarni ko'rmay qolmaslik
 * uchun), lekin bu funksiya kelajakda kerak bo'ladi va API'ni to'liq
 * qoplab turadi.
 */
export async function editMessage(
  cfg: SyncConfig,
  chatId: string,
  messageId: number,
  html: string,
): Promise<void> {
  const data = await callTelegram(cfg, "editMessageText", {
    chat_id: chatId,
    message_id: messageId,
    text: html,
    parse_mode: "HTML",
    disable_web_page_preview: true,
  });
  // "message is not modified" — xato emas, matn allaqachon o'sha.
  if (!data.ok && !/message is not modified/i.test(data.description || "")) {
    throw new Error(`Telegram tahrirlanmadi: ${data.description || "noma'lum xato"}`);
  }
}

/** Bot va guruh ulanishini tekshirish — CRM sahifasidagi "Tekshirish" uchun. */
export async function checkBot(cfg: SyncConfig): Promise<{ ok: boolean; username?: string; error?: string }> {
  if (!cfg.telegramToken) return { ok: false, error: "TELEGRAM_BOT_TOKEN sozlanmagan" };
  try {
    const res = await fetch(`${API}/bot${cfg.telegramToken}/getMe`);
    const data = (await res.json()) as { ok: boolean; result?: { username: string }; description?: string };
    if (!data.ok) return { ok: false, error: data.description || "bot javob bermadi" };
    return { ok: true, username: data.result?.username };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "ulanib bo'lmadi" };
  }
}
