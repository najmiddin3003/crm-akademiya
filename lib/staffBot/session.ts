import type { Db } from "mongodb";
import { uzStamp } from "@/lib/uzTime";

// Telegram suhbati ↔ CRM foydalanuvchisi bog'lanishi. MongoDB `staff_bot_users`.
//
// Bitta hujjat = bitta SHAXSIY SUHBAT (chat). Unda uch narsa turadi:
//   1) kirish bosqichi (telefon kutilyapti / parol kutilyapti / kirgan);
//   2) kirgan odam KIM (users._id, xodim ismi) — kassa har amalda shu
//      ismdan qayta topiladi (lib/staffBot/auth.ts), hujjatda saqlanmaydi:
//      admin kassani boshqa xodimga bersa bot darhol o'sha odamga ergashadi;
//   3) QORALAMA — boshlangan, lekin tugallanmagan amal (masalan Kirimning
//      qaysi qadamida turibdi, nima tanlangan). Serverless/pm2 qayta ishga
//      tushganda yo'qolmasin deb bazada, xotirada emas.
//
// BU KOLLEKSIYA PAROL SAQLAMAYDI. Parol faqat tekshiruv lahzasida
// mavjud (lib/staffBot/router.ts → deleteMessage bilan chatdan ham
// o'chiriladi). Kirgan odamning hisobi CRM'da bloklansa bot ham keyingi
// amalda to'xtaydi — `users.status` har safar qayta o'qiladi.

export const STAFF_BOT_USERS = "staff_bot_users";

/** Kirish bosqichi. */
export type LoginStage = "phone" | "password" | "in";

/** Kirim qoralamasining qadamlari — tartib bilan (lib/staffBot/kirim.ts). */
export type KirimStep = "type" | "student" | "amount" | "method" | "month" | "note" | "confirm" | "saving";

export interface KirimDraft {
  kind: "kirim";
  step: KirimStep;
  typeId?: number;
  typeName?: string;
  /** O'quvchi so'raladimi — turning "Mijoz" sozlamasidan (lib/txTarget.ts). */
  askStudent?: boolean;
  /**
   * Oy so'raladimi. "Uchinchi shaxs" turida (Kitob sotuvi) YO'Q — web'dagi
   * Kirim oynasi ham bu turda `periodMonth` yubormaydi.
   */
  askMonth?: boolean;
  studentId?: number;
  studentName?: string;
  studentPhone?: string;
  groupLabel?: string;
  /** O'quvchining guruhidagi ustoz — tasdiq kartasida ko'rinadi va yozuvga shu ketadi. */
  teacherName?: string;
  amount?: number;
  methodKey?: string;
  methodName?: string;
  periodMonth?: string;
  note?: string;
  /**
   * Tasdiq tugmasining BIR MARTALIK kaliti.
   *
   * Telegram javob kechiksa yangilanishni QAYTA yuboradi — bir xil
   * bosish ikki marta kelishi mumkin. Kalit qoralamada, tugmada esa uning
   * nusxasi: ikkinchi bosishda qoralama allaqachon `saving`/yo'q va u rad
   * etiladi. Pul ikki marta yozilmaydi (`claimDraftForSave`).
   */
  nonce: string;
  /** ms — 30 daqiqa tegilmagan qoralama bekor sanaladi. */
  updatedAt: number;
}

export type Draft = KirimDraft;

/** Shu muddat tegilmagan qoralama eskirgan sanaladi. */
export const DRAFT_TTL_MS = 30 * 60 * 1000;

export interface StaffBotUser {
  /** Telegram chat id — shaxsiy yozishmada foydalanuvchi id'siga teng. */
  chatId: number;
  stage: LoginStage;
  /** `stage === "password"` — tekshirilayotgan raqam (`normalizePhone` shaklida). */
  pendingPhone?: string;
  /** `users._id` (satr) — `stage === "in"` da bor. */
  userId?: string;
  employeeId?: number | null;
  /** `hr_employees.name` — kassa `moderator` shu ism bilan topiladi. */
  name?: string;
  isAdmin?: boolean;
  phone?: string;
  tgName: string;
  tgUsername: string;
  /** "18.09.2026 | 14:30" */
  loggedInAt?: string;
  lastSeenAt: string;
  /**
   * ADMIN tanlagan kassa. Kassir uchun YO'Q — uning kassasi ism bo'yicha
   * topiladi va tanlab bo'lmaydi (lib/staffBot/auth.ts).
   */
  cashboxId?: number;
  /**
   * Joriy menyu xabarining id'si — o'quvchilar botidagi bilan bir xil
   * sabab: tugma bosilganda BITTA xabar qayta chiziladi, yozishma o'nlab
   * eski menyu bilan to'lib ketmaydi.
   */
  menuMessageId?: number;
  draft?: Draft | null;
  /** Bot bloklangan (Telegram 403) — push xabarlar o'tkazib yuboriladi. */
  blocked?: boolean;
}

export async function getStaffUser(db: Db, chatId: number): Promise<StaffBotUser | null> {
  const row = await db.collection(STAFF_BOT_USERS).findOne({ chatId }, { projection: { _id: 0 } });
  return (row as StaffBotUser | null) ?? null;
}

interface TgIdentity {
  name: string;
  username: string;
}

/** Kirish boshlandi — telefon kutiladi. Eski kirish (bo'lsa) bekor bo'ladi. */
export async function startLogin(db: Db, chatId: number, tg: TgIdentity): Promise<void> {
  await db.collection(STAFF_BOT_USERS).updateOne(
    { chatId },
    {
      $set: {
        chatId,
        stage: "phone" satisfies LoginStage,
        tgName: tg.name,
        tgUsername: tg.username,
        lastSeenAt: uzStamp(),
        draft: null,
      },
      $unset: { pendingPhone: "", userId: "", employeeId: "", name: "", isAdmin: "", phone: "", loggedInAt: "", cashboxId: "", blocked: "" },
    },
    { upsert: true },
  );
}

/** Raqam qabul qilindi — endi parol kutiladi. */
export async function setPendingPhone(db: Db, chatId: number, phone: string): Promise<void> {
  await db.collection(STAFF_BOT_USERS).updateOne(
    { chatId },
    { $set: { stage: "password" satisfies LoginStage, pendingPhone: phone, lastSeenAt: uzStamp() } },
  );
}

export interface LoginIdentity {
  userId: string;
  employeeId: number | null;
  name: string;
  isAdmin: boolean;
  phone: string;
}

/** Parol to'g'ri — kirish yakunlandi. */
export async function completeLogin(db: Db, chatId: number, id: LoginIdentity): Promise<void> {
  await db.collection(STAFF_BOT_USERS).updateOne(
    { chatId },
    {
      $set: {
        stage: "in" satisfies LoginStage,
        userId: id.userId,
        employeeId: id.employeeId,
        name: id.name,
        isAdmin: id.isAdmin,
        phone: id.phone,
        loggedInAt: uzStamp(),
        lastSeenAt: uzStamp(),
        draft: null,
      },
      $unset: { pendingPhone: "", blocked: "" },
    },
  );
}

/** Chiqish — hujjat butunlay o'chiriladi (parol ham, qoralama ham qolmaydi). */
export async function logoutStaff(db: Db, chatId: number): Promise<void> {
  await db.collection(STAFF_BOT_USERS).deleteOne({ chatId });
}

export async function touchStaffUser(db: Db, chatId: number): Promise<void> {
  await db.collection(STAFF_BOT_USERS).updateOne({ chatId }, { $set: { lastSeenAt: uzStamp() } });
}

export async function setMenuMessage(db: Db, chatId: number, messageId: number): Promise<void> {
  await db.collection(STAFF_BOT_USERS).updateOne({ chatId }, { $set: { menuMessageId: messageId } });
}

export async function markBlocked(db: Db, chatId: number): Promise<void> {
  await db.collection(STAFF_BOT_USERS).updateOne({ chatId }, { $set: { blocked: true } });
}

/** Admin kassani almashtirdi. */
export async function setAdminCashbox(db: Db, chatId: number, cashboxId: number): Promise<void> {
  await db.collection(STAFF_BOT_USERS).updateOne({ chatId }, { $set: { cashboxId } });
}

export async function setDraft(db: Db, chatId: number, draft: Draft | null): Promise<void> {
  await db.collection(STAFF_BOT_USERS).updateOne(
    { chatId },
    { $set: { draft: draft ? { ...draft, updatedAt: Date.now() } : null } },
  );
}

/**
 * Qoralamani SAQLASHGA BAND QILADI — atom amal.
 *
 * Faqat kalit mos kelsa va qoralama hali `confirm` qadamida bo'lsa
 * o'tadi; o'sha zahoti `saving` ga o'tkaziladi. Ikkinchi (takror)
 * bosish shartga tushmaydi va `false` oladi — pul bir marta yoziladi.
 */
export async function claimDraftForSave(db: Db, chatId: number, nonce: string): Promise<KirimDraft | null> {
  const res = await db.collection(STAFF_BOT_USERS).findOneAndUpdate(
    { chatId, "draft.kind": "kirim", "draft.nonce": nonce, "draft.step": "confirm" },
    { $set: { "draft.step": "saving" satisfies KirimStep, "draft.updatedAt": Date.now() } },
    { returnDocument: "before", projection: { _id: 0, draft: 1 } },
  );
  return (res?.draft as KirimDraft | undefined) ?? null;
}

/** Saqlash yiqildi — qoralama tasdiq qadamiga qaytariladi, kassir qayta urinishi mumkin. */
export async function releaseDraft(db: Db, chatId: number, nonce: string): Promise<void> {
  await db.collection(STAFF_BOT_USERS).updateOne(
    { chatId, "draft.nonce": nonce, "draft.step": "saving" },
    { $set: { "draft.step": "confirm" satisfies KirimStep } },
  );
}

/** Qoralama tirikmi — bor va eskirmagan. */
export function liveDraft(user: StaffBotUser, now = Date.now()): Draft | null {
  const d = user.draft;
  if (!d) return null;
  return now - d.updatedAt > DRAFT_TTL_MS ? null : d;
}
