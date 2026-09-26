import type { Db } from "mongodb";
import { loadStudentBotConfig } from "@/lib/studentBot/config";
import { getBotUser } from "@/lib/studentBot/users";
import { verifyInitData } from "@/lib/studentBot/webapp";
import { telegramLinkedPupils } from "./access";

// O'QUVCHI SAHIFASI — Telegram Mini App kirishi (TZ 5.8).
//
// `initData` bot tokeni bilan tekshiriladi (lib/studentBot/webapp.ts —
// HMAC-SHA256, 24 soatdan eski emas). O'QUVCHI ID'SI KLIENTDAN OLINMAYDI:
// Telegram foydalanuvchisiga bog'langan o'quvchilar ikki manbadan —
//   1) havola orqali `/start {token}` (student_telegram_links, TZ 6.16);
//   2) o'quvchilar botiga telefon bilan kirgan bo'lsa (student_bot_users).
// So'rovdagi `pupilId` faqat shu ro'yxatdan TANLAYDI.

export type TgAuth =
  | { ok: true; tgUserId: number; pupilIds: number[] }
  | { ok: false; status: 401 | 403 | 503; error: string };

export async function tgPupils(db: Db, initData: string): Promise<TgAuth> {
  const cfg = loadStudentBotConfig();
  if (!cfg.token) return { ok: false, status: 503, error: "Bot sozlanmagan" };
  const v = verifyInitData(initData, cfg.token);
  if (!v.ok) return { ok: false, status: 401, error: v.error };
  const [byToken, botUser] = await Promise.all([telegramLinkedPupils(db, v.tgUserId), getBotUser(db, v.tgUserId)]);
  const ids = [...byToken];
  for (const l of botUser?.links ?? []) if (!ids.includes(Number(l.pupilId))) ids.push(Number(l.pupilId));
  if (!ids.length) {
    return {
      ok: false,
      status: 403,
      error: "Bu Telegram akkaunt hech bir o'quvchiga bog'lanmagan — filial admini bergan havoladagi «Telegramda ochish» tugmasini bosing.",
    };
  }
  return { ok: true, tgUserId: v.tgUserId, pupilIds: ids };
}

/** So'ralgan o'quvchi (bo'lmasa eng avval bog'langani); begona id — `null`. */
export function pickPupil(auth: { pupilIds: number[] }, raw: string | null): number | null {
  if (raw === null || raw === "") return auth.pupilIds[0];
  const id = Number(raw);
  return auth.pupilIds.includes(id) ? id : null;
}
