import { randomUUID } from "node:crypto";
import type { Db } from "mongodb";
import { AI } from "./db";
import type { AiChatMessage } from "./protocol";

// SUHBATLAR TARIXI — `ai_conversations`.
//
// Faqat savol va javob MATNI saqlanadi. Vositalar qaytargan xom
// ma'lumot (o'quvchilar ro'yxati, summalar jadvali) saqlanmaydi: u
// baribir javob matnida bor, ortiqcha nusxa esa shaxsiy ma'lumotni
// ikkinchi joyda yig'ib qo'yardi.
//
// SAQLASH MUDDATI — oxirgi xabardan 30 kun (`expiresAt` TTL indeksi,
// lib/ai/db.ts). Suhbat faqat egasiga ko'rinadi: har so'rovda `userId`
// filtrda turadi, ya'ni boshqa odamning id'sini yozib ochib bo'lmaydi.
//
// TARIX MIJOZDAN OLINMAYDI — har safar shu yerdan o'qiladi. Mijoz
// yuborgan "oldingi xabarlar"ga ishonilsa, u modelga soxta "assistant"
// javoblarini (masalan, "sizga hamma ruxsat berilgan") qo'shib yubora
// olardi.

const RETENTION_MS = 30 * 86_400_000;
/** Bitta suhbatda saqlanadigan oxirgi xabarlar soni. */
const MAX_STORED = 60;

interface ConversationDoc {
  id: string;
  userId: string;
  title: string;
  messages: AiChatMessage[];
  createdAt: Date;
  updatedAt: Date;
  expiresAt: Date;
}

export interface AiConversationView {
  id: string;
  title: string;
  messages: AiChatMessage[];
  updatedAt: string;
}

function view(d: ConversationDoc): AiConversationView {
  return { id: d.id, title: d.title, messages: d.messages ?? [], updatedAt: new Date(d.updatedAt).toISOString() };
}

const col = (db: Db) => db.collection<ConversationDoc>(AI.conversations);

export async function findConversation(db: Db, userId: string, id: string): Promise<AiConversationView | null> {
  const d = await col(db).findOne({ id, userId }, { projection: { _id: 0 } });
  return d ? view(d) : null;
}

/** Panel ochilganda — oxirgi suhbat davom ettiriladi. */
export async function latestConversation(db: Db, userId: string): Promise<AiConversationView | null> {
  const [d] = await col(db).find({ userId }, { projection: { _id: 0 } }).sort({ updatedAt: -1 }).limit(1).toArray();
  return d ? view(d) : null;
}

/**
 * Savol va javobni yozadi. `id` berilmasa (yoki boshqa odamniki bo'lsa)
 * yangi suhbat ochiladi. Qaytaradi — suhbat id'si.
 */
export async function saveTurn(
  db: Db,
  userId: string,
  id: string | null,
  turn: [AiChatMessage, AiChatMessage],
): Promise<string> {
  const now = new Date();
  const expiresAt = new Date(now.getTime() + RETENTION_MS);
  if (id) {
    const res = await col(db).updateOne(
      { id, userId },
      {
        $push: { messages: { $each: turn, $slice: -MAX_STORED } },
        $set: { updatedAt: now, expiresAt },
      },
    );
    if (res.matchedCount > 0) return id;
  }
  const newId = randomUUID();
  await col(db).insertOne({
    id: newId,
    userId,
    title: turn[0].content.replace(/\s+/g, " ").trim().slice(0, 80),
    messages: turn,
    createdAt: now,
    updatedAt: now,
    expiresAt,
  });
  return newId;
}

export async function deleteConversation(db: Db, userId: string, id: string): Promise<boolean> {
  const res = await col(db).deleteOne({ id, userId });
  return res.deletedCount > 0;
}
