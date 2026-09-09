import type { Db } from "mongodb";
import { uzStamp } from "@/lib/uzTime";
import type { MatchRole, PupilMatch } from "@/lib/studentBot/phone";

// Telegram hisobi ↔ o'quvchi bog'lanishi. MongoDB `student_bot_users`.
//
// Bitta hujjat = bitta TELEGRAM SUHBATI (chat). Ota-ona bir nechta
// farzandini ko'rishi mumkin, shu bois bog'lanish RO'YXAT — `links`.
// Ekranda bir vaqtda bittasi ko'rinadi (`activePupilId`), menyudagi
// "Farzandni almashtirish" uni o'zgartiradi.
//
// BU KOLLEKSIYA PAROL SAQLAMAYDI va o'quvchi hujjatiga TEGMAYDI:
// `pupils` faqat O'QILADI. Ya'ni bot bilan bog'liq hech narsa CRM
// ma'lumotini o'zgartira olmaydi — eng yomon holatda bog'lanish
// noto'g'ri bo'ladi va uni o'chirib qayta ulanadi.

export const BOT_USERS = "student_bot_users";

/** Avtomatik xabar turlari — Sozlamalarda alohida-alohida o'chiriladi. */
export type NotifyKind = "attendance" | "payment";

export interface BotUserLink {
  pupilId: number;
  role: MatchRole;
}

export interface StudentBotUser {
  /** Telegram chat id — shaxsiy yozishmada foydalanuvchi id'siga teng. */
  chatId: number;
  /** Solishtirish kaliti: oxirgi 9 raqam (lib/studentBot/phone.ts). */
  phone: string;
  links: BotUserLink[];
  activePupilId: number;
  tgName: string;
  tgUsername: string;
  /** "09.09.2026 | 14:30" */
  linkedAt: string;
  lastSeenAt: string;
  /**
   * Joriy menyu xabarining id'si.
   *
   * NEGA SAQLANADI: har bosishda yangi xabar yuborilsa yozishma o'nlab
   * eski menyu bilan to'lib ketardi. Buning o'rniga BITTA xabar qayta
   * chiziladi. Avtomatik xabar (davomat/to'lov) kelib menyuni yuqoriga
   * surib yuborsa, keyingi bosishda tahrirlash baribir ishlayveradi —
   * Telegram xabarni joyida yangilaydi.
   */
  menuMessageId?: number;
  /**
   * Keyingi MATN xabari nima uchun kutilyapti. Hozircha bitta holat:
   * "support" — o'quvchi savolini yozmoqda. `null`/yo'q bo'lsa erkin
   * matn e'tiborsiz qoldiriladi (bot suhbatdosh emas).
   */
  awaiting?: "support" | null;
  notify: Record<NotifyKind, boolean>;
  /**
   * Bot bloklangan (Telegram 403 qaytardi).
   *
   * NEGA BELGILANADI: bloklangan odamga har davomatda qayta-qayta
   * urinish bekorga so'rov. Belgi qo'yilgach push o'tkazib yuboriladi;
   * odam botga qaytib /start yozsa belgi olib tashlanadi.
   */
  blocked?: boolean;
}

const DEFAULT_NOTIFY: Record<NotifyKind, boolean> = { attendance: true, payment: true };

export async function getBotUser(db: Db, chatId: number): Promise<StudentBotUser | null> {
  const row = await db.collection(BOT_USERS).findOne({ chatId }, { projection: { _id: 0 } });
  return (row as StudentBotUser | null) ?? null;
}

/**
 * Bog'lanishni yozadi (yoki mavjudini yangilaydi).
 *
 * `notify` va `activePupilId` ATAYLAB `$setOnInsert` da: odam raqamini
 * qayta yuborsa (masalan yangi farzand qo'shilgani uchun) uning
 * o'chirib qo'ygan xabar sozlamalari va tanlagan farzandi saqlanib
 * qolsin. `links` esa har safar qayta hisoblanadi — bazada farzand
 * qo'shilgan yoki olib tashlangan bo'lishi mumkin.
 */
export async function linkBotUser(
  db: Db,
  chatId: number,
  phone: string,
  matches: PupilMatch[],
  tg: { name: string; username: string },
): Promise<StudentBotUser> {
  const now = uzStamp();
  const links: BotUserLink[] = matches.map((m) => ({ pupilId: m.pupilId, role: m.role }));
  const existing = await getBotUser(db, chatId);

  // Avval tanlangan farzand hali ham ro'yxatdami — bo'lmasa birinchisi.
  const keepActive =
    existing && links.some((l) => l.pupilId === existing.activePupilId)
      ? existing.activePupilId
      : links[0].pupilId;

  await db.collection(BOT_USERS).updateOne(
    { chatId },
    {
      $set: {
        phone,
        links,
        activePupilId: keepActive,
        tgName: tg.name,
        tgUsername: tg.username,
        lastSeenAt: now,
        // Qayta ulanish = bot bloklanmagan.
        blocked: false,
        awaiting: null,
      },
      $setOnInsert: { chatId, linkedAt: now, notify: DEFAULT_NOTIFY },
    },
    { upsert: true },
  );

  const saved = await getBotUser(db, chatId);
  if (!saved) throw new Error("Bog'lanish saqlanmadi");
  return saved;
}

/** Bog'lanishni uzadi ("Chiqish"). Hujjat butunlay o'chiriladi. */
export async function unlinkBotUser(db: Db, chatId: number): Promise<void> {
  await db.collection(BOT_USERS).deleteOne({ chatId });
}

/** Ko'rilayotgan farzandni almashtiradi. Ro'yxatda yo'q id qabul qilinmaydi. */
export async function setActivePupil(db: Db, chatId: number, pupilId: number): Promise<boolean> {
  const res = await db.collection(BOT_USERS).updateOne(
    { chatId, "links.pupilId": pupilId },
    { $set: { activePupilId: pupilId, lastSeenAt: uzStamp() } },
  );
  return res.matchedCount > 0;
}

export async function setAwaiting(db: Db, chatId: number, value: "support" | null): Promise<void> {
  await db.collection(BOT_USERS).updateOne({ chatId }, { $set: { awaiting: value } });
}

export async function setMenuMessage(db: Db, chatId: number, messageId: number): Promise<void> {
  await db.collection(BOT_USERS).updateOne({ chatId }, { $set: { menuMessageId: messageId } });
}

/** Xabar turini yoqadi/o'chiradi va YANGI holatni qaytaradi. */
export async function toggleNotify(db: Db, chatId: number, kind: NotifyKind): Promise<boolean> {
  const user = await getBotUser(db, chatId);
  const next = !(user?.notify?.[kind] ?? true);
  await db.collection(BOT_USERS).updateOne({ chatId }, { $set: { [`notify.${kind}`]: next } });
  return next;
}

export async function touchBotUser(db: Db, chatId: number): Promise<void> {
  await db.collection(BOT_USERS).updateOne({ chatId }, { $set: { lastSeenAt: uzStamp() } });
}

/** Bot bloklangani belgilanadi — keyingi pushlar shu chatga urinmaydi. */
export async function markBlocked(db: Db, chatId: number): Promise<void> {
  await db.collection(BOT_USERS).updateOne({ chatId }, { $set: { blocked: true } });
}

/**
 * Shu o'quvchi haqidagi xabar KIMGA ketishi kerak.
 *
 * Bir o'quvchiga bir nechta chat bog'langan bo'lishi mumkin (o'zi, onasi,
 * otasi) — hammasiga boradi. Bloklaganlar va shu turni o'chirganlar
 * tushib qoladi.
 *
 * `notify` maydoni YO'Q eski hujjatlar ham qaytadi: `$ne: false` —
 * "aniq o'chirilmagan" degani, `true` emas. Aks holda modul yangilangan
 * kunidan oldin ulangan hamma jim qolardi.
 */
export async function chatsForPupil(db: Db, pupilId: number, kind: NotifyKind): Promise<number[]> {
  const rows = await db
    .collection(BOT_USERS)
    .find(
      { "links.pupilId": pupilId, blocked: { $ne: true }, [`notify.${kind}`]: { $ne: false } },
      { projection: { _id: 0, chatId: 1 } },
    )
    .toArray();
  return rows.map((r) => Number(r.chatId)).filter((n) => Number.isFinite(n));
}

/** Joriy tanlangan farzandning bog'lanishi (roli bilan). */
export function activeLink(user: StudentBotUser): BotUserLink | null {
  return user.links.find((l) => l.pupilId === user.activePupilId) ?? user.links[0] ?? null;
}
