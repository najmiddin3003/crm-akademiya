import { randomUUID } from "node:crypto";
import type { Db } from "mongodb";
import { AI } from "./db";
import type { AiChatMessage } from "./protocol";

// SUHBATLAR TARIXI — `ai_conversations`.
//
// Faqat savol va javob MATNI (va intervyu savollari) saqlanadi. Vositalar
// qaytargan xom ma'lumot (o'quvchilar ro'yxati, summalar jadvali)
// saqlanmaydi: u baribir javob matnida bor, ortiqcha nusxa esa shaxsiy
// ma'lumotni ikkinchi joyda yig'ib qo'yardi.
//
// SAQLASH (11.10.2026): suhbat bazadan O'CHMAYDI. Foydalanuvchi: «30 kundan
// oshsa o'chib ketadi, o'chmasin arxivga tushib qolsin, db da saqlansin har
// bir suhbat». Ilgari `expiresAt` TTL indeksi 30 kundan keyin o'chirardi —
// indeks olib tashlandi (lib/ai/db.ts). Endi:
//   • 30 kun yozilmagan suhbat ARXIVGA o'tadi (`archived`, ro'yxat ochilganda
//     — `autoArchive`); xodim o'zi ham arxivlaydi va qaytaradi;
//   • arxivdagi suhbatga yozilsa — yana faol bo'ladi;
//   • savatcha — YUMSHOQ o'chirish (`deletedAt`): xodim endi ko'rmaydi, yozuv
//     bazada qoladi.
// Suhbat faqat egasiga ko'rinadi: har so'rovda `userId` filtrda turadi, ya'ni
// boshqa odamning id'sini yozib ochib bo'lmaydi.
//
// TARIX MIJOZDAN OLINMAYDI — har safar shu yerdan o'qiladi. Mijoz
// yuborgan "oldingi xabarlar"ga ishonilsa, u modelga soxta "assistant"
// javoblarini (masalan, "sizga hamma ruxsat berilgan") qo'shib yubora
// olardi.

/** Shuncha vaqt yozilmagan suhbat arxivga o'tadi. */
export const AUTO_ARCHIVE_MS = 30 * 86_400_000;
/**
 * Bitta suhbatda saqlanadigan oxirgi xabarlar soni. Modelga baribir oxirgi
 * bir nechtasi boradi (lib/ai/config.ts → HISTORY_MESSAGES); bu — hujjat
 * cheksiz o'smasligi uchun (Mongo hujjati 16 MB).
 */
const MAX_STORED = 500;

interface ConversationDoc {
  id: string;
  userId: string;
  title: string;
  messages: AiChatMessage[];
  createdAt: Date;
  updatedAt: Date;
  /** Arxivda — ro'yxatning «Arxiv» bo'limida. */
  archived?: boolean;
  archivedAt?: Date;
  /** "user" — xodim o'zi, "auto" — 30 kun yozilmagani uchun. */
  archivedBy?: "user" | "auto";
  /** Savatcha bosilgan (yumshoq o'chirish) — xodimga ko'rinmaydi. */
  deletedAt?: Date;
  /** ESKI (11.10.2026 gacha) — TTL muddati; endi yozilmaydi va o'qilmaydi. */
  expiresAt?: Date;
}

export interface AiConversationView {
  id: string;
  title: string;
  messages: AiChatMessage[];
  updatedAt: string;
  archived: boolean;
}

/** O'chirilmagan suhbat. */
const ALIVE = { deletedAt: { $exists: false } } as const;

function view(d: ConversationDoc): AiConversationView {
  return {
    id: d.id,
    title: d.title,
    messages: d.messages ?? [],
    updatedAt: new Date(d.updatedAt).toISOString(),
    archived: d.archived === true,
  };
}

const col = (db: Db) => db.collection<ConversationDoc>(AI.conversations);

export async function findConversation(db: Db, userId: string, id: string): Promise<AiConversationView | null> {
  const d = await col(db).findOne({ id, userId, ...ALIVE }, { projection: { _id: 0 } });
  return d ? view(d) : null;
}

export interface AiConversationSummary {
  id: string;
  title: string;
  updatedAt: string;
  archived: boolean;
}

/** To'liq ekranning chap ro'yxati uchun ko'rsatiladigan suhbatlar soni. */
const LIST_LIMIT = 200;

/**
 * 30 kun yozilmagan faol suhbatlar — arxivga (`archivedBy: "auto"`). Ro'yxat
 * ochilganda shu xodimniki uchun; indeks `{ userId: 1, updatedAt: -1 }`.
 */
export async function autoArchive(db: Db, userId: string, now = new Date()): Promise<number> {
  const res = await col(db).updateMany(
    { userId, ...ALIVE, archived: { $ne: true }, updatedAt: { $lt: new Date(now.getTime() - AUTO_ARCHIVE_MS) } },
    { $set: { archived: true, archivedAt: now, archivedBy: "auto" } },
  );
  return res.modifiedCount;
}

/**
 * Suhbatlar ro'yxati — faqat nom va vaqt (xabarlar o'qilmaydi), yangisi
 * birinchi. `archived: true` — arxiv, aks holda faol suhbatlar.
 */
export async function listConversations(
  db: Db,
  userId: string,
  opts: { archived?: boolean } = {},
): Promise<AiConversationSummary[]> {
  await autoArchive(db, userId);
  const docs = await col(db)
    .find(
      { userId, ...ALIVE, archived: opts.archived ? true : { $ne: true } },
      { projection: { _id: 0, id: 1, title: 1, updatedAt: 1, archived: 1 } },
    )
    .sort({ updatedAt: -1 })
    .limit(LIST_LIMIT)
    .toArray();
  return docs.map((d) => ({
    id: d.id,
    title: d.title ?? "",
    updatedAt: new Date(d.updatedAt).toISOString(),
    archived: d.archived === true,
  }));
}

/** Panel ochilganda — oxirgi FAOL suhbat davom ettiriladi (arxivdagisi emas). */
export async function latestConversation(db: Db, userId: string): Promise<AiConversationView | null> {
  const [d] = await col(db)
    .find({ userId, ...ALIVE, archived: { $ne: true } }, { projection: { _id: 0 } })
    .sort({ updatedAt: -1 })
    .limit(1)
    .toArray();
  return d ? view(d) : null;
}

/**
 * Savol va javobni yozadi. `id` berilmasa (yoki boshqa odamniki / o'chirilgan
 * bo'lsa) yangi suhbat ochiladi — `newId` bilan (route uni oqim boshida
 * mijozga aytib qo'ygan bo'ladi), bo'lmasa yangi UUID. Qaytaradi — suhbat id'si.
 *
 * `replaceFrom` — TAHRIRLANGAN savol (11.10.2026): suhbat shu indeksdagi
 * xabardan boshlab kesiladi va yangi savol-javob o'sha joyga yoziladi
 * (route indeks shu xodimning savoli ekanini tekshirgan). Birinchi savol
 * tahrirlansa — suhbat nomi ham yangilanadi.
 *
 * Arxivdagi suhbatga yozilsa — u yana faol bo'ladi.
 */
export async function saveTurn(
  db: Db,
  userId: string,
  id: string | null,
  turn: [AiChatMessage, AiChatMessage],
  opts: { newId?: string; replaceFrom?: { index: number; kept: AiChatMessage[] } } = {},
): Promise<string> {
  const now = new Date();
  const revive = { archived: false, updatedAt: now };
  const unset = { archivedAt: "", archivedBy: "", expiresAt: "" } as const;
  if (id) {
    const res = opts.replaceFrom
      ? await col(db).updateOne(
          { id, userId, ...ALIVE },
          {
            $set: {
              ...revive,
              messages: [...opts.replaceFrom.kept, ...turn].slice(-MAX_STORED),
              ...(opts.replaceFrom.index === 0 ? { title: titleOf(turn[0].content) } : {}),
            },
            $unset: unset,
          },
        )
      : await col(db).updateOne(
          { id, userId, ...ALIVE },
          { $push: { messages: { $each: turn, $slice: -MAX_STORED } }, $set: revive, $unset: unset },
        );
    if (res.matchedCount > 0) return id;
  }
  const newId = opts.newId || randomUUID();
  await col(db).insertOne({
    id: newId,
    userId,
    title: titleOf(turn[0].content),
    messages: turn,
    createdAt: now,
    updatedAt: now,
    archived: false,
  });
  return newId;
}

function titleOf(question: string): string {
  return question.replace(/\s+/g, " ").trim().slice(0, 80);
}

/** Arxivlash / arxivdan qaytarish (xodimning o'zi). */
export async function setArchived(db: Db, userId: string, id: string, archived: boolean): Promise<boolean> {
  const res = await col(db).updateOne(
    { id, userId, ...ALIVE },
    archived
      ? { $set: { archived: true, archivedAt: new Date(), archivedBy: "user" } }
      : { $set: { archived: false }, $unset: { archivedAt: "", archivedBy: "" } },
  );
  return res.matchedCount > 0;
}

/**
 * Savatcha — YUMSHOQ o'chirish: xodim endi ko'rmaydi, yozuv bazada qoladi
 * (foydalanuvchi: «db da saqlansin har bir suhbat»).
 */
export async function deleteConversation(db: Db, userId: string, id: string): Promise<boolean> {
  const res = await col(db).updateOne({ id, userId, ...ALIVE }, { $set: { deletedAt: new Date() } });
  return res.modifiedCount > 0;
}
