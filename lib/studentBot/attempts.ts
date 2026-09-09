import type { Db } from "mongodb";

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

export const BOT_ATTEMPTS = "student_bot_attempts";

/** Oyna uzunligi — shu vaqt o'tgach hisoblagich noldan boshlanadi. */
const WINDOW_MS = 10 * 60 * 1000;
/** Bitta oynada ruxsat etilgan muvaffaqiyatsiz urinishlar. */
const MAX_TRIES = 5;

interface AttemptDoc {
  chatId: number;
  count: number;
  windowStart: number;
}

export interface AttemptGate {
  allowed: boolean;
  /** Chegaraga urilganda — necha daqiqa kutish kerakligi. */
  waitMinutes: number;
}

/**
 * Urinishni hisobga oladi va ruxsat berilganini aytadi.
 *
 * Chaqiruv QIDIRUVDAN OLDIN: aks holda mavjud bo'lmagan raqamlarni
 * terib chiqayotgan skript baribir bazani qidirtirib o'tirardi.
 */
export async function takePhoneAttempt(db: Db, chatId: number, now = Date.now()): Promise<AttemptGate> {
  const col = db.collection<AttemptDoc>(BOT_ATTEMPTS);
  const doc = await col.findOne({ chatId });

  // Yozuv yo'q yoki oyna eskirgan — yangisini boshlaymiz.
  if (!doc || now - doc.windowStart > WINDOW_MS) {
    await col.updateOne({ chatId }, { $set: { chatId, windowStart: now, count: 1 } }, { upsert: true });
    return { allowed: true, waitMinutes: 0 };
  }

  if (doc.count >= MAX_TRIES) {
    const left = WINDOW_MS - (now - doc.windowStart);
    return { allowed: false, waitMinutes: Math.max(1, Math.ceil(left / 60_000)) };
  }

  await col.updateOne({ chatId }, { $inc: { count: 1 } });
  return { allowed: true, waitMinutes: 0 };
}

/**
 * Hisoblagichni tozalaydi — raqam topilganda chaqiriladi.
 *
 * Shu bois "chiqish" qilib qayta kirgan odam ham, farzandi ko'p bo'lgan
 * ota-ona ham chegaraga urilmaydi.
 */
export async function clearPhoneAttempts(db: Db, chatId: number): Promise<void> {
  await db.collection<AttemptDoc>(BOT_ATTEMPTS).deleteOne({ chatId });
}
