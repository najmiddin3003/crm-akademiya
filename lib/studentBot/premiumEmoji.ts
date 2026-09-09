// PREMIUM (maxsus) EMOJI — Telegramning animatsion ikonkalari.
//
// Telegram HTML rejimida ular shunday yoziladi:
//
//   <tg-emoji emoji-id="5472055112702629499">👋</tg-emoji>
//
// Ichidagi oddiy emoji — ZAXIRA: uni ko'ra olmaydigan odam aynan
// o'shani ko'radi. Shu bois har bir ID ga ma'no jihatdan MOS oddiy
// emoji qo'yiladi, tasodifiy belgi emas.
//
// KIM YUBORA OLADI (Bot API hujjatidagi aniq shart):
//
//   "Custom emoji entities can only be used by bots that purchased
//    additional usernames on Fragment or in the messages directly sent
//    by the bot to private, group and supergroup chats if the owner of
//    the bot has a Telegram Premium subscription."
//
// Ya'ni IKKI yo'l bor va bizga IKKINCHISI to'g'ri keladi: o'quvchilar
// boti xabarni to'g'ridan-to'g'ri SHAXSIY chatga yuboradi, demak bot
// egasida Telegram Premium bo'lsa yetadi — Fragment'dan username sotib
// olish shart emas.
//
// Obuna tugab qolsa yoki ID eskirsa Telegram BUTUN xabarni rad etadi.
// Shuning uchun lib/studentBot/api.ts xabarni maxsus emojisiz QAYTA
// yuboradi (`stripCustomEmoji`) — o'quvchi hech qachon bo'sh ekran
// ko'rmaydi.
//
// SOZLASH (TELEGRAM_STUDENT_PREMIUM_EMOJI):
//
//   bo'sh          — oddiy emoji (sukut bo'yicha)
//   on             — quyidagi tayyor ID'lar
//   wave=123,...   — tayyor ID'lar ustidan o'z ID'ilaringiz
//
// O'z ID'ingizni olish: premium emojini @RawDataBot ga yuboring —
// javobdagi `entities[].custom_emoji_id` aynan shu raqam.

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

/**
 * Maxsus emoji ko'rinmaganda ishlatiladigan oddiy emoji.
 *
 * `calendar` uchun 📅 EMAS 📆, `card` uchun 💳 EMAS 💰 — chunki 📅 va
 * 💳 ning animatsion varianti Telegramning ommaviy to'plamlarida yo'q.
 * Ikkalasi bir xil bo'lishi SHART: aks holda premiumli odam bir
 * ikonkani, premiumsizi butunlay boshqasini ko'rardi.
 */
const FALLBACK: Record<EmojiSlot, string> = {
  wave: "👋",
  calendar: "📆",
  card: "💰",
  chart: "📊",
  memo: "📝",
  point: "👇",
  lock: "🔐",
  phone: "📱",
};

/**
 * Telegramning ommaviy "RestrictedEmoji" to'plamidagi ID'lar.
 *
 * NEGA KODDA: bu to'plam Telegramning o'zi yuritadigan, hammaga ochiq
 * to'plam — uni o'rnatish yoki sotib olish shart emas, ID'lari esa
 * barqaror. Shu bois sozlash bitta so'zga ("on") qisqaradi.
 *
 * Tekshirish (ID hali tirikmi):
 *   getCustomEmojiStickers?custom_emoji_ids=["<id>"]
 * Bo'sh javob — ID o'lgan; o'shanda bot oddiy emojiga qaytadi, ya'ni
 * bu nosozlik o'quvchiga ko'rinmaydi.
 */
const DEFAULT_IDS: Record<EmojiSlot, string> = {
  wave: "5472055112702629499",
  calendar: "5431897022456145283",
  card: "5375296873982604963",
  chart: "5431577498364158238",
  memo: "5334882760735598374",
  point: "5470177992950946662",
  lock: "5472308992514464048",
  phone: "5407025283456835913",
};

type SlotIds = Partial<Record<EmojiSlot, string>>;

// Muhit o'zgaruvchisi har xabarda qayta tahlil qilinmasin. XOM QIYMAT
// bo'yicha solishtiriladi: sinovda `process.env` ni almashtirsa, kesh
// o'zi yangilanadi.
let cache: { raw: string; ids: SlotIds } | null = null;

function parseIds(raw: string): SlotIds {
  const flag = raw.toLowerCase();
  if (flag === "" || flag === "off" || flag === "false" || flag === "0" || flag === "no") return {};
  if (flag === "on" || flag === "true" || flag === "1" || flag === "yes") return { ...DEFAULT_IDS };

  // Aniq ID berilsa ham TAYYORLARIDAN boshlanadi: bitta o'rin
  // yozilgani uchun qolgan yettitasi oddiy emojiga tushib qolmasin —
  // ro'yxatning yarmi jonli, yarmi jonsiz bo'lgani xunuk ko'rinadi.
  const ids: SlotIds = { ...DEFAULT_IDS };
  for (const part of raw.split(/[,;\n]/)) {
    // ID FAQAT RAQAM bo'lishi tekshiriladi. Bu ikki ishni qiladi:
    // xatoni erta tutadi va atributga begona HTML tushishining oldini
    // oladi — qiymat quyida qo'shtirnoq ichiga qo'yiladi.
    const m = part.trim().match(/^([a-z]+)\s*[=:]\s*([0-9]{5,25})$/i);
    if (!m) continue;
    const slot = m[1].toLowerCase() as EmojiSlot;
    if (slot in FALLBACK) ids[slot] = m[2];
  }
  return ids;
}

function slotIds(): SlotIds {
  const raw = (process.env.TELEGRAM_STUDENT_PREMIUM_EMOJI || "").trim();
  if (cache && cache.raw === raw) return cache.ids;
  const ids = parseIds(raw);
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
 * Telegram maxsus emojini rad etganda (Premium tugagan, ID eskirgan)
 * xabar shu ko'rinishda qayta yuboriladi — matn to'liq saqlanadi,
 * faqat ikonkalar oddiy bo'lib qoladi.
 */
export function stripCustomEmoji(html: string): string {
  return html.replace(/<tg-emoji\b[^>]*>([\s\S]*?)<\/tg-emoji>/gi, "$1");
}

/** Sozlangan o'rinlar ro'yxati — diagnostika uchun (ID'lar qaytarilmaydi). */
export function premiumEmojiSlots(): EmojiSlot[] {
  return Object.keys(slotIds()) as EmojiSlot[];
}

/** Diagnostika ID'ni Telegramda tekshirsin uchun. */
export function premiumEmojiIds(): SlotIds {
  return { ...slotIds() };
}
