import type { Db } from "mongodb";
import type { AttendanceStatus } from "@/lib/attendance";
import { sendToStudent } from "@/lib/studentBot/api";
import { isStudentBotReady, loadStudentBotConfig, studentBotPushEnabled } from "@/lib/studentBot/config";
import type { Group } from "@/lib/groups";
import { logSms } from "@/lib/smsLog";
import { loadPupil } from "@/lib/studentBot/data";
import { currentPeriodMonth, linkedPupilsOwing } from "@/lib/studentBot/dues";
import { pupilFullName } from "@/lib/pupilsData";
import { chatsForPupil, markBlocked, type NotifyKind } from "@/lib/studentBot/users";
import * as V from "@/lib/studentBot/views";
import { uzNow } from "@/lib/uzTime";

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

/**
 * Bitta o'quvchiga bog'langan HAMMA chatga yuboradi (o'zi, onasi, otasi).
 *
 * `kind` faqat jurnal yozuvi uchun: xabarlarni o'chirib qo'yish
 * imkoniyati yo'q, ya'ni filtrlashga ishlatilmaydi.
 */
async function fanOut(db: Db, pupilId: number, kind: NotifyKind, html: string): Promise<number> {
  const cfg = loadStudentBotConfig();
  if (!isStudentBotReady(cfg)) return 0;

  const chats = await chatsForPupil(db, pupilId);
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

/**
 * GURUHGA QO'SHILGANDA xabar.
 *
 * CHAQIRUVCHI FAQAT HAQIQATAN QO'SHILGANDA chaqirishi kerak:
 * `$addToSet` allaqachon a'zo bo'lgan o'quvchida hech narsa
 * o'zgartirmaydi, lekin so'rov muvaffaqiyatli tugaydi — tekshirilmasa
 * xodim ro'yxatni har ochganda o'quvchiga bir xil xabar ketardi.
 */
export async function notifyGroupAdded(db: Db, pupilId: number, group: Group): Promise<void> {
  try {
    if (!studentBotPushEnabled()) return;
    const pupil = await loadPupil(db, pupilId);
    if (!pupil) return;
    await fanOut(db, pupilId, "group", V.groupAddedPush(pupil, group));
  } catch (e) {
    console.error("[student-bot] guruh xabari:", e instanceof Error ? e.message : e);
  }
}

/**
 * OY TO'LOVI ESLATMASI — bitta o'quvchiga.
 *
 * Chaqiruvchi kimga yuborishni O'ZI hal qiladi (`linkedPupilsOwing`);
 * bu funksiya faqat yuboradi. Shunda "kim qarzdor" mantig'i bitta
 * joyda (dues.ts) qoladi va sinash oson bo'ladi.
 */
export async function notifyDue(db: Db, pupilId: number, month: string): Promise<void> {
  try {
    if (!studentBotPushEnabled()) return;
    const pupil = await loadPupil(db, pupilId);
    if (!pupil) return;
    await fanOut(db, pupilId, "due", V.duePush(pupil, month));
  } catch (e) {
    console.error("[student-bot] to'lov eslatmasi:", e instanceof Error ? e.message : e);
  }
}

/** Eslatma yuboriladigan kunlar (Toshkent vaqti, oy kuni). */
const DUE_DAYS = [25];

/**
 * OYLIK ESLATMA YUGURISHI — kunlik cron chaqiradi.
 *
 * QAYSI KUNLARDA: oyning 25-kuni va OXIRGI kuni. Ataylab ikkitagina:
 * har kuni yuborilsa o'quvchi botni bloklardi va keyin davomat ham,
 * to'lov xabari ham unga yetmay qolardi — ya'ni ko'p eslatish
 * eslatmani butunlay yo'qotardi.
 *
 * Boshqa kunlarda hech narsa qilmaydi va buni AYTIB qaytadi, jim
 * emas: hisobotda "nega yuborilmadi" degan savol qolmasin.
 */
export async function runDueReminders(
  db: Db,
  now: Date = uzNow(),
): Promise<{ sent: number; skipped: string | null }> {
  // KUN TEKSHIRUVI BIRINCHI: u sof hisob va bazaga tegmaydi. Push
  // o'chiq bo'lsa ham jadval to'g'ri ishlayotganini shu tartibda
  // sinab ko'rish mumkin — hech kimga xabar yubormasdan.
  const day = now.getDate();
  const daysIn = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  if (!DUE_DAYS.includes(day) && day !== daysIn) {
    return { sent: 0, skipped: "bugun eslatma kuni emas" };
  }

  if (!studentBotPushEnabled()) return { sent: 0, skipped: "push o'chiq" };

  const month = currentPeriodMonth(now);
  const owing = await linkedPupilsOwing(db, now);
  for (const pupilId of owing) await notifyDue(db, pupilId, month);
  return { sent: owing.length, skipped: null };
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
  /** Jurnal yozuvi uchun — kim qabul qildi, qaysi kassada. */
  pupilName?: string;
  moderator?: string;
  cashboxId?: number;
  cashboxName?: string;
}

/** To'lov qabul qilinganda — o'quvchiga xabar. */
export async function notifyPayment(db: Db, notice: PaymentNotice): Promise<void> {
  try {
    if (!studentBotPushEnabled()) return;
    if (notice.pupilId === null) return;
    const pupil = await loadPupil(db, notice.pupilId);
    if (!pupil) return;
    const text = V.paymentPush(pupil, notice);
    const sent = await fanOut(db, notice.pupilId, "payment", text);

    // XABARLAR JURNALIGA yoziladi (Sotuv va marketing -> Xabarlar
    // ro'yhati). To'lov SMS i to'xtatilgach jurnal bo'shab qolardi va
    // "o'quvchi xabardor qilindimi?" degan savolga javob yo'qolardi.
    // Endi o'sha ro'yxatda kanal "Telegram bot" deb turadi, raqam esa
    // bo'sh — chunki xabar raqamga emas, chatga ketgan.
    await logSms(db, {
      channel: "telegram",
      recipientName: notice.pupilName || pupilFullName(pupil),
      phone: "",
      text,
      purpose: "payment",
      kind: "auto",
      moderator: notice.moderator ?? "",
      ...(notice.cashboxId !== undefined ? { cashboxId: notice.cashboxId } : {}),
      ...(notice.cashboxName ? { cashboxName: notice.cashboxName } : {}),
      // Botga ulanmagan o'quvchida hech qayerga bormaydi — buni
      // yashirmaymiz, aks holda jurnalda "yuborildi" deb turgan,
      // aslida hech kim ko'rmagan qatorlar paydo bo'lardi.
      result: sent > 0
        ? { ok: true }
        : { ok: false, error: "O'quvchi botga ulanmagan yoki botni bloklagan" },
    });
  } catch (e) {
    console.error("[student-bot] to'lov xabari:", e instanceof Error ? e.message : e);
  }
}
