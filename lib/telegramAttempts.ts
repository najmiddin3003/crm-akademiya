import type { Db } from "mongodb";

// TELEGRAM BOTLARI UCHUN URINISHLAR QOROVULI — umumiy zavod.
//
// Ikki botda bir xil ehtiyoj bor:
//   • o'quvchilar boti — qo'lda yozilgan telefon raqami (skript raqamlarni
//     ketma-ket terib bazani so'rab olmasin, lib/studentBot/attempts.ts);
//   • xodimlar boti — parol (parolni terib chiqishga qarshi,
//     lib/staffBot/attempts.ts).
// Qoida bitta: oynada N ta MUVAFFAQIYATSIZ urinish, muvaffaqiyatda
// hisoblagich tozalanadi. Kolleksiya har botda O'ZINIKI — bitta odam
// o'quvchi botida raqam terib xodimlar botida qulflanib qolmasin.
//
// TIRIK ODAMGA SEZILMAYDI: o'z raqamini yoki parolini yozayotgan kishi
// 1-2 marta urinadi, chegara esa 10 daqiqada 5 ta.

export interface AttemptGate {
  allowed: boolean;
  /** Chegaraga urilganda — necha daqiqa kutish kerakligi. */
  waitMinutes: number;
}

interface AttemptDoc {
  chatId: number;
  count: number;
  windowStart: number;
}

export interface AttemptGateOptions {
  /** MongoDB kolleksiyasi — har botda alohida. */
  collection: string;
  /** Oyna uzunligi (ms) — shu vaqt o'tgach hisoblagich noldan boshlanadi. */
  windowMs?: number;
  /** Bitta oynada ruxsat etilgan muvaffaqiyatsiz urinishlar. */
  maxTries?: number;
}

export function createAttemptGate(opts: AttemptGateOptions) {
  const windowMs = opts.windowMs ?? 10 * 60 * 1000;
  const maxTries = opts.maxTries ?? 5;

  return {
    /**
     * Urinishni hisobga oladi va ruxsat berilganini aytadi.
     *
     * Chaqiruv TEKSHIRUVDAN OLDIN: aks holda terib chiqayotgan skript
     * baribir har urinishda bazani qidirtirib o'tirardi.
     */
    async take(db: Db, chatId: number, now = Date.now()): Promise<AttemptGate> {
      const col = db.collection<AttemptDoc>(opts.collection);
      const doc = await col.findOne({ chatId });

      // Yozuv yo'q yoki oyna eskirgan — yangisini boshlaymiz.
      if (!doc || now - doc.windowStart > windowMs) {
        await col.updateOne({ chatId }, { $set: { chatId, windowStart: now, count: 1 } }, { upsert: true });
        return { allowed: true, waitMinutes: 0 };
      }

      if (doc.count >= maxTries) {
        const left = windowMs - (now - doc.windowStart);
        return { allowed: false, waitMinutes: Math.max(1, Math.ceil(left / 60_000)) };
      }

      await col.updateOne({ chatId }, { $inc: { count: 1 } });
      return { allowed: true, waitMinutes: 0 };
    },

    /** Hisoblagichni tozalaydi — urinish muvaffaqiyatli bo'lganda chaqiriladi. */
    async clear(db: Db, chatId: number): Promise<void> {
      await db.collection<AttemptDoc>(opts.collection).deleteOne({ chatId });
    },
  };
}
