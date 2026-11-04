import type { Db } from "mongodb";
import { cleanSurveyName } from "@/lib/survey";
import { dropReplyKeyboard, editStudentMenu, sendToStudent } from "@/lib/studentBot/api";
import { clearPhoneAttempts, takePhoneAttempt } from "@/lib/studentBot/attempts";
import type { StudentBotConfig } from "@/lib/studentBot/config";
import { PARENT_BUTTON, PARENT_CANCEL_CB, PARENT_START_CB, parentCancel } from "@/lib/studentBot/keyboards";
import { phoneKey } from "@/lib/studentBot/phone";
import { findPupilsByNameAndPhone, isFullName } from "@/lib/studentBot/pupilMatch";
import { addBotLinks, getBotUser, type StudentBotUser } from "@/lib/studentBot/users";
import * as V from "@/lib/studentBot/views";

// 👪 OTA-ONA KIRISHI — farzandini ism familiyasi va telefon raqami bilan ulash
// (04.11.2026, Temuriylar).
//
// Foydalanuvchi: «farzandini ism familiyasini telefon raqamini kiritsa shu
// o'quvchini ma'lumotlarini davomatini ko'rib turishi kerak ota-onasi».
//
// NEGA RAQAM BILAN KIRISH YETMAYDI. Telefon bilan kirish odamning O'Z raqamini
// kartadan qidiradi, kartalarda esa ota-ona raqami deyarli yo'q (Temuriylar: 449
// kartaning hech birida `fatherPhone`/`motherPhone` to'ldirilmagan). Bu yo'lda raqam
// kartadagi istalgan maydonda bo'lishi mumkin va ism bilan birga tekshiriladi.
//
// XAVFSIZLIK. Oddiy qo'lda raqam yozishdan qattiqroq: ism ham to'g'ri bo'lishi
// shart. Urinishlar qorovuli qo'lda raqam yozish bilan BITTA (lib/studentBot/attempts.ts).
// Javobda ism yoki raqamdan qaysi biri xato ekani aytilmaydi.
//
// HOLAT — `student_bot_parent_forms`: bitta suhbatga bitta hujjat, 30 daqiqada
// Mongo o'zi o'chiradi. Forma ochiq paytdagi raqam lib/botDispatch.ts da xodimniki
// deb tekshirilmaydi — bu kirish emas, farzand raqami.
//
// TUGMALAR: ot:go — boshlash, ot:x — bekor qilish (lib/studentBot/keyboards.ts).

export const PARENT_FORMS = "student_bot_parent_forms";
const FORM_TTL_MS = 30 * 60_000;

export interface ParentForm {
  chatId: number;
  step: "ism" | "tel";
  /** Birinchi qadamdagi javob — odam yozganidek. */
  name?: string;
  expireAt: Date;
}

export interface ParentFormCtx {
  db: Db;
  cfg: StudentBotConfig;
  chatId: number;
  tg: { name: string; username: string };
}

const col = (db: Db) => db.collection(PARENT_FORMS);
const expiry = () => new Date(Date.now() + FORM_TTL_MS);

const PARENT_CMD = /^\/otaona(?:@\w+)?$/i;
const PARENT_LINK = /^\/start(?:@\w+)?\s+otaona$/i;

/** Formani boshlaydigan xabar: pastki tugma, `/otaona` yoki `t.me/<bot>?start=otaona`. */
export function isParentStartText(text: string): boolean {
  const t = text.trim();
  return t === PARENT_BUTTON || PARENT_CMD.test(t) || PARENT_LINK.test(t);
}

export function isParentCallback(data: string): boolean {
  return data === PARENT_START_CB || data === PARENT_CANCEL_CB;
}

export async function getParentForm(db: Db, chatId: number): Promise<ParentForm | null> {
  return ((await col(db).findOne({ chatId }, { projection: { _id: 0 } })) as ParentForm | null) ?? null;
}

/** Forma ochiqmi — lib/botDispatch.ts javobni (raqam bo'lsa ham) o'quvchilar routeriga beradi. */
export async function hasActiveParentForm(db: Db, chatId: number): Promise<boolean> {
  return !!(await col(db).findOne({ chatId }, { projection: { _id: 1 } }));
}

export async function closeParentForm(db: Db, chatId: number): Promise<void> {
  await col(db).deleteOne({ chatId });
}

async function ask(ctx: ParentFormCtx, html: string, editId?: number): Promise<void> {
  if (editId !== undefined && (await editStudentMenu(ctx.cfg, ctx.chatId, editId, html, parentCancel()))) return;
  await sendToStudent(ctx.cfg, ctx.chatId, html, parentCancel());
}

/** Formani boshidan ochadi. `editId` — tugma bosilgan xabar (menyu joyida ochiladi). */
export async function startParentForm(ctx: ParentFormCtx, editId?: number): Promise<void> {
  await col(ctx.db).updateOne(
    { chatId: ctx.chatId },
    { $set: { step: "ism", expireAt: expiry() }, $unset: { name: "" } },
    { upsert: true },
  );
  await ask(ctx, V.parentNamePrompt(), editId);
}

/**
 * Forma ochiq paytdagi javob (matn yoki kontakt raqami). Bola ulangan bo'lsa
 * yangilangan bog'lanish qaytadi — bosh ekranni router ko'rsatadi; `null`:
 * forma davom etmoqda, odamga javob shu yerda berilgan.
 */
export async function answerParentForm(ctx: ParentFormCtx, form: ParentForm, raw: string): Promise<StudentBotUser | null> {
  const { db, cfg, chatId } = ctx;
  const text = raw.trim();

  if (form.step === "ism") {
    const name = cleanSurveyName(text);
    if (!name || !isFullName(name)) {
      await ask(ctx, V.parentNamePrompt("Ism va familiyani birga yozing."));
      return null;
    }
    await col(db).updateOne({ chatId }, { $set: { step: "tel", name, expireAt: expiry() } });
    await ask(ctx, V.parentPhonePrompt(name));
    return null;
  }

  const name = form.name ?? "";
  const key = phoneKey(text);
  if (!key) {
    await ask(ctx, V.parentPhonePrompt(name, "Raqamni to'liq yozing, masalan: 90 123 45 67"));
    return null;
  }

  // Qorovul QIDIRUVDAN OLDIN — lib/studentBot/router.ts → handlePhoneText bilan bir xil sabab.
  const gate = await takePhoneAttempt(db, chatId);
  if (!gate.allowed) {
    await closeParentForm(db, chatId);
    await sendToStudent(cfg, chatId, V.parentTooMany(gate.waitMinutes));
    return null;
  }

  const found = await findPupilsByNameAndPhone(db, name, key);
  if (found.length === 0) {
    await col(db).updateOne({ chatId }, { $set: { step: "ism", expireAt: expiry() }, $unset: { name: "" } });
    await ask(ctx, V.parentNotFound());
    return null;
  }

  const wasLinked = !!(await getBotUser(db, chatId));
  // Rol doim "parent": raqam kartaning `phone` maydonida bo'lsa ham odam o'zini ota-ona dedi.
  const user = await addBotLinks(db, chatId, key, found.map((m) => ({ pupilId: m.pupilId, role: "parent" as const })), ctx.tg);
  await closeParentForm(db, chatId);
  await clearPhoneAttempts(db, chatId);
  // Hali bog'lanmagan odamda pastda telefon tugmasi turgan bo'ladi.
  if (!wasLinked) await dropReplyKeyboard(cfg, chatId);
  return user;
}
