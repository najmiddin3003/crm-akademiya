import { DEFAULT_BASE_URL, DEFAULT_MODEL } from "@/lib/genderGuess";

// AI YORDAMCHI — .env dan o'qiladigan qism va qat'iy chegaralar.
//
// KALIT VA MANZIL `/api/gender-guess` BILAN UMUMIY: serverda bitta OpenAI
// hisobi bor (OPENAI_URL_API, OPENAI_BASE_URL — README, "Jinsi
// ism-familiyadan" bo'limi). Model esa alohida tanlanishi mumkin: jinsni
// aniqlashga eng arzon model yetadi, suhbat va vositalar bilan ishlashga
// kuchliroq kerak bo'lishi mumkin. Tartib:
//   AI_ASSISTANT_MODEL → OPENAI_MODEL → lib/genderGuess.ts dagi sukut.
//
// YOQISH/O'CHIRISH VA KUNLIK LIMIT .env DA EMAS — bazada (lib/ai/settings.ts):
// admin Sozlamalardan o'zgartiradi, serverga kirib qayta ishga tushirish
// shart emas (filial topiklari bilan bir xil qaror). Xodimlar tanlaydigan
// modellar ro'yxati ham o'sha yerda; .env dagi model — sukut.
//
// QAYSI API (08.10.2026). OpenAI'ning o'zi bilan — Responses API
// (`/v1/responses`): yangi modellar vosita bilan fikrlashni (panelda
// «Tezlik») faqat shu yerda qo'llaydi, GPT-6 Astra va GPT-6.1 Sol esa
// vositani Chat Completions'da umuman qabul qilmaydi. OPENAI_BASE_URL
// boshqa manzilga (proksi) qaratilgan bo'lsa — eski Chat Completions,
// chunki proksilar odatda faqat shuni biladi. Majburlash:
// AI_ASSISTANT_API=responses | chat.

export type AiApi = "responses" | "chat";

export interface AiProviderConfig {
  apiKey: string;
  baseUrl: string;
  /** Sukut model (.env); xodim tanlovi so'rovda shu maydonni almashtiradi (app/api/ai/chat). */
  model: string;
  /** Berilmasa — Chat Completions (sinov skriptidagi soxta server shunday). */
  api?: AiApi;
}

/** `null` — kalit sozlanmagan: yordamchi ishlamaydi, robot faqat tezlik sinovini ochadi. */
export function aiProviderConfig(): AiProviderConfig | null {
  const apiKey = (process.env.OPENAI_URL_API || "").trim();
  if (!apiKey) return null;
  const model =
    (process.env.AI_ASSISTANT_MODEL || "").trim() || (process.env.OPENAI_MODEL || "").trim() || DEFAULT_MODEL;
  const baseUrl = ((process.env.OPENAI_BASE_URL || "").trim() || DEFAULT_BASE_URL).replace(/\/+$/, "");
  const forced = (process.env.AI_ASSISTANT_API || "").trim().toLowerCase();
  const api: AiApi =
    forced === "responses" || forced === "chat" ? forced : baseUrl === DEFAULT_BASE_URL ? "responses" : "chat";
  return { apiKey, baseUrl, model, api };
}

/**
 * Bitta savolda modelga ko'pi bilan necha marta murojaat qilinadi (har
 * vosita chaqiruvi — yana bitta murojaat). Model aylanib qolsa javob shu
 * yerda to'xtaydi va hisob (pul) cheksiz o'smaydi. 5-bosqichdan (Cowork
 * kabi ko'p qadamli vazifalar: reja → bir necha vosita → qoralamalar) 6
 * dan 10 ga oshirildi.
 */
export const MAX_ROUNDS = 10;

/** Bitta OpenAI so'rovining vaqt chegarasi («Chuqur» darajada fikrlash uzoqroq). */
export const ROUND_TIMEOUT_MS = 90_000;

/**
 * Butun javobning chegarasi. Nginx'dagi `proxy_read_timeout 120s`
 * (deploy/nginx.conf.template) IKKI O'QISH ORASIDAGI vaqt — oqimda har
 * 15 soniyada "tirikman" belgisi ketadi (KEEPALIVE_MS), shuning uchun u
 * uzmaydi. Vercel funksiyasining chegarasi (Fluid compute, 300 s) dan esa
 * ancha oldin to'xtaymiz va foydalanuvchi uzilgan ulanish emas, tushunarli
 * xabar ko'radi.
 */
export const TOTAL_DEADLINE_MS = 170_000;

/** Javob kutilayotganda shuncha vaqtda bir "tirikman" belgisi yuboriladi. */
export const KEEPALIVE_MS = 15_000;

/** Foydalanuvchi xabarining eng ko'p uzunligi (belgi). */
export const MAX_MESSAGE_CHARS = 2000;

/** Modelga beriladigan oldingi xabarlar (savol va javoblar) soni. */
export const HISTORY_MESSAGES = 16;

/**
 * Bitta vosita natijasining modelga ketadigan eng ko'p hajmi (belgi).
 * Vositalar o'zi qisqa javob qaytaradi; bu — kutilmagan katta natijaga
 * qarshi zaxira chegara (har belgi pul turadi).
 */
export const MAX_TOOL_RESULT_CHARS = 20_000;
