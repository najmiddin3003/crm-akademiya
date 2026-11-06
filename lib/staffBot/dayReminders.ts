import type { Db } from "mongodb";
import { alertCovers, alertRecipients, loadAttendanceAlert, MISSED_ALERT_AFTER_MIN, sinceMinute } from "@/lib/attendanceAlert";
import { QR_SOURCE } from "@/lib/attendanceCheck";
import { loadAttendanceSettings } from "@/lib/attendanceQr";
import { branchNames, normName } from "@/lib/gamification/scope";
import { sendToStaff } from "@/lib/staffBot/api";
import { resolveAccess } from "@/lib/staffBot/auth";
import { isStaffBotReady, loadStaffBotConfig, type StaffBotConfig } from "@/lib/staffBot/config";
import { checkinKeyboard, lessonPushKeyboard } from "@/lib/staffBot/keyboards";
import { markBlocked, STAFF_BOT_USERS, type StaffBotUser } from "@/lib/staffBot/session";
import * as V from "@/lib/staffBot/views";
import { formatPhone, phoneKey } from "@/lib/studentBot/phone";
import { telegramMuted, type InlineKeyboard } from "@/lib/telegramApi";
import { describeLesson, LESSON_GROUP_FIELDS, lessonBranchId, lessonsEndedBy, lessonsStartingSoon, uzClock, type LessonGroup, type UzClock } from "@/lib/teacherLessons";

// XODIMLAR BOTI — KUNLIK ESLATMALAR (05.11.2026). Egasi: «har kuni soat 8:00 da
// bot davomat habarnomasini eslatsin va habar pastida tugmada ishga keldim shu
// tugmalar chiqsin va o'qituvchiga biriktirilgan guruhni dars vaqt boshlanishidan
// 10 daqiqa oldin bot habar yuborsin davomatni boshlang deb».
//
//   08:00 — botga kirgan HAMMA xodimga, har kuni. Shu kuni ishga kelganini
//           belgilagan bo'lsa yozilmaydi.
//   −10 daqiqa — guruh ustoziga (ism bo'yicha, ismdoshlarning ikkalasiga ham).
//   +10 daqiqa — dars tugab, davomat belgilanmagan bo'lsa rahbarga (sozlama yoqilgan
//           bo'lsa, lib/attendanceAlert.ts). Bir paytda muddati kelgan guruhlar bitta
//           xabarda: hozircha kuniga 40 tagacha guruh chiqadi, har biriga alohida xabar
//           suhbatni to'ldirardi.
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

type ReminderReason = "sent" | "blocked" | "checked_in" | "no_access" | "marked" | "no_pupil";

interface ReminderDoc {
  _id: string;
  kind: "checkin" | "lesson" | "missed";
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
  missed: Tally;
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

/** Egallangan eslatmalar bitta xabarda (hammasi bitta suhbatga). Natija shu yozuvlarda qoladi. */
async function sendClaimed(db: Db, cfg: StaffBotConfig, claims: Claim[], html: string, keyboard: InlineKeyboard | undefined, out: Tally): Promise<void> {
  const { chatId } = claims[0];
  const mine = { _id: { $in: claims.map((c) => c._id) } };
  const col = reminders(db);
  let error: unknown;
  try {
    const res = await sendToStaff(cfg, chatId, html, keyboard);
    if (res.ok) {
      await col.updateMany(mine, { $set: { sent: true, reason: "sent" } });
      out.sent += claims.length;
      return;
    }
    if (res.blocked) {
      await col.updateMany(mine, { $set: { reason: "blocked" } });
      await markBlocked(db, chatId);
      out.blocked += claims.length;
      return;
    }
    error = res.error;
  } catch (e) {
    error = e instanceof Error ? e.message : e;
  }
  // Vaqtinchalik xato — egallash bo'shatiladi, keyingi daqiqada qayta uriniladi.
  await col.deleteMany(mine);
  out.failed += claims.length;
  console.error(`[staff-bot] eslatma ketmadi (${claims[0]._id}):`, error);
}

/** Egallaydi va yuboradi. */
async function deliver(db: Db, cfg: StaffBotConfig, c: Claim, html: string, keyboard: InlineKeyboard, out: Tally): Promise<void> {
  if (await claim(db, c, null)) await sendClaimed(db, cfg, [c], html, keyboard, out);
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

async function sendLessonReminders(db: Db, cfg: StaffBotConfig, clock: UzClock, active: LessonGroup[], out: Tally): Promise<void> {
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

/** Dars tugadi, davomat yo'q — rahbarga. Bir paytda muddati kelgan guruhlar bitta xabarda. */
async function sendMissedAttendance(db: Db, cfg: StaffBotConfig, clock: UzClock, active: LessonGroup[], out: Tally): Promise<void> {
  const settings = await loadAttendanceAlert(db);
  if (!settings.enabled) return;
  const due = lessonsEndedBy(active, clock, MISSED_ALERT_AFTER_MIN, sinceMinute(settings, clock));
  if (!due.length) return;

  const keyOf = (groupId: number, chatId: number) => `missed:${clock.iso}:${groupId}:${chatId}`;
  const recipients = await alertRecipients(db, settings);
  const pairs = recipients.flatMap((r) => due.filter((g) => alertCovers(r, lessonBranchId(g))).map((g) => ({ r, g })));
  if (!pairs.length) return;
  const handled = await handledKeys(db, pairs.map((p) => keyOf(p.g.id, p.r.chatId)));
  const todo = pairs.filter((p) => !handled.has(keyOf(p.g.id, p.r.chatId)));
  if (!todo.length) return;

  // /nazorat-missed-groups qoidasi: guruhda shu kuni birorta belgi bo'lsa — davomat qilingan.
  const groups = [...new Map(todo.map((p) => [p.g.id, p.g])).values()];
  const marked = new Set(
    (await db.collection("attendance").distinct("groupId", { date: clock.iso, groupId: { $in: groups.map((g) => g.id) } })).map(Number),
  );
  const [employees, branches] = await Promise.all([
    db.collection("hr_employees").find({}, { projection: { _id: 0, name: 1, phone: 1 } }).toArray(),
    branchNames(db),
  ]);
  const phones = new Map<string, string>();
  for (const e of employees) {
    const key = phoneKey(e.phone);
    if (key && !phones.has(normName(e.name))) phones.set(normName(e.name), key);
  }
  const rows = new Map<number, V.MissedLessonRow>();
  for (const g of groups) {
    if (marked.has(g.id)) continue;
    const lesson = await describeLesson(db, g, clock.iso, branches);
    if (lesson.pupils === 0) continue;
    const teacher = String(g.teacher ?? "").trim();
    const phone = phones.get(normName(teacher));
    rows.set(g.id, { ...lesson, group: lesson.title, teacher, phone: phone ? `+998 ${formatPhone(phone)}` : "" });
  }

  for (const r of recipients) {
    const access = await resolveAccess(db, r.user);
    const send: (V.MissedLessonRow & { claim: Claim })[] = [];
    for (const { g } of todo.filter((p) => p.r.chatId === r.chatId)) {
      const c: Claim = { _id: keyOf(g.id, r.chatId), kind: "missed", day: clock.iso, chatId: r.chatId, groupId: g.id };
      const row = rows.get(g.id);
      if (row && access.ok) send.push({ ...row, claim: c });
      else await skip(db, c, marked.has(g.id) ? "marked" : !row ? "no_pupil" : "no_access", out);
    }
    send.sort((a, b) => a.start.localeCompare(b.start));
    for (const batch of V.missedAttendanceBatches(send)) {
      const mine: typeof batch = [];
      for (const row of batch) if (await claim(db, row.claim, null)) mine.push(row);
      if (mine.length) await sendClaimed(db, cfg, mine.map((row) => row.claim), V.missedAttendancePush(mine, clock.iso), undefined, out);
    }
  }
}

let running = false;

/** Har daqiqada chaqiriladi. Hech qachon xabarni ikki marta yubormaydi. */
export async function runDayReminders(db: Db, nowMs: number = Date.now()): Promise<DayRemindersReport> {
  const report: DayRemindersReport = { checkin: tally(), lessons: tally(), missed: tally() };
  if (telegramMuted()) return { ...report, skipped: "muted" };
  const cfg = loadStaffBotConfig();
  if (!isStaffBotReady(cfg)) return { ...report, skipped: "no_bot" };
  if (running) return { ...report, skipped: "busy" };
  running = true;
  try {
    const clock = uzClock(nowMs);
    const active = await db.collection<LessonGroup>("groups").find({ status: "active" }, { projection: LESSON_GROUP_FIELDS }).toArray();
    // Dars xabari aniq daqiqaga bog'liq — avval u.
    await sendLessonReminders(db, cfg, clock, active, report.lessons);
    await sendCheckinReminders(db, cfg, clock, report.checkin);
    await sendMissedAttendance(db, cfg, clock, active, report.missed);
  } finally {
    running = false;
  }
  return report;
}
