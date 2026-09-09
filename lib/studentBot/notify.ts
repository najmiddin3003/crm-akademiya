import type { Db } from "mongodb";
import type { AttendanceStatus } from "@/lib/attendance";
import { sendToStudent } from "@/lib/studentBot/api";
import { isStudentBotReady, loadStudentBotConfig, studentBotPushEnabled } from "@/lib/studentBot/config";
import { loadPupil } from "@/lib/studentBot/data";
import { chatsForPupil, markBlocked, type NotifyKind } from "@/lib/studentBot/users";
import * as V from "@/lib/studentBot/views";

// AVTOMATIK XABARLAR — davomat belgilanganda va to'lov kelganda
// o'quvchiga (va unga bog'langan ota-onaga) darhol xabar boradi.
//
// UCHTA QAT'IY QOIDA:
//
// 1. HECH QACHON OTMAYDI. Bu funksiyalar CRM'ning asosiy amallaridan
//    keyin chaqiriladi — davomat allaqachon bazaga yozilgan, pul
//    allaqachon kassaga tushgan. Bu yerdan otilgan xato o'sha amalni
//    "muvaffaqiyatsiz" ko'rsatib qo'yardi, holbuki u tugagan.
//
// 2. `after()` ICHIDA CHAQIRILADI (Next.js `next/server`). Ya'ni javob
//    foydalanuvchiga YUBORILGANDAN KEYIN ishlaydi: Telegram sekin javob
//    bersa ham davomat jadvali yoki kassa oynasi kutib turmaydi.
//
// 3. SUKUT BO'YICHA O'CHIQ. `STUDENT_BOT_PUSH_ENABLED` qo'yilmaguncha
//    hech narsa yuborilmaydi — bot ishga tushgan zahoti minglab
//    o'quvchiga xabar yog'ilib ketmasin (lib/studentBot/config.ts).

/** Bitta o'quvchiga bog'langan HAMMA chatga yuboradi (o'zi, onasi, otasi). */
async function fanOut(db: Db, pupilId: number, kind: NotifyKind, html: string): Promise<number> {
  const cfg = loadStudentBotConfig();
  if (!isStudentBotReady(cfg)) return 0;

  const chats = await chatsForPupil(db, pupilId, kind);
  let sent = 0;
  for (const chatId of chats) {
    const res = await sendToStudent(cfg, chatId, html);
    if (res.ok) {
      sent++;
    } else if (res.blocked) {
      // Bloklagan odamga har davomatda qayta urinish bekorga so'rov.
      await markBlocked(db, chatId);
    } else {
      console.error(`[student-bot] push (${kind}, chat ${chatId}):`, res.error);
    }
  }
  return sent;
}

export interface AttendanceNotice {
  pupilId: number;
  /** "YYYY-MM-DD" */
  date: string;
  status: AttendanceStatus;
  grade: number | null;
  reason: string | null;
  groupName: string;
}

/** Davomat belgilanganda — o'quvchiga xabar. */
export async function notifyAttendance(db: Db, notice: AttendanceNotice): Promise<void> {
  try {
    if (!studentBotPushEnabled()) return;
    const pupil = await loadPupil(db, notice.pupilId);
    if (!pupil) return;
    await fanOut(db, notice.pupilId, "attendance", V.attendancePush(pupil, notice));
  } catch (e) {
    console.error("[student-bot] davomat xabari:", e instanceof Error ? e.message : e);
  }
}

export interface PaymentNotice {
  /**
   * O'quvchi id'si. `null` bo'lsa XABAR YUBORILMAYDI.
   *
   * NEGA ISM BO'YICHA QIDIRILMAYDI: bazada 511 ta ism takrorlanadi
   * (lib/legacyEntries.ts da o'lchangan). Ism bo'yicha topilgan
   * "o'quvchi" begona odam bo'lib chiqishi va unga boshqa birovning
   * to'lovi haqida xabar ketishi mumkin edi. Jim qolish — noto'g'ri
   * odamga pul haqida xabar yuborishdan yaxshiroq.
   */
  pupilId: number | null;
  amount: number;
  method: string;
  /** "YYYY-MM-DD" */
  date: string;
}

/** To'lov qabul qilinganda — o'quvchiga xabar. */
export async function notifyPayment(db: Db, notice: PaymentNotice): Promise<void> {
  try {
    if (!studentBotPushEnabled()) return;
    if (notice.pupilId === null) return;
    const pupil = await loadPupil(db, notice.pupilId);
    if (!pupil) return;
    await fanOut(db, notice.pupilId, "payment", V.paymentPush(pupil, notice));
  } catch (e) {
    console.error("[student-bot] to'lov xabari:", e instanceof Error ? e.message : e);
  }
}
