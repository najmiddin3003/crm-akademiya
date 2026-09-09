// Jinsni ISM-FAMILIYAdan taxmin qilish — modeldan mustaqil qism.
//
// Route (app/api/gender-guess) faqat sessiyani tekshiradi va HTTP so'rov
// yuboradi; so'rovning shakli, ko'rsatma matni va javobni o'qish SHU
// YERDA. Sabab: aynan shu qismda tuzoq bor (pastdagi `readGender` izohi)
// va uni tarmoqqa chiqmasdan sinab ko'rish kerak
// (scripts/_test-gender-parse.mjs). Route faylini import qilish esa
// `next/server` ni ham tortib keladi.

/** Hisobda boshqa nom bo'lsa `OPENAI_MODEL` bilan almashtiriladi. */
export const DEFAULT_MODEL = "gpt-5.6";
export const DEFAULT_BASE_URL = "https://api.openai.com/v1";

/**
 * Modelga ko'rsatma.
 *
 * Ataylab QAT'IY va bitta so'z so'raydi: erkin matn kelsa `readGender`
 * uni tanimaydi va maydon bo'sh qoladi — noto'g'ri taxmin qilib
 * qo'yishdan ko'ra bo'sh qoldirgan afzal, chunki bu qiymat xodim
 * kartochkasiga yoziladi.
 */
export const SYSTEM_PROMPT = [
  "You classify the likely gender of a person from their Uzbek name.",
  "The name may be written in Latin Uzbek, Russian, or a mix, and the order",
  "of first name and surname is not guaranteed.",
  "Answer with exactly one lowercase word and nothing else:",
  "male, female, or unknown.",
  "Answer unknown when the name is ambiguous, incomplete or not a person's name.",
].join(" ");

/**
 * Model javobidan jinsni o'qiydi. Tanimasa — bo'sh satr.
 *
 * TUZOQ: "female" ichida "male" BOR. `includes("male")` bilan yozilsa har
 * bir ayol erkakka aylanib ketardi. Shuning uchun so'z chegarasi
 * (`\b...\b`) ishlatiladi va "female" BIRINCHI tekshiriladi.
 */
export function readGender(raw: unknown): "male" | "female" | "" {
  const t = String(raw ?? "").toLowerCase();
  if (/\bfemale\b/.test(t)) return "female";
  if (/\bmale\b/.test(t)) return "male";
  return "";
}

/** OpenAI Chat Completions tanasi. */
export function chatBody(model: string, name: string) {
  // ATAYLAB eng oddiy shaklda: `temperature`, `max_tokens` va
  // `response_format` YUBORILMAYDI. Yangi modellar ularning bir qismini
  // rad etadi (masalan `max_tokens` o'rniga `max_completion_tokens`
  // talab qiladi) va model almashtirilganda so'rov jimgina buzilardi.
  return {
    model,
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: name },
    ],
  };
}
