import type { Db } from "mongodb";
import type { AdjustDeps } from "@/lib/cashboxAdjust";
import { parseScanned } from "@/lib/attendanceQr";
import { isTokenShape } from "@/lib/gamification/access";
import { hasWebLogin } from "@/lib/staffBot/auth";
import { isStaffBotReady, loadStaffBotConfig, STAFF_START_PARAM } from "@/lib/staffBot/config";
import { isStaffCallback } from "@/lib/staffBot/keyboards";
import { handleStaffUpdate } from "@/lib/staffBot/router";
import { getStaffUser } from "@/lib/staffBot/session";
import { loadStudentBotConfig } from "@/lib/studentBot/config";
import { phoneKey } from "@/lib/studentBot/phone";
import { handleStudentUpdate, type TelegramUpdate } from "@/lib/studentBot/router";
import { getBotUser } from "@/lib/studentBot/users";

// @tizimli_akademiya_bot — BITTA BOTDA IKKI OQIM (29.09.2026).
//
// Foydalanuvchi: "tizimli_akademiya botida xodimlar ishlashi kerak,
// crm_akademiya botimiz faqat to'lovlarni guruhga yozadi". Shu kundan
// o'quvchi/ota-ona (lib/studentBot) va xodim (lib/staffBot) bitta botda.
// Har yangilanish shu yerda BIR tomonga beriladi; routerlarning o'zi
// o'zgarmagan, har biri o'z sessiyasini (`student_bot_users`,
// `staff_bot_users`, ikkalasida ham kalit — `chatId`) o'zi yuritadi.
//
// QOIDA (tartib muhim):
//   1. Tugma — prefiks bo'yicha: `s:` xodimniki (lib/staffBot/keyboards.ts),
//      qolgani o'quvchiniki. Prefikslar to'qnashmaydi.
//   2. Havola/buyruq — aniq niyat: `/start k_…|x_…` (QR), `/start xodim`,
//      `/xodim` → xodim; `/start <shaxsiy havola tokeni>` → o'quvchi.
//   3. Kirgan (yoki parol kutilayotgan) xodim → xodim.
//   4. Raqam (tugma yoki qo'lda): yangi odam, yoki xodim kirishini
//      boshlagan (`/xodim`, QR) odam — raqam xodimniki bo'lsa (faol xodim
//      yoki CRM paroli bor hisob) xodim, aks holda o'quvchi. O'quvchilarda
//      sayt hisobi yo'q (users — faqat xodimlar), ya'ni ota-ona adashib
//      xodim oqimiga tushmaydi.
//   5. Bog'langan o'quvchi/ota-ona → o'quvchi.
//   6. Qolgani: xodim kirishni boshlagan bo'lsa — xodim, aks holda umumiy
//      salom (o'quvchilar routeri; matnda xodimlarga ham yo'l aytilgan).
//
// Xodim ham, ota-ona ham bo'lgan odam (29.09 da 53 xodim raqamidan 21 tasi
// o'quvchi yozuvida ham bor) — XODIM ustun: raqamni o'zi tasdiqlagan.
// O'quvchi sifatida bog'langan xodim `/xodim` bilan xodimlar bo'limiga o'tadi.

export type BotSide = "staff" | "student";

const START_ARG = /^\/start(?:@\w+)?\s+(\S+)$/i;
const STAFF_COMMAND = /^\/xodim(?:@\w+)?$/i;

/**
 * Raqam xodimnikimi: faol xodimlar ro'yxatida bor yoki CRM paroli bor sayt
 * hisobi. Ikki xodimda bir xil raqam bo'lsa ham xodim tomoni — u yerda
 * "topilmadi" sababi aytiladi (o'quvchi oqimi uni o'quvchi deb qidirib
 * o'tirmasin).
 */
async function isStaffPhone(db: Db, raw: string): Promise<boolean> {
  const key = phoneKey(raw);
  if (!key) return false;
  const emps = await db
    .collection("hr_employees")
    .find({ archReason: { $in: ["", null] } }, { projection: { _id: 0, phone: 1 } })
    .toArray();
  if (emps.some((e) => phoneKey(e.phone) === key)) return true;
  return hasWebLogin(db, raw);
}

/** Yangilanish qaysi routerga — `null`: hech biriga (guruh, tahrirlangan xabar …). */
export async function pickSide(db: Db, update: TelegramUpdate): Promise<BotSide | null> {
  const cq = update.callback_query;
  if (cq) return isStaffCallback(cq.data) ? "staff" : "student";

  // `edited_message` ATAYLAB e'tiborsiz — ikkala router ham shunday.
  const msg = update.message;
  if (!msg || !msg.from) return null;
  // Guruhda jim (ikkala router ham tashlaydi — bu yerda bazaga ham borilmaydi).
  if (msg.chat?.type && msg.chat.type !== "private") return null;
  const chatId = msg.chat?.id;
  if (chatId === undefined) return null;
  const text = (msg.text || "").trim();

  // 2) Havola / buyruq.
  const arg = START_ARG.exec(text)?.[1];
  if (arg) {
    if (arg === STAFF_START_PARAM || parseScanned(arg)) return "staff";
    if (isTokenShape(arg)) return "student";
    // Tanilmagan parametr — oddiy /start kabi, pastdagi qoidalar bilan.
  }
  if (STAFF_COMMAND.test(text)) return "staff";

  // 3) Xodim sessiyasi.
  const staff = await getStaffUser(db, chatId);
  if (staff && staff.stage !== "phone") return "staff";
  const staffStarted = staff?.stage === "phone";

  // 4) Raqam — yangi odam yoki xodim kirishini boshlagan odam.
  const typed = !msg.contact && text && !text.startsWith("/") ? phoneKey(text) : null;
  if (msg.contact || typed) {
    const student = await getBotUser(db, chatId);
    if (!student || staffStarted) {
      // Begona kontakt — ikkala router ham rad etadi; matn kirish boshlangan tomondan.
      if (msg.contact && msg.contact.user_id !== msg.from.id) return staffStarted ? "staff" : "student";
      const raw = msg.contact ? String(msg.contact.phone_number ?? "") : text;
      return (await isStaffPhone(db, raw)) ? "staff" : "student";
    }
    return "student";
  }

  // 5) Bog'langan o'quvchi/ota-ona.
  if (await getBotUser(db, chatId)) return "student";

  // 6) Qolgani.
  return staffStarted ? "staff" : "student";
}

/**
 * Bitta yangilanishni tegishli routerga beradi. HECH QACHON OTMAYDI —
 * webhook Telegram'ga doim 200 qaytaradi (routerlarning o'zi ham otmaydi).
 */
export async function dispatchBotUpdate(db: Db, update: TelegramUpdate, defer: AdjustDeps["defer"]): Promise<void> {
  try {
    const side = await pickSide(db, update);
    if (side === "staff") {
      const cfg = loadStaffBotConfig();
      if (isStaffBotReady(cfg)) await handleStaffUpdate(db, cfg, update, defer);
    } else if (side === "student") {
      await handleStudentUpdate(db, loadStudentBotConfig(), update);
    }
  } catch (e) {
    console.error("[bot-dispatch]", e instanceof Error ? e.stack || e.message : e);
  }
}
