// PREMIUM (maxsus) EMOJI — Telegramning animatsion ikonkalari.
//
// Telegram HTML rejimida ular shunday yoziladi:
//
//   <tg-emoji emoji-id="5368324170671202286">👋</tg-emoji>
//
// Ichidagi oddiy emoji — ZAXIRA: premium obunasi yo'q odamning
// telefonida aynan o'sha ko'rinadi. Shu bois har bir maxsus emojiga
// ma'no jihatdan MOS oddiy emoji qo'yiladi, tasodifiy belgi emas.
//
// TELEGRAM CHEKLOVI (bu modul mavjudligining sababi): botlar maxsus
// emoji yubora olishi uchun bot egasi Fragment'da qo'shimcha username
// SOTIB OLGAN bo'lishi kerak. Oddiy botga bu huquq berilmagan va
// Telegram butun xabarni rad etadi. Shuning uchun:
//
//   • ID'lar KODGA YOZILMAYDI, muhit o'zgaruvchisidan o'qiladi —
//     sozlanmagan bo'lsa bot oddiy emoji bilan ishlayveradi;
//   • yuborish muvaffaqiyatsiz bo'lsa lib/studentBot/api.ts xabarni
//     maxsus emojisiz QAYTA yuboradi (`stripCustomEmoji`), ya'ni
//     noto'g'ri ID tufayli o'quvchi bo'sh ekran ko'rib qolmaydi.
//
// SOZLASH. TELEGRAM_STUDENT_PREMIUM_EMOJI ga "kalit=id" juftliklari
// vergul bilan yoziladi:
//
//   wave=5368324170671202286, calendar=5411139534557245448, card=...
//
// ID'ni qayerdan olish: kerakli premium emojini o'z botingizga (yoki
// @RawDataBot ga) yuboring — javobdagi `entities[].custom_emoji_id`
// aynan shu raqam.

/** Matnlarda ishlatiladigan ikonka o'rinlari. */
export type EmojiSlot =
  | "wave"
  | "calendar"
  | "card"
  | "chart"
  | "memo"
  | "point"
  | "lock"
  | "phone";

/** Premium ID sozlanmaganda (yoki obunasi yo'q odamda) ko'rinadigan emoji. */
const FALLBACK: Record<EmojiSlot, string> = {
  wave: "👋",
  calendar: "📅",
  card: "💳",
  chart: "📊",
  memo: "📝",
  point: "👇",
  lock: "🔐",
  phone: "📱",
};

type SlotIds = Partial<Record<EmojiSlot, string>>;

// Muhit o'zgaruvchisi har xabarda qayta tahlil qilinmasin. XOM QIYMAT
// bo'yicha solishtiriladi: sinovda `process.env` ni almashtirsa, kesh
// o'zi yangilanadi.
let cache: { raw: string; ids: SlotIds } | null = null;

function slotIds(): SlotIds {
  const raw = (process.env.TELEGRAM_STUDENT_PREMIUM_EMOJI || "").trim();
  if (cache && cache.raw === raw) return cache.ids;

  const ids: SlotIds = {};
  for (const part of raw.split(/[,;\n]/)) {
    // ID FAQAT RAQAM bo'lishi tekshiriladi. Bu ikki ishni qiladi:
    // xatoni erta tutadi va atributga begona HTML tushishining oldini
    // oladi — qiymat quyida qo'shtirnoq ichiga qo'yiladi.
    const m = part.trim().match(/^([a-z]+)\s*[=:]\s*([0-9]{5,25})$/i);
    if (!m) continue;
    const slot = m[1].toLowerCase() as EmojiSlot;
    if (slot in FALLBACK) ids[slot] = m[2];
  }

  cache = { raw, ids };
  return ids;
}

/** Ikonka — sozlangan bo'lsa premium, aks holda oddiy emoji. */
export function pe(slot: EmojiSlot): string {
  const id = slotIds()[slot];
  return id ? `<tg-emoji emoji-id="${id}">${FALLBACK[slot]}</tg-emoji>` : FALLBACK[slot];
}

/** Shu o'rinning oddiy (premium bo'lmagan) emojisi — tugma yozuvlari uchun. */
export function plainEmoji(slot: EmojiSlot): string {
  return FALLBACK[slot];
}

/** Matnda maxsus emoji bormi — qayta yuborishga arziydimi degan savolga javob. */
export function hasCustomEmoji(html: string): boolean {
  return /<tg-emoji\b/i.test(html);
}

/**
 * Maxsus emojini ZAXIRA emojiga almashtiradi.
 *
 * Telegram maxsus emojini rad etganda (huquq yo'q, ID eskirgan) xabar
 * shu ko'rinishda qayta yuboriladi — matn to'liq saqlanadi, faqat
 * ikonkalar oddiy bo'lib qoladi.
 */
export function stripCustomEmoji(html: string): string {
  return html.replace(/<tg-emoji\b[^>]*>([\s\S]*?)<\/tg-emoji>/gi, "$1");
}

/** Sozlangan o'rinlar ro'yxati — diagnostika uchun (ID'lar qaytarilmaydi). */
export function premiumEmojiSlots(): EmojiSlot[] {
  return Object.keys(slotIds()) as EmojiSlot[];
}
