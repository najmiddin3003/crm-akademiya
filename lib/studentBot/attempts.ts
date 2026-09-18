import type { Db } from "mongodb";
import { createAttemptGate, type AttemptGate } from "@/lib/telegramAttempts";

// QO'LDA KIRITILGAN RAQAM uchun urinishlar qorovuli. MongoDB
// `student_bot_attempts`.
//
// NEGA KERAK. Raqamni qo'lda yozib kirish tugmadan farqli o'laroq
// HECH NARSANI ISBOTLAMAYDI: yozgan odam o'sha raqam egasi ekani
// tekshirilmaydi. Bu ongli qaror (markaz shunday xohladi) va oddiy
// odamga qulay. Lekin bittasi qoldi: O'zbekiston raqami 9 xonali va
// prefikslari sanoqli, ya'ni skript ularni ketma-ket yozib butun
// bazani botdan so'rab olishi mumkin edi.
//
// Bu modul buni to'xtatadi va TIRIK ODAMGA UMUMAN SEZILMAYDI: o'z
// raqamini yozayotgan kishi 1-2 marta urinadi, chegara esa 10
// daqiqada 5 ta. Ya'ni bu "xavfsizlik uchun qulaylikni qurbon qilish"
// emas — faqat mashina bilan terib chiqishni foydasiz qiladi.
//
// FAQAT MUVAFFAQIYATSIZ urinish sanaladi: raqami topilgan odam
// hisoblagichi tozalanadi va u hech qachon chegaraga urilmaydi.
//
// Mexanizmning o'zi umumiy — lib/telegramAttempts.ts (xodimlar boti
// parol uchun xuddi shu qorovuldan foydalanadi, o'z kolleksiyasi bilan).

export const BOT_ATTEMPTS = "student_bot_attempts";
export type { AttemptGate };

const gate = createAttemptGate({ collection: BOT_ATTEMPTS });

/**
 * Urinishni hisobga oladi va ruxsat berilganini aytadi.
 *
 * Chaqiruv QIDIRUVDAN OLDIN: aks holda mavjud bo'lmagan raqamlarni
 * terib chiqayotgan skript baribir bazani qidirtirib o'tirardi.
 */
export function takePhoneAttempt(db: Db, chatId: number, now = Date.now()): Promise<AttemptGate> {
  return gate.take(db, chatId, now);
}

/**
 * Hisoblagichni tozalaydi — raqam topilganda chaqiriladi.
 *
 * Shu bois "chiqish" qilib qayta kirgan odam ham, farzandi ko'p bo'lgan
 * ota-ona ham chegaraga urilmaydi.
 */
export function clearPhoneAttempts(db: Db, chatId: number): Promise<void> {
  return gate.clear(db, chatId);
}
