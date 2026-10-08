import type { AiEffort, AiModelOption } from "./protocol";

// AI MODELLARI VA «TEZLIK» (fikrlash darajasi) — 08.10.2026.
//
// Fayl hech narsa bajarmaydi va faqat turlarni import qiladi: uni server
// (lib/ai/modelChoice.ts, sozlamalar) ham, panel ham o'qiydi, sinov skripti
// esa bazasiz tekshiradi.
//
// KATALOG — OpenAI'ning 2026-yil oktyabridagi modellari
// (developers.openai.com → "Using GPT-6"):
//   • GPT-6 Astra, GPT-6.1 Sol — vosita bilan FAQAT Responses API'da
//     ishlaydi (Chat Completions vositali so'rovni umuman qabul qilmaydi),
//     `none` darajasi yo'q;
//   • GPT-6 Sol, GPT-6 Luna, GPT-5.6 (Sol / Terra / Luna) — `none` bor; Chat
//     Completions'da vosita faqat `none` bilan.
// Hisobda qaysi biri borligini server o'zi tekshiradi (GET /v1/models) —
// yo'g'i panelda ko'rinmaydi. Katalogda yo'q model ham ishlaydi (admin ID
// sini qo'lda qo'shadi): unga barcha darajalar beriladi, qabul qilmasa
// lib/ai/openai.ts o'zi moslashadi.
//
// `xhigh` / `max` ATAYIN YO'Q: javob bir necha daqiqaga cho'zilishi mumkin,
// bizda esa butun javobga 100 soniya (lib/ai/config.ts → TOTAL_DEADLINE_MS).

/** Tezdan chuqurga — paneldagi surgich shu tartibda. */
export const AI_EFFORTS: readonly AiEffort[] = ["none", "low", "medium", "high"];

/** Xodim ham, admin ham tanlamagan bo'lsa. */
export const DEFAULT_EFFORT: AiEffort = "low";

/** Panel yorliqlari — label va hint maydonlari (i18n skaneri shundan taniydi). */
export const EFFORT_LABELS: readonly { effort: AiEffort; label: string; hint: string }[] = [
  { effort: "none", label: "Tezkor", hint: "O'ylab o'tirmasdan darhol javob beradi" },
  { effort: "low", label: "Tez", hint: "Qisqa o'ylab, tez javob beradi" },
  { effort: "medium", label: "O'rtacha", hint: "Tezlik va puxtalik o'rtasida" },
  { effort: "high", label: "Chuqur", hint: "Uzoqroq o'ylaydi — murakkab savollar uchun" },
];

export interface AiModelInfo {
  id: string;
  /** Ko'rinadigan nom — tarjima qilinmaydi. */
  name: string;
  /** Qisqa tavsif — o'zbekcha, panel tarjima qiladi. */
  hint: string;
  efforts: readonly AiEffort[];
  /** Vosita bilan faqat Responses API'da ishlaydi — Chat Completions rejimida ro'yxatga chiqmaydi. */
  responsesOnly?: boolean;
  /** Boshqa modelning taxallusi — admin tanlamaguncha ro'yxatga kirmaydi. */
  alias?: boolean;
}

const WITH_NONE: readonly AiEffort[] = ["none", "low", "medium", "high"];
const NO_NONE: readonly AiEffort[] = ["low", "medium", "high"];

export const AI_MODEL_CATALOG: readonly AiModelInfo[] = [
  {
    id: "gpt-6-astra",
    name: "GPT-6 Astra",
    hint: "Eng kuchli model — murakkab tahlil uchun. Sekinroq va qimmatroq",
    efforts: NO_NONE,
    responsesOnly: true,
  },
  { id: "gpt-6.1-sol", name: "GPT-6.1 Sol", hint: "Kuchli va puxta — ko'p bosqichli savollar uchun", efforts: NO_NONE, responsesOnly: true },
  { id: "gpt-6-sol", name: "GPT-6 Sol", hint: "Kuchli va tez — kundalik ish uchun", efforts: WITH_NONE },
  { id: "gpt-6-luna", name: "GPT-6 Luna", hint: "Eng tez va arzon — oddiy savollar uchun", efforts: WITH_NONE },
  { id: "gpt-5.6-sol", name: "GPT-5.6 Sol", hint: "Oldingi avlodning kuchli modeli", efforts: WITH_NONE },
  { id: "gpt-5.6-terra", name: "GPT-5.6 Terra", hint: "Oldingi avlod — narx va sifat muvozanati", efforts: WITH_NONE },
  { id: "gpt-5.6-luna", name: "GPT-5.6 Luna", hint: "Oldingi avlod — tez va arzon", efforts: WITH_NONE },
  { id: "gpt-5.6", name: "GPT-5.6", hint: "GPT-5.6 Sol bilan bir xil", efforts: WITH_NONE, alias: true },
];

const BY_ID = new Map(AI_MODEL_CATALOG.map((m) => [m.id, m]));

/** Katalogda bo'lmasa — nomi ID'ning o'zi, tavsifi bo'sh, barcha darajalar. */
export function modelInfo(id: string): AiModelInfo {
  return BY_ID.get(id) ?? { id, name: id, hint: "", efforts: AI_EFFORTS };
}

/** Panelga ketadigan shakl. `withEfforts: false` — tezlik tanlanmaydi (Chat Completions rejimi). */
export function modelOption(id: string, withEfforts: boolean): AiModelOption {
  const m = modelInfo(id);
  return { id: m.id, name: m.name, hint: m.hint, efforts: withEfforts ? [...m.efforts] : [] };
}

/** Admin qo'lda yozadigan model ID'si: harf yoki raqam bilan boshlanadi, keyin `. _ : -` ham mumkin. */
export function isModelId(v: unknown): v is string {
  return typeof v === "string" && /^[A-Za-z0-9][A-Za-z0-9._:-]{0,63}$/.test(v);
}

export function isEffort(v: unknown): v is AiEffort {
  return typeof v === "string" && (AI_EFFORTS as readonly string[]).includes(v);
}

/**
 * `want` ga eng yaqin daraja `allowed` ichidan (teng masofada — chuqurrog'i:
 * "Tezkor" yo'q modelda "Tez"). Ro'yxat bo'sh bo'lsa — `null` (daraja
 * yuborilmaydi).
 */
export function nearestEffort(want: AiEffort, allowed: readonly AiEffort[]): AiEffort | null {
  if (allowed.includes(want)) return want;
  const at = AI_EFFORTS.indexOf(want);
  let best: AiEffort | null = null;
  let bestGap = Infinity;
  for (const e of allowed) {
    const gap = Math.abs(AI_EFFORTS.indexOf(e) - at);
    if (gap < bestGap || (gap === bestGap && best !== null && AI_EFFORTS.indexOf(e) > AI_EFFORTS.indexOf(best))) {
      best = e;
      bestGap = gap;
    }
  }
  return best;
}

export function effortLabel(e: AiEffort): string {
  return EFFORT_LABELS.find((x) => x.effort === e)?.label ?? e;
}
