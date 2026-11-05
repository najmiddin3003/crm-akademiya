import type { Db } from "mongodb";
import { uzStamp } from "@/lib/uzTime";
import type { MatchRole, PupilMatch } from "@/lib/studentBot/phone";

// Telegram hisobi ↔ o'quvchi bog'lanishi. MongoDB `student_bot_users`.
//
// Bitta hujjat = bitta TELEGRAM SUHBATI (chat). Ota-ona bir nechta
// farzandini ko'rishi mumkin, shu bois bog'lanish RO'YXAT — `links`.
// Ekranda bir vaqtda bittasi ko'rinadi (`activePupilId`), menyudagi
// "Boshqa profil" uni o'zgartiradi.
//
// BU KOLLEKSIYA PAROL SAQLAMAYDI va o'quvchi hujjatiga TEGMAYDI:
// `pupils` faqat O'QILADI. Ya'ni bot bilan bog'liq hech narsa CRM
// ma'lumotini o'zgartira olmaydi — eng yomon holatda bog'lanish
// noto'g'ri bo'ladi va uni o'chirib qayta ulanadi.

export const BOT_USERS = "student_bot_users";

/**
 * Avtomatik xabar turi — faqat JURNALDAGI belgi uchun.
 *
 * Ilgari bu o'quvchi o'chirib qo'ya oladigan sozlama edi. Endi
 * davomat va to'lov xabarlari DOIM yoqilgan (markaz qarori): xabar
 * o'chirib qo'yilsa o'quvchi qarzdorligini yoki dars qoldirganini
 * bilmay qolardi, markaz esa uni ogohlantirgan deb hisoblardi.
 */
export type NotifyKind = "attendance" | "payment" | "group" | "due";

export interface BotUserLink {
  pupilId: number;
  role: MatchRole;
  /**
   * "form" — bog'lanish raqam bilan kirishda emas, forma orqali berilgan: ota-ona
   * farzandining ism familiyasi va raqamini yozgan yoki bot anketasi kartani
   * ochgan. Bunday bola odamning O'Z raqamiga bog'liq emas, shu bois
   * `linkBotUser` uni qayta hisoblashda tashlab yubormaydi.
   */
  via?: "form";
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
  /**
   * Bot bloklangan (Telegram 403 qaytardi).
   *
   * NEGA BELGILANADI: bloklangan odamga har davomatda qayta-qayta
   * urinish bekorga so'rov. Belgi qo'yilgach push o'tkazib yuboriladi;
   * odam botga qaytib /start yozsa belgi olib tashlanadi.
   */
  blocked?: boolean;
}

export async function getBotUser(db: Db, chatId: number): Promise<StudentBotUser | null> {
  const row = await db.collection(BOT_USERS).findOne({ chatId }, { projection: { _id: 0 } });
  return (row as StudentBotUser | null) ?? null;
}

/**
 * Bog'lanishni yozadi (yoki mavjudini yangilaydi).
 *
 * `activePupilId` ATAYLAB saqlanadi: odam raqamini qayta yuborsa
 * (masalan yangi farzand qo'shilgani uchun) tanlagan farzandi
 * o'zgarmasin. `links` esa har safar qayta hisoblanadi — bazada
 * farzand qo'shilgan yoki olib tashlangan bo'lishi mumkin.
 */
export async function linkBotUser(
  db: Db,
  chatId: number,
  phone: string,
  matches: PupilMatch[],
  tg: { name: string; username: string },
): Promise<StudentBotUser> {
  const now = uzStamp();
  const existing = await getBotUser(db, chatId);
  const links: BotUserLink[] = matches.map((m) => ({ pupilId: m.pupilId, role: m.role }));
  // Forma bilan qo'shilgan bolalar raqamga bog'liq emas — qayta ulanishda qoladi.
  for (const l of existing?.links ?? []) {
    if (l.via === "form" && !links.some((x) => x.pupilId === l.pupilId)) links.push(l);
  }

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
      $setOnInsert: { chatId, linkedAt: now },
    },
    { upsert: true },
  );

  const saved = await getBotUser(db, chatId);
  if (!saved) throw new Error("Bog'lanish saqlanmadi");
  return saved;
}

/**
 * Forma orqali bog'laydi (ota-ona formasi, bot anketasi). `linkBotUser` dan
 * farqi: mavjud bog'lanishlar SAQLANADI va yangi qo'shilgan o'quvchi ochiladi —
 * ikkinchi farzandini ulagan ota-ona birinchisini yo'qotmasin va kimni
 * qo'shganini darrov ko'rsin.
 */
export async function addBotLinks(
  db: Db,
  chatId: number,
  phone: string,
  added: Omit<BotUserLink, "via">[],
  tg: { name: string; username: string },
): Promise<StudentBotUser> {
  const now = uzStamp();
  const existing = await getBotUser(db, chatId);
  const links: BotUserLink[] = [...(existing?.links ?? [])];
  for (const l of added) {
    if (!links.some((x) => x.pupilId === l.pupilId)) links.push({ ...l, via: "form" });
  }

  await db.collection(BOT_USERS).updateOne(
    { chatId },
    {
      $set: {
        phone: existing?.phone || phone,
        links,
        activePupilId: added[0].pupilId,
        tgName: tg.name,
        tgUsername: tg.username,
        lastSeenAt: now,
        blocked: false,
        awaiting: null,
      },
      $setOnInsert: { chatId, linkedAt: now },
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
/**
 * Shu o'quvchiga bog'langan HAMMA chat (o'zi, onasi, otasi).
 *
 * Xabar turiga qarab FILTRLANMAYDI — davomat va to'lov xabarlari
 * doim yoqilgan. Bloklaganlar chiqarib tashlanadi: ularga urinish
 * bekorga so'rov.
 */
export async function chatsForPupil(db: Db, pupilId: number): Promise<number[]> {
  const rows = await db
    .collection(BOT_USERS)
    .find(
      { "links.pupilId": pupilId, blocked: { $ne: true } },
      { projection: { _id: 0, chatId: 1 } },
    )
    .toArray();
  return rows.map((r) => Number(r.chatId)).filter((n) => Number.isFinite(n));
}

/** O'quvchiga bog'langan, lekin botni bloklagan suhbat bormi (`chatsForPupil` ularni tashlaydi). */
export async function pupilHasBlockedChat(db: Db, pupilId: number): Promise<boolean> {
  return (await db.collection(BOT_USERS).countDocuments({ "links.pupilId": pupilId, blocked: true }, { limit: 1 })) > 0;
}

/** Joriy tanlangan farzandning bog'lanishi (roli bilan). */
export function activeLink(user: StudentBotUser): BotUserLink | null {
  return user.links.find((l) => l.pupilId === user.activePupilId) ?? user.links[0] ?? null;
}
