import type { Db } from "mongodb";
import { ensureIndexes } from "@/lib/mongodb";

// AI YORDAMCHI — baza qatlami: kolleksiyalar va ularning indekslari.
//
// Indekslar umumiy `ensureIndexes()` da EMAS, shu yerda va KUTIB
// yaratiladi (lib/gamification/db.ts dagi naqsh): limit hisoblagichining
// unique indeksi birinchi so'rovdan OLDIN turishi shart, aks holda
// deploydan keyingi daqiqalarda bitta kun uchun ikkita hisoblagich ochilib,
// limit ikki barobar o'tib ketishi mumkin edi.

export const AI = {
  /** Bitta hujjat `{ key: "main" }` — yoqilganmi, kunlik limit (lib/ai/settings.ts). */
  settings: "ai_settings",
  /** Xodim × kun hisoblagichi (lib/ai/usage.ts); bir necha kundan keyin o'zi o'chadi. */
  usage: "ai_usage",
  /** Suhbatlar tarixi (lib/ai/store.ts); 30 kun ishlatilmasa o'zi o'chadi. */
  conversations: "ai_conversations",
} as const;

let ready: Promise<void> | null = null;

async function createAiIndexes(db: Db): Promise<void> {
  await Promise.all([
    db.collection(AI.settings).createIndex({ key: 1 }, { unique: true }),
    db.collection(AI.usage).createIndex({ userId: 1, day: 1 }, { unique: true }),
    db.collection(AI.usage).createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }),
    db.collection(AI.conversations).createIndex({ id: 1 }, { unique: true }),
    db.collection(AI.conversations).createIndex({ userId: 1, updatedAt: -1 }),
    db.collection(AI.conversations).createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }),
  ]);
}

/** Baza + AI indekslari (jarayon bo'yicha bir marta kutiladi). */
export async function aiDb(): Promise<Db> {
  const db = await ensureIndexes();
  ready ??= createAiIndexes(db).catch((e) => {
    // Xato keshda qolmasin — keyingi so'rov qaytadan urinadi.
    ready = null;
    throw e;
  });
  await ready;
  return db;
}

export function isDupKey(e: unknown): boolean {
  return (e as { code?: number } | null)?.code === 11000;
}
