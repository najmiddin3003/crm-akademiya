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
  /** Suhbatlar tarixi (lib/ai/store.ts); 11.10.2026 dan O'CHMAYDI — 30 kundan keyin arxivga o'tadi. */
  conversations: "ai_conversations",
  /**
   * Amal qoralamalari va ularning taqdiri (lib/ai/actions/store.ts) — kim,
   * qachon, nimani tayyorlatdi va tasdiqladi. Audit izi: 180 kundan keyin
   * o'chadi; pul yozuvining o'zi jurnalda abadiy (`origin: "ai"`).
   */
  actions: "ai_actions",
  /** Adminga ogohlantirish HODISALARI (bo'shagan xona) — lib/ai/alerts.ts; 30 kundan keyin o'chadi. */
  alertEvents: "ai_alert_events",
  /** Admin × ogohlantirish kaliti — «ko'rildi» (lib/ai/alerts.ts); 90 kundan keyin o'chadi. */
  alertSeen: "ai_alert_seen",
  /** Ogohlantirish holati (xonalar bandligi surati, `_id: "rooms"`) — lib/ai/alerts.ts. */
  alertState: "ai_alert_state",
} as const;

let ready: Promise<void> | null = null;

async function createAiIndexes(db: Db): Promise<void> {
  await Promise.all([
    db.collection(AI.settings).createIndex({ key: 1 }, { unique: true }),
    db.collection(AI.usage).createIndex({ userId: 1, day: 1 }, { unique: true }),
    db.collection(AI.usage).createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }),
    db.collection(AI.conversations).createIndex({ id: 1 }, { unique: true }),
    db.collection(AI.conversations).createIndex({ userId: 1, updatedAt: -1 }),
    // ESKI TTL indeksi (30 kundan keyin o'chirardi) — olib tashlanadi: suhbat endi
    // bazada qoladi, 30 kun yozilmagani arxivga o'tadi (lib/ai/store.ts → autoArchive).
    // Indeks yo'q bo'lsa (yangi baza yoki allaqachon o'chirilgan) — xato yutiladi.
    db.collection(AI.conversations).dropIndex("expiresAt_1").catch(() => undefined),
    db.collection(AI.actions).createIndex({ id: 1 }, { unique: true }),
    db.collection(AI.actions).createIndex({ userId: 1, createdAt: -1 }),
    db.collection(AI.actions).createIndex({ purgeAt: 1 }, { expireAfterSeconds: 0 }),
    db.collection(AI.alertEvents).createIndex({ key: 1 }, { unique: true }),
    db.collection(AI.alertEvents).createIndex({ at: 1 }, { expireAfterSeconds: 30 * 86_400 }),
    db.collection(AI.alertSeen).createIndex({ userId: 1, key: 1 }, { unique: true }),
    db.collection(AI.alertSeen).createIndex({ at: 1 }, { expireAfterSeconds: 90 * 86_400 }),
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
