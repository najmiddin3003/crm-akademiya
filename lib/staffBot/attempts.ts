import type { Db } from "mongodb";
import { createAttemptGate, type AttemptGate } from "@/lib/telegramAttempts";

// PAROL urinishlari qorovuli. MongoDB `staff_bot_attempts`.
//
// Web'dagi login route'ida bunday qorovul yo'q (app/api/auth/login) —
// botda esa parol Telegram orqali keladi va uni skript bilan terib
// chiqish osonroq. Shu bois bu yerda to'siq bor: 10 daqiqada 5 ta
// muvaffaqiyatsiz urinish. Tirik kassirga sezilmaydi (lib/telegramAttempts.ts).
//
// Hisoblagich CHAT bo'yicha — telefon bo'yicha emas: bir odam boshqa
// odamning raqamiga uning nomidan urinib, o'sha odamni qulflab qo'ymasin.

export const STAFF_BOT_ATTEMPTS = "staff_bot_attempts";
export type { AttemptGate };

const gate = createAttemptGate({ collection: STAFF_BOT_ATTEMPTS });

/** Chaqiruv PAROL TEKSHIRUVIDAN OLDIN — bcrypt solishtirish qimmat, terib chiqayotganga bekorga sarflanmasin. */
export function takePasswordAttempt(db: Db, chatId: number, now = Date.now()): Promise<AttemptGate> {
  return gate.take(db, chatId, now);
}

/** Parol to'g'ri kelganda — hisoblagich tozalanadi. */
export function clearPasswordAttempts(db: Db, chatId: number): Promise<void> {
  return gate.clear(db, chatId);
}
