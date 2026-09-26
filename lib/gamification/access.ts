import crypto from "node:crypto";
import type { Db } from "mongodb";
import { uzDateIso } from "@/lib/uzTime";
import { writeAudit, type GamActor } from "./actor";
import { GAM, nextSeq, withLock } from "./db";
import { GamError } from "./wallet";

// O'QUVCHI SAHIFASIGA KIRISH (TZ 5.8, 6.14, 6.16).
//
// Ikki yo'l, ikkalasida bitta sahifa:
//   • SHAXSIY HAVOLA `/me/{token}` — parolsiz; token tasodifiy (32 bayt →
//     base64url = 43 belgi, faqat A–Z a–z 0–9 _ - — Telegram `start`
//     parametri talabi). O'quvchida bitta FAOL token (`activeKey`).
//   • TELEGRAM: havola sahifasidagi «Telegramda ochish» → o'quvchilar boti
//     `/start {token}` → akkaunt o'quvchiga bog'lanadi (`student_telegram_links`),
//     bir o'quvchiga ko'pi bilan 3 ta (o'zi va ota-onasi). Bitta akkaunt bir
//     nechta o'quvchiga bog'lanishi mumkin (ota-onaning ikki farzandi).
// Havola qayta yaratilsa eski token VA o'quvchining barcha Telegram
// bog'lanishlari darhol bekor bo'ladi (`revokedAt`, avtomatik — kim: null).
//
// Mongo'da tranzaksiya yo'q (standalone) — 3 ta chegara va «bitta faol
// token» o'quvchi bo'yicha lease-qulf ostida (TZ dagi `FOR UPDATE` o'rnida).

export const MAX_TG_LINKS = 3;
const TOKEN_RE = /^[A-Za-z0-9_-]{32,64}$/;

/** Token shakli to'g'rimi — bazaga borishdan oldingi arzon tekshiruv. */
export const isTokenShape = (t: string) => TOKEN_RE.test(t);

const newToken = () => crypto.randomBytes(32).toString("base64url");

export interface AccessToken {
  id: number;
  pupilId: number;
  token: string;
  activeKey?: string;
  createdByUserId: string | null;
  createdByName: string;
  createdAt: string;
  revokedAt: string | null;
}

export interface TgLink {
  id: number;
  pupilId: number;
  telegramUserId: number;
  /** 2-bosqich xabarnomalari uchun hozirdan saqlanadi (TZ 6.16). */
  chatId: number;
  tgUsername: string;
  tgFirstName: string;
  linkedAt: string;
  revokedAt: string | null;
  /** `null` — havola qayta yaratilgani sababli avtomatik. */
  revokedByUserId: string | null;
  revokedByName: string | null;
  activeKey?: string;
}

const PROJ = { projection: { _id: 0 } } as const;

/** Profildagi «O'quvchi havolasi va Telegram» — filial admini (o'z filiali) va direktor (TZ 5.4). */
export async function assertLinkManager(db: Db, actor: GamActor, pupilId: number): Promise<void> {
  if (actor.role === "teacher") throw new GamError(403, "Bu amal filial admini yoki direktor uchun");
  const p = await db.collection("pupils").findOne({ id: pupilId }, { projection: { _id: 0, branchId: 1 } });
  if (!p) throw new GamError(404, "O'quvchi topilmadi");
  if (actor.role === "branch_admin" && !actor.branchIds.includes(Number(p.branchId) || 1)) {
    throw new GamError(403, "O'quvchi sizning filialingizda emas");
  }
}

export async function activeToken(db: Db, pupilId: number): Promise<AccessToken | null> {
  return (await db.collection(GAM.accessTokens).findOne({ pupilId, revokedAt: null }, PROJ)) as unknown as AccessToken | null;
}

async function insertToken(db: Db, actor: GamActor, pupilId: number): Promise<AccessToken> {
  const doc: AccessToken = {
    id: await nextSeq(db, GAM.accessTokens),
    pupilId,
    token: newToken(),
    activeKey: String(pupilId),
    createdByUserId: actor.userId,
    createdByName: actor.name,
    createdAt: new Date().toISOString(),
    revokedAt: null,
  };
  await db.collection(GAM.accessTokens).insertOne({ ...doc });
  return doc;
}

/** Profildagi «Havolani nusxalash»: faol token, bo'lmasa yangisi yaratiladi. */
export async function getOrCreateToken(db: Db, actor: GamActor, pupilId: number): Promise<AccessToken> {
  const cur = await activeToken(db, pupilId);
  if (cur) return cur;
  return withLock(db, `token:${pupilId}`, async () => {
    const again = await activeToken(db, pupilId);
    if (again) return again;
    const t = await insertToken(db, actor, pupilId);
    await writeAudit(db, actor, GAM.accessTokens, pupilId, "create", null, { tokenId: t.id });
    return t;
  });
}

/**
 * «Qayta yaratish» (TZ 5.4, 6.14): eski token va o'quvchining BARCHA
 * Telegram bog'lanishlari darhol bekor — eski havola ham, eski `/start`
 * ham ishlamaydi, akkauntlar qayta bog'lanishi kerak.
 */
export async function regenerateToken(db: Db, actor: GamActor, pupilId: number): Promise<{ token: AccessToken; revokedLinks: number }> {
  return withLock(db, `token:${pupilId}`, async () =>
    withLock(db, `tglink:${pupilId}`, async () => {
      const now = new Date().toISOString();
      await db.collection(GAM.accessTokens).updateMany({ pupilId, revokedAt: null }, { $set: { revokedAt: now }, $unset: { activeKey: "" } });
      const links = await db
        .collection(GAM.tgLinks)
        .updateMany({ pupilId, revokedAt: null }, { $set: { revokedAt: now, revokedByUserId: null, revokedByName: null }, $unset: { activeKey: "" } });
      const token = await insertToken(db, actor, pupilId);
      await writeAudit(db, actor, GAM.accessTokens, pupilId, "regenerate", null, { tokenId: token.id, revokedLinks: links.modifiedCount });
      return { token, revokedLinks: links.modifiedCount };
    }),
  );
}

/** Havola egasi — faol token bo'yicha o'quvchi; noto'g'ri/eski token — null. */
export async function pupilIdByToken(db: Db, token: string): Promise<number | null> {
  if (!isTokenShape(token)) return null;
  const t = await db.collection(GAM.accessTokens).findOne({ token, revokedAt: null }, { projection: { _id: 0, pupilId: 1 } });
  return t ? Number(t.pupilId) : null;
}

export interface TgUserInfo {
  userId: number;
  chatId: number;
  username: string;
  firstName: string;
}

export type LinkResult = { ok: true; pupilId: number; already: boolean } | { ok: false; error: string };

/**
 * Bot `/start {token}` (TZ 5.8): akkauntni o'quvchiga bog'laydi. Shu akkaunt
 * allaqachon bog'langan bo'lsa yangi qator yaratilmaydi va limitga kirmaydi.
 * Chegara (3 ta) — qulf ostida, ya'ni bir vaqtdagi so'rovlar uni buzmaydi.
 */
export async function linkTelegram(db: Db, token: string, tg: TgUserInfo): Promise<LinkResult> {
  const pupilId = await pupilIdByToken(db, token);
  if (pupilId === null) return { ok: false, error: "Havola eskirgan yoki noto'g'ri — filial adminidan yangi havola so'rang." };
  return withLock(db, `tglink:${pupilId}`, async () => {
    // Qulf kutilayotganda havola qayta yaratilgan bo'lishi mumkin.
    if ((await pupilIdByToken(db, token)) !== pupilId) {
      return { ok: false, error: "Havola eskirgan yoki noto'g'ri — filial adminidan yangi havola so'rang." };
    }
    const col = db.collection(GAM.tgLinks);
    const key = `${pupilId}:${tg.userId}`;
    const existing = await col.findOne({ activeKey: key }, { projection: { _id: 0, id: 1 } });
    if (existing) {
      await col.updateOne({ id: existing.id }, { $set: { chatId: tg.chatId, tgUsername: tg.username, tgFirstName: tg.firstName } });
      return { ok: true, pupilId, already: true };
    }
    const active = await col.countDocuments({ pupilId, revokedAt: null });
    if (active >= MAX_TG_LINKS) {
      const max = MAX_TG_LINKS;
      return { ok: false, error: `Bu o'quvchiga ko'pi bilan ${max} ta Telegram akkaunt bog'lanadi.` };
    }
    const link: TgLink = {
      id: await nextSeq(db, GAM.tgLinks),
      pupilId,
      telegramUserId: tg.userId,
      chatId: tg.chatId,
      tgUsername: tg.username,
      tgFirstName: tg.firstName,
      linkedAt: new Date().toISOString(),
      revokedAt: null,
      revokedByUserId: null,
      revokedByName: null,
      activeKey: key,
    };
    await col.insertOne({ ...link });
    return { ok: true, pupilId, already: false };
  });
}

/** Telegram akkauntiga token orqali bog'langan o'quvchilar — eng avval bog'langani birinchi. */
export async function telegramLinkedPupils(db: Db, telegramUserId: number): Promise<number[]> {
  const rows = await db
    .collection(GAM.tgLinks)
    .find({ telegramUserId, revokedAt: null }, { projection: { _id: 0, pupilId: 1 } })
    .sort({ linkedAt: 1 })
    .toArray();
  return [...new Set(rows.map((r) => Number(r.pupilId)))];
}

/** Profil ro'yxati (TZ 5.4): faol bog'lanishlar — ism, @username, sana. */
export async function listTelegramLinks(db: Db, pupilId: number) {
  const rows = (await db
    .collection(GAM.tgLinks)
    .find({ pupilId, revokedAt: null }, PROJ)
    .sort({ linkedAt: 1 })
    .toArray()) as unknown as TgLink[];
  return rows.map((l) => ({
    id: l.id,
    name: l.tgFirstName || "",
    username: l.tgUsername || "",
    linkedAt: uzDateIso(new Date(l.linkedAt)),
  }));
}

/** «Uzish» — admin/direktor bitta akkauntni uzadi. */
export async function unlinkTelegram(db: Db, actor: GamActor, pupilId: number, linkId: number): Promise<void> {
  const r = await db
    .collection(GAM.tgLinks)
    .updateOne(
      { id: linkId, pupilId, revokedAt: null },
      { $set: { revokedAt: new Date().toISOString(), revokedByUserId: actor.userId, revokedByName: actor.name }, $unset: { activeKey: "" } },
    );
  if (r.modifiedCount !== 1) throw new GamError(404, "Bog'lanish topilmadi");
  await writeAudit(db, actor, GAM.tgLinks, linkId, "unlink", { pupilId }, null);
}
