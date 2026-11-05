import type { Db } from "mongodb";
import { QR_SOURCE } from "@/lib/attendanceCheck";
import { loadAttendanceSettings } from "@/lib/attendanceQr";
import { branchNames, normName } from "@/lib/gamification/scope";
import { sendToStaff } from "@/lib/staffBot/api";
import { resolveAccess } from "@/lib/staffBot/auth";
import { isStaffBotReady, loadStaffBotConfig, type StaffBotConfig } from "@/lib/staffBot/config";
import { checkinKeyboard, lessonPushKeyboard } from "@/lib/staffBot/keyboards";
import { markBlocked, STAFF_BOT_USERS, type StaffBotUser } from "@/lib/staffBot/session";
import * as V from "@/lib/staffBot/views";
import { telegramMuted, type InlineKeyboard } from "@/lib/telegramApi";
import { describeLesson, LESSON_GROUP_FIELDS, lessonsStartingSoon, uzClock, type LessonGroup, type UzClock } from "@/lib/teacherLessons";

// XODIMLAR BOTI — KUNLIK ESLATMALAR (05.11.2026). Egasi: «har kuni soat 8:00 da
// bot davomat habarnomasini eslatsin va habar pastida tugmada ishga keldim shu
// tugmalar chiqsin va o'qituvchiga biriktirilgan guruhni dars vaqt boshlanishidan
// 10 daqiqa oldin bot habar yuborsin davomatni boshlang deb».
//
//   08:00 — botga kirgan HAMMA xodimga, har kuni. Shu kuni ishga kelganini
//           belgilagan bo'lsa yozilmaydi.
//   −10 daqiqa — guruh ustoziga (ism bo'yicha, ismdoshlarning ikkalasiga ham).
//
// HAR DAQIQADA yuradi: /api/sync/cron?only=lessons (deploy/cron-lessons.sh),
// topshiriqlarning 10 daqiqalik cron'i bunday aniqlikka yetmaydi. Shu bois ish
// yengil: odatiy daqiqada aktiv guruhlardan bitta so'rov.
//
// BIR MARTA: `staff_bot_reminders._id` — «tur:kun:…:chat». Yuborishdan OLDIN
// yoziladi (ikkinchi nusxa ham, kechikkan cron ham qayta yubormaydi), Telegram
// vaqtincha yiqilsa o'chiriladi — keyingi daqiqada qayta uriniladi. Ertalabgi
// oyna 2 soat: server shu payt o'chiq bo'lsa eslatma yo'qolmasin.
//
// `telegramMuted()` bo'lsa (Vercel, sinov) hech narsa yozilmaydi.

export const STAFF_BOT_REMINDERS = "staff_bot_reminders";

const MORNING_FROM_MIN = 8 * 60;
const MORNING_TO_MIN = 10 * 60;

type ReminderReason = "sent" | "blocked" | "checked_in" | "no_access";

interface ReminderDoc {
  _id: string;
  kind: "checkin" | "lesson";
  day: string;
  chatId: number;
  groupId?: number;
  at: Date;
  sent: boolean;
  reason: ReminderReason | null;
}

interface Tally {
  sent: number;
  blocked: number;
  failed: number;
  skipped: number;
}

export interface DayRemindersReport {
  skipped?: "muted" | "no_bot" | "busy";
  checkin: Tally;
  lessons: Tally;
}

const tally = (): Tally => ({ sent: 0, blocked: 0, failed: 0, skipped: 0 });
const reminders = (db: Db) => db.collection<ReminderDoc>(STAFF_BOT_REMINDERS);
type Claim = Pick<ReminderDoc, "_id" | "kind" | "day" | "chatId" | "groupId">;

/** Shu kalitlardan allaqachon ishlanganlari. */
async function handledKeys(db: Db, keys: string[]): Promise<Set<string>> {
  const rows = await reminders(db).find({ _id: { $in: keys } }, { projection: { _id: 1 } }).toArray();
  return new Set(rows.map((r) => r._id));
}

/** Eslatma egallanadi; boshqa nusxa ulgurgan bo'lsa `false`. */
async function claim(db: Db, c: Claim, reason: ReminderReason | null): Promise<boolean> {
  try {
    await reminders(db).insertOne({ ...c, at: new Date(), sent: false, reason });
    return true;
  } catch (e) {
    if ((e as { code?: number } | null)?.code === 11000) return false;
    throw e;
  }
}

/** Egallaydi va yuboradi. Natija shu yozuvda qoladi. */
async function deliver(db: Db, cfg: StaffBotConfig, c: Claim, html: string, keyboard: InlineKeyboard, out: Tally): Promise<void> {
  if (!(await claim(db, c, null))) return;
  const col = reminders(db);
  let error: unknown;
  try {
    const res = await sendToStaff(cfg, c.chatId, html, keyboard);
    if (res.ok) {
      await col.updateOne({ _id: c._id }, { $set: { sent: true, reason: "sent" } });
      out.sent += 1;
      return;
    }
    if (res.blocked) {
      await col.updateOne({ _id: c._id }, { $set: { reason: "blocked" } });
      await markBlocked(db, c.chatId);
      out.blocked += 1;
      return;
    }
    error = res.error;
  } catch (e) {
    error = e instanceof Error ? e.message : e;
  }
  // Vaqtinchalik xato — egallash bo'shatiladi, keyingi daqiqada qayta uriniladi.
  await col.deleteOne({ _id: c._id });
  out.failed += 1;
  console.error(`[staff-bot] eslatma ketmadi (${c._id}):`, error);
}

/** Sababi bilan o'tkazib yuboriladi — bugun qayta tekshirilmasin. */
async function skip(db: Db, c: Claim, reason: ReminderReason, out: Tally): Promise<void> {
  if (await claim(db, c, reason)) out.skipped += 1;
}

async function sendCheckinReminders(db: Db, cfg: StaffBotConfig, clock: UzClock, out: Tally): Promise<void> {
  if (clock.nowMin < MORNING_FROM_MIN || clock.nowMin >= MORNING_TO_MIN) return;
  const keyOf = (chatId: number) => `checkin:${clock.iso}:${chatId}`;
  const users = await db.collection<StaffBotUser>(STAFF_BOT_USERS).find({ stage: "in", blocked: { $ne: true } }).toArray();
  if (!users.length) return;
  const handled = await handledKeys(db, users.map((u) => keyOf(u.chatId)));
  const todo = users.filter((u) => !handled.has(keyOf(u.chatId)));
  if (!todo.length) return;

  const { checkoutEnabled } = await loadAttendanceSettings(db);
  for (const user of todo) {
    const c: Claim = { _id: keyOf(user.chatId), kind: "checkin", day: clock.iso, chatId: user.chatId };
    const access = await resolveAccess(db, user);
    const employeeId = access.ok ? access.access.identity.employeeId : null;
    // «Ishga keldim» xodim profilisiz ishlamaydi (app/api/xodim/davomat).
    if (!access.ok || employeeId === null) {
      await skip(db, c, "no_access", out);
      continue;
    }
    const came = await db
      .collection("turnstile_io")
      .findOne({ source: QR_SOURCE, date: clock.iso, employeeId, enterTime: { $nin: [null, ""] } }, { projection: { _id: 1 } });
    if (came) {
      await skip(db, c, "checked_in", out);
      continue;
    }
    await deliver(db, cfg, c, V.checkinReminderPush(access.access.identity.name), checkinKeyboard(checkoutEnabled), out);
  }
}

async function sendLessonReminders(db: Db, cfg: StaffBotConfig, clock: UzClock, out: Tally): Promise<void> {
  const active = await db.collection<LessonGroup>("groups").find({ status: "active" }, { projection: LESSON_GROUP_FIELDS }).toArray();
  const soon = lessonsStartingSoon(active, clock);
  if (!soon.length) return;

  const [employees, branches] = await Promise.all([
    db.collection("hr_employees").find({}, { projection: { _id: 0, id: 1, name: 1 } }).toArray(),
    branchNames(db),
  ]);
  for (const g of soon) {
    const teacher = normName(g.teacher);
    const owners = teacher ? employees.filter((e) => normName(e.name) === teacher).map((e) => Number(e.id)) : [];
    if (!owners.length) continue;
    const keyOf = (chatId: number) => `lesson:${clock.iso}:${g.id}:${chatId}`;
    const users = await db
      .collection<StaffBotUser>(STAFF_BOT_USERS)
      .find({ stage: "in", blocked: { $ne: true }, employeeId: { $in: owners } })
      .toArray();
    if (!users.length) continue;
    const handled = await handledKeys(db, users.map((u) => keyOf(u.chatId)));
    const todo = users.filter((u) => !handled.has(keyOf(u.chatId)));
    if (!todo.length) continue;

    const lesson = await describeLesson(db, g, clock.iso, branches);
    if (lesson.pupils === 0) continue;
    for (const user of todo) {
      const c: Claim = { _id: keyOf(user.chatId), kind: "lesson", day: clock.iso, chatId: user.chatId, groupId: g.id };
      const access = await resolveAccess(db, user);
      if (!access.ok) {
        await skip(db, c, "no_access", out);
        continue;
      }
      const html = V.lessonReminderPush({
        name: access.access.identity.name,
        group: lesson.title,
        level: lesson.level,
        day: lesson.day,
        time: lesson.time,
        start: lesson.start,
        room: lesson.room,
        branch: lesson.branch,
        pupils: lesson.pupils,
      });
      await deliver(db, cfg, c, html, lessonPushKeyboard(g.id), out);
    }
  }
}

let running = false;

/** Har daqiqada chaqiriladi. Hech qachon xabarni ikki marta yubormaydi. */
export async function runDayReminders(db: Db, nowMs: number = Date.now()): Promise<DayRemindersReport> {
  const report: DayRemindersReport = { checkin: tally(), lessons: tally() };
  if (telegramMuted()) return { ...report, skipped: "muted" };
  const cfg = loadStaffBotConfig();
  if (!isStaffBotReady(cfg)) return { ...report, skipped: "no_bot" };
  if (running) return { ...report, skipped: "busy" };
  running = true;
  try {
    const clock = uzClock(nowMs);
    // Dars xabari aniq daqiqaga bog'liq — avval u.
    await sendLessonReminders(db, cfg, clock, report.lessons);
    await sendCheckinReminders(db, cfg, clock, report.checkin);
  } finally {
    running = false;
  }
  return report;
}
