import type { Db } from "mongodb";
import type { AttendanceMark, AttendanceParentSms } from "@/lib/attendance";
import { CENTER_NAME, CENTER_PHONE, CENTER_SHORT, IS_AKADEMIYA } from "@/lib/center";
import { eskizConfigured, sendSms, type SendSmsResult } from "@/lib/eskiz";
import type { Group } from "@/lib/groups";
import type { Pupil } from "@/lib/pupilsData";
import { pupilFullName } from "@/lib/pupilsData";
import { logSms } from "@/lib/smsLog";
import { fitAbsenceText, parentRecipients } from "@/lib/absenceSmsText";
import { toUz, uzDateIso } from "@/lib/uzTime";

// OTA-ONAGA «DARSGA KELMADI» SMS (27.11.2026, egasi): o'qituvchi davomatda
// o'quvchini «Sababsiz» (kelmadi) deb belgilasa — ota-onasiga Eskiz orqali SMS.
// FAQAT IKKINCHI MARKAZDA (egasi: «akademiya uchun ishlamaydigan»): Akademiya'da hech narsa qilmaydi.
//
// QANDAY ISHLAYDI:
//   1. lib/attendanceWrite.ts — belgi «sababsiz» ga O'TGAN lahzani yozadi
//      (`attendance.absentAt`, markAbsentAt). Guruh sahifasi, xodimlar boti va AI —
//      hammasi o'sha funksiyadan o'tadi.
//   2. Har daqiqalik cron (deploy/cron-lessons.sh → /api/sync/cron?only=lessons)
//      runAbsenceSms ni chaqiradi: belgi GRACE_MIN daqiqa «sababsiz» bo'lib tursa
//      (o'qituvchi xato bosib, darrov tuzatsa SMS ketmasin) — yuboradi.
//   3. Bitta belgiga bitta marta: natija `attendance.parentSms` ga yoziladi va
//      yozuv atomik «egallanadi» — ikki cron bir vaqtda ikki marta yubormaydi;
//      «sababsiz → keldi → sababsiz» qayta SMS yubormaydi.
//
// Kimga: ota va onaning raqami (ikkalasi ham, raqami bir xil bo'lsa bitta).
// Qachon: faqat bugungi va kechagi dars (eski davomatni tuzatish ota-onaga SMS
// yog'dirmasin), tunda (21:00–08:00 Toshkent) yuborilmaydi — ertalab ketadi.

/**
 * MARKAZ TELEFONI — SMS oxiridagi {#markaz_raqam#}. O'ZGARTIRISH: shu qatorga raqam
 * yozib qayta deploy («+998901234567» yoki «90 123 45 67» — bo'shliqlar olib tashlanadi).
 * Bo'sh bo'lsa — NEXT_PUBLIC_CENTER_PHONE; u ham bo'sh bo'lsa SMS YUBORILMAYDI
 * (shablon raqamsiz matnni Eskiz rad etadi) — belgilar kutib turadi (runAbsenceSms).
 */
export const MARKAZ_RAQAM = "+998 50 017 90 12";

/** Xato belgini tuzatishga vaqt — shuncha daqiqa «sababsiz» bo'lib tursa SMS ketadi. */
const GRACE_MIN = 5;
/** Tunda yuborilmaydi (Toshkent soati): [QUIET_FROM, 24) va [0, QUIET_TO). */
const QUIET_FROM = 21;
const QUIET_TO = 8;
/** Bir cron aylanishida ko'pi bilan shuncha belgi (qolgani keyingi daqiqada). */
const BATCH = 40;

export function absenceSmsCenterPhone(): string {
  return (MARKAZ_RAQAM || CENTER_PHONE).replace(/\s/g, "");
}

/**
 * Yoqilganmi. Akademiya'da — hech qachon (NEXT_PUBLIC_CENTER_ID, build'da); favqulodda
 * o'chirish — serverda `ABSENCE_SMS=off` (.env.local, keyin pm2 reload), qayta deploysiz.
 */
export function absenceSmsActive(): boolean {
  if (IS_AKADEMIYA) return false;
  return (process.env.ABSENCE_SMS ?? "").trim().toLowerCase() !== "off";
}

/**
 * Belgi «sababsiz» ga O'TGAN lahzani yozadi (lib/attendanceWrite.ts chaqiradi).
 * Hech qachon otmaydi — davomat allaqachon saqlangan.
 */
export async function markAbsentAt(db: Db, key: { groupId: number; pupilId: number; date: string }): Promise<void> {
  if (!absenceSmsActive()) return;
  try {
    await db.collection("attendance").updateOne(key, { $set: { absentAt: new Date() } });
  } catch (e) {
    console.error("[absence-sms] absentAt yozilmadi:", e instanceof Error ? e.message : e);
  }
}

function addDaysIso(iso: string, days: number): string {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

type MarkDoc = AttendanceMark & { _id: unknown; absentAt?: Date };

/**
 * Asosiy akkaunt → rad etsa (shablon shu akkauntda tasdiqlanmagan: 400/401/403) zaxira akkaunt
 * (ESKIZ_FALLBACK_*), lib/invite.ts sendCenterSms bilan bir qoida. Shunda shablon qaysi
 * akkauntda tasdiqlansa ham SMS ketadi. Tarmoq xatosi / 5xx da qayta yuborilmaydi — SMS
 * ketgan bo'lishi mumkin, ota-onaga ikki SMS bormasin.
 */
async function sendAbsenceSms(phone: string, text: string): Promise<SendSmsResult> {
  const first = await sendSms(phone, text);
  const rejected = !first.ok && (first.status === 400 || first.status === 401 || first.status === 403 || String(first.error ?? "").startsWith("Eskiz login xato"));
  if (!rejected || !eskizConfigured("fallback")) return first;
  const second = await sendSms(phone, text, "fallback");
  if (second.ok) return { ...second, fallback: true };
  return { ...second, error: `asosiy: ${first.error ?? "-"}; zaxira: ${second.error ?? "-"}` };
}

/** Bitta belgi uchun SMS — natijani qaytaradi, hech qachon otmaydi. */
async function sendForMark(db: Db, m: MarkDoc): Promise<AttendanceParentSms> {
  const at = new Date().toISOString();
  const phone = absenceSmsCenterPhone();
  const pupil = await db.collection<Pupil>("pupils").findOne({ id: m.pupilId }, { projection: { _id: 0 } });
  if (!pupil) return { state: "no_pupil", at, tried: 0, accepted: 0 };
  const recipients = parentRecipients(pupil);
  if (recipients.length === 0) return { state: "no_phone", at, tried: 0, accepted: 0 };
  const group = await db.collection<Group>("groups").findOne({ id: m.groupId }, { projection: { _id: 0, id: 1, name: 1, course: 1 } });
  const subject = (group?.course || "").trim() || (group?.name ? `${group.name}-guruh` : "");

  let accepted = 0;
  let simulated = 0;
  let parts = 1;
  for (const r of recipients) {
    const msg = fitAbsenceText({
      parentName: r.name,
      pupilFirstName: pupil.firstName,
      pupilLastName: pupil.lastName,
      date: m.date,
      subject,
      centerName: CENTER_NAME,
      centerShort: CENTER_SHORT,
      centerPhone: phone,
    });
    parts = Math.max(parts, msg.size.parts);
    let res: SendSmsResult;
    try {
      res = await sendAbsenceSms(r.phone, msg.text);
    } catch (e) {
      res = { ok: false, error: e instanceof Error ? e.message : String(e) };
    }
    if (res.ok) accepted++;
    if (res.simulated) simulated++;
    const who = r.kind === "Ota" ? "otasi" : r.kind === "Ona" ? "onasi" : "ota-onasi";
    await logSms(db, {
      recipientName: `${r.name || "Ota-ona"} (${pupilFullName(pupil)} ${who})`,
      phone: r.phone,
      text: msg.text,
      purpose: "attendance",
      kind: "auto",
      moderator: "",
      result: res,
    });
  }
  const state: AttendanceParentSms["state"] =
    accepted === 0 ? "failed" : simulated === recipients.length ? "simulated" : "sent";
  return { state, at, tried: recipients.length, accepted, parts };
}

export interface AbsenceSmsReport {
  active: boolean;
  /** Tungi vaqt — yuborilmadi. */
  quiet?: boolean;
  /** MARKAZ_RAQAM ham, NEXT_PUBLIC_CENTER_PHONE ham bo'sh — yuborilmadi. */
  noCenterPhone?: boolean;
  checked: number;
  sent: number;
  skipped: number;
}

/**
 * CRON (har daqiqada): muddati kelgan «sababsiz» belgilarga SMS. Hech qachon
 * otmaydi — xato bitta belgida qoladi, qolganlari davom etadi.
 */
export async function runAbsenceSms(db: Db, nowMs: number = Date.now()): Promise<AbsenceSmsReport> {
  const report: AbsenceSmsReport = { active: absenceSmsActive(), checked: 0, sent: 0, skipped: 0 };
  if (!report.active) return report;
  const now = new Date(nowMs);
  const hour = toUz(now).getHours();
  if (hour >= QUIET_FROM || hour < QUIET_TO) return { ...report, quiet: true };
  // Markaz raqami yo'q — belgilarga TEGILMAYDI (kutib turadi): raqam qo'yilib deploy
  // qilingach bugungi/kechagi belgilar o'z-o'zidan ketadi.
  if (!absenceSmsCenterPhone()) return { ...report, noCenterPhone: true };

  const today = uzDateIso(now);
  const col = db.collection<MarkDoc>("attendance");
  const due = await col
    .find({
      status: "sababsiz",
      absentAt: { $gte: new Date(nowMs - 2 * 86_400_000), $lte: new Date(nowMs - GRACE_MIN * 60_000) },
      parentSms: { $exists: false },
      date: { $gte: addDaysIso(today, -1), $lte: today },
    })
    .limit(BATCH)
    .toArray();

  for (const m of due) {
    report.checked++;
    try {
      // Atomik egallash: shu belgi hali «sababsiz» va hali hech kim olmagan bo'lsa.
      const claimed = await col.findOneAndUpdate(
        { _id: m._id, status: "sababsiz", parentSms: { $exists: false } } as never,
        { $set: { parentSms: { state: "sending", at: new Date().toISOString(), tried: 0, accepted: 0 } } },
      );
      if (!claimed) continue;
      const out = await sendForMark(db, m);
      await col.updateOne({ _id: m._id } as never, { $set: { parentSms: out } });
      if (out.accepted > 0) report.sent++;
      else report.skipped++;
    } catch (e) {
      report.skipped++;
      console.error("[absence-sms]", { groupId: m.groupId, pupilId: m.pupilId, date: m.date }, e instanceof Error ? e.message : e);
    }
  }
  return report;
}
