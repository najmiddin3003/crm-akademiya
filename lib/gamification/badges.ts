import type { Db } from "mongodb";
import { GAM } from "./db";
import type { GamLevel } from "./types";

// NISHONLAR (TZ 4.19) — 13 ta.
//
// Saqlanadi: `student_badges` {pupilId, code, earnedAt, revokedAt, month,
// groupId}. Unikallik (pupilId, code, month, groupId): oddiy nishonlarda
// month/groupId = null, «Oy o'quvchisi» — har oy va guruh uchun alohida.
//
// Qachon tekshiriladi: «Aniq vaqt» va «Oy o'quvchisi» — oy yakunida
// (competition.ts), qolganlari — har tranzaksiyadan keyin (wallet.ts →
// withWallet) va Sarhisob hodisasidan keyin. Asos bo'lgan yozuv bekor
// qilinib, shart endi hech bir oyda bajarilmasa — `revokedAt`; shart yana
// bajarilsa, O'SHA qatorda `revokedAt = null` (yangi qator ochilmaydi).

export type BadgeCode =
  | "first_coin"
  | "on_time"
  | "iron_discipline"
  | "homework_master"
  | "active"
  | "excellent"
  | "growth"
  | "friendship"
  | "level_2"
  | "level_3"
  | "level_4"
  | "level_5"
  | "student_of_month";

export interface BadgeMeta {
  code: BadgeCode;
  emoji: string;
  /** Daraja nishonlarida nom — darajaning o'z nomi (sozlamalardan). */
  name: string;
  desc: string;
}

export const BADGES: BadgeMeta[] = [
  { code: "first_coin", emoji: "🌱", name: "Birinchi qadam", desc: "Birinchi tanga" },
  { code: "on_time", emoji: "⏰", name: "Aniq vaqt", desc: "Bir oyda 8+ dars, hammasida vaqtida" },
  { code: "iron_discipline", emoji: "🔥", name: "Temir intizom", desc: "Uzluksiz davomat bonusi olgan" },
  { code: "homework_master", emoji: "📚", name: "Uy vazifasi ustasi", desc: "Bir oyda 8+ uy vazifasi" },
  { code: "active", emoji: "🙋", name: "Faol", desc: "Bir oyda faollikdan 15+ tanga" },
  { code: "excellent", emoji: "🎯", name: "A'lochi", desc: "Sarhisob 90%+" },
  { code: "growth", emoji: "📈", name: "Yuksalish", desc: "O'sish bonusi olgan" },
  { code: "friendship", emoji: "🤝", name: "Do'stlik", desc: "Do'st olib kelgan" },
  { code: "level_2", emoji: "🔎", name: "", desc: "2-daraja" },
  { code: "level_3", emoji: "💡", name: "", desc: "3-daraja" },
  { code: "level_4", emoji: "🎓", name: "", desc: "4-daraja" },
  { code: "level_5", emoji: "👑", name: "", desc: "5-daraja · eng yuqori" },
  { code: "student_of_month", emoji: "🏆", name: "Oy o'quvchisi", desc: "Oy yakunida guruhda 1-o'rin" },
];

const LEVEL_CODES: BadgeCode[] = ["level_2", "level_3", "level_4", "level_5"];

/** Nishon nomi — daraja nishonlarida sozlamadagi daraja nomi. */
export function badgeName(code: BadgeCode, levels: GamLevel[]): string {
  const i = LEVEL_CODES.indexOf(code);
  if (i >= 0) return levels[i + 1]?.name ?? code;
  return BADGES.find((b) => b.code === code)?.name ?? code;
}

/** Unique indeks db.ts → createGamIndexes da (gamDb() kutadi). */
export function badgesCol(db: Db) {
  return db.collection(GAM.badges);
}

/** Oylik yig'indi shartini tekshiradi: biror oyda `count`/`sum` ≥ chegara. */
async function anyMonth(db: Db, pupilId: number, type: string, how: "count" | "sum", min: number): Promise<boolean> {
  const rows = await db
    .collection(GAM.tx)
    .aggregate<{ v: number }>([
      { $match: { pupilId, type, status: "active" } },
      { $group: { _id: { $substrBytes: ["$date", 0, 7] }, v: how === "count" ? { $sum: 1 } : { $sum: "$amount" } } },
      { $match: { v: { $gte: min } } },
      { $limit: 1 },
    ])
    .toArray();
  return rows.length > 0;
}

async function hasActive(db: Db, pupilId: number, type: string): Promise<boolean> {
  return (await db.collection(GAM.tx).countDocuments({ pupilId, type, status: "active" }, { limit: 1 })) > 0;
}

/** Biror Sarhisob natijasi ≥ 90% (natijaning o'zidan — tanga 0 bo'lsa ham, TZ 4.8.5). */
async function hasExcellent(db: Db, pupilId: number, sinceMonth: string | null): Promise<boolean> {
  const q: Record<string, unknown> = { students: { $elemMatch: { pupilId, pct: { $gte: 90 } } } };
  if (sinceMonth) q.month = { $gte: sinceMonth };
  return (await db.collection("group_exams").countDocuments(q, { limit: 1 })) > 0;
}

/**
 * Doimiy shartli nishonlarni qayta tekshiradi (oy yakunidagilardan
 * tashqari). Yangi olingan (yoki qayta tiklangan) nishonlar kodini qaytaradi.
 */
export async function recheckBadges(
  db: Db,
  pupilId: number,
  earnedTotal: number,
  levelIndex: number,
  startDate: string | null,
): Promise<BadgeCode[]> {
  const [iron, hw, act, growth, friend, excellent] = await Promise.all([
    hasActive(db, pupilId, "streak"),
    anyMonth(db, pupilId, "homework_done", "count", 8),
    anyMonth(db, pupilId, "activity", "sum", 15),
    hasActive(db, pupilId, "growth"),
    hasActive(db, pupilId, "referral"),
    hasExcellent(db, pupilId, startDate ? startDate.slice(0, 7) : null),
  ]);
  const want = new Map<BadgeCode, boolean>([
    ["first_coin", earnedTotal > 0],
    ["iron_discipline", iron],
    ["homework_master", hw],
    ["active", act],
    ["excellent", excellent],
    ["growth", growth],
    ["friendship", friend],
    ["level_2", levelIndex >= 1],
    ["level_3", levelIndex >= 2],
    ["level_4", levelIndex >= 3],
    ["level_5", levelIndex >= 4],
  ]);
  const col = badgesCol(db);
  const have = await col
    .find({ pupilId, code: { $in: [...want.keys()] }, month: null, groupId: null }, { projection: { _id: 0, code: 1, revokedAt: 1 } })
    .toArray();
  const byCode = new Map(have.map((b) => [b.code as BadgeCode, b]));
  const now = new Date().toISOString();
  const fresh: BadgeCode[] = [];
  for (const [code, held] of want) {
    const doc = byCode.get(code);
    if (held && (!doc || doc.revokedAt)) {
      await col.updateOne(
        { pupilId, code, month: null, groupId: null },
        { $set: { revokedAt: null }, $setOnInsert: { pupilId, code, month: null, groupId: null, earnedAt: now } },
        { upsert: true },
      );
      fresh.push(code);
    } else if (!held && doc && !doc.revokedAt) {
      await col.updateOne({ pupilId, code, month: null, groupId: null }, { $set: { revokedAt: now } });
    }
  }
  return fresh;
}

/** Profil uchun: 13 nishon, olinganlari belgilangan. */
export async function badgeBoard(db: Db, pupilId: number, levels: GamLevel[]) {
  const docs = await badgesCol(db)
    .find({ pupilId, revokedAt: null }, { projection: { _id: 0, code: 1, earnedAt: 1, month: 1 } })
    .toArray();
  return BADGES.map((b) => {
    const mine = docs.filter((d) => d.code === b.code);
    return {
      code: b.code,
      emoji: b.emoji,
      name: badgeName(b.code, levels),
      desc: b.desc,
      earned: mine.length > 0,
      earnedAt: mine.map((d) => String(d.earnedAt ?? "")).sort()[0] ?? null,
      /** «Oy o'quvchisi» — necha marta. */
      times: mine.length,
    };
  });
}
