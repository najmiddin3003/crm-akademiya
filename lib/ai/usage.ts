import type { Db } from "mongodb";
import { uzDateIso } from "@/lib/uzTime";
import { AI, isDupKey } from "./db";

// KUNLIK LIMIT — xodimga kuniga nechta savol (lib/ai/settings.ts).
//
// Hisoblagich `{ userId, day }` bo'yicha, kun — TOSHKENT kuni (server
// UTC'da: 19:00 dan keyin `new Date()` hali kechagi kunni beradi).
//
// OSHIB KETMASLIGI KAFOLATI — bitta atomik so'rov: filtrda `count < limit`
// sharti bor. Limit to'lgan bo'lsa filtr hech narsani topmaydi, upsert
// esa YANGI hujjat ochishga urinadi va `{userId, day}` unique indeksiga
// uriladi (E11000) — bu "limit tugadi" degani. Avval o'qib, keyin yozish
// ikkita parallel so'rovda ikkalasini ham o'tkazib yuborardi.

export interface QuotaState {
  used: number;
  limit: number;
  remaining: number;
}

/** Hisoblagich bir necha kun turadi, keyin TTL indeksi uni o'zi o'chiradi. */
const KEEP_MS = 3 * 86_400_000;

function state(used: number, limit: number): QuotaState {
  return { used, limit, remaining: Math.max(limit - used, 0) };
}

export async function readQuota(db: Db, userId: string, limit: number): Promise<QuotaState> {
  const doc = await db.collection(AI.usage).findOne({ userId, day: uzDateIso() }, { projection: { _id: 0, count: 1 } });
  return state(Number(doc?.count) || 0, limit);
}

/** Bitta savolni hisobga oladi. `ok: false` — bugungi limit tugagan. */
export async function takeQuota(db: Db, userId: string, limit: number): Promise<QuotaState & { ok: boolean }> {
  try {
    const doc = await db.collection(AI.usage).findOneAndUpdate(
      { userId, day: uzDateIso(), count: { $lt: limit } },
      { $inc: { count: 1 }, $setOnInsert: { expiresAt: new Date(Date.now() + KEEP_MS) } },
      { upsert: true, returnDocument: "after" },
    );
    return { ok: true, ...state(Number(doc?.count) || 1, limit) };
  } catch (e) {
    if (isDupKey(e)) return { ok: false, ...state(limit, limit) };
    throw e;
  }
}

/**
 * Savol XIZMAT aybi bilan javobsiz qolsa (kalit noto'g'ri, OpenAI ishlamay
 * qoldi) — hisob qaytariladi: xodim bizning nosozligimiz uchun limitini
 * yo'qotmasin. Noldan pastga tushmaydi.
 */
export async function refundQuota(db: Db, userId: string): Promise<void> {
  await db
    .collection(AI.usage)
    .updateOne({ userId, day: uzDateIso(), count: { $gt: 0 } }, { $inc: { count: -1 } })
    .catch(() => {});
}
