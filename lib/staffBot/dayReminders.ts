import type { Db } from "mongodb";
import { ROLE_LABELS } from "@/constants/employees";
import {
  alertCovers,
  alertRecipients,
  FACE_FAIL_GRACE_MIN,
  loadAttendanceAlert,
  MISSED_ALERT_AFTER_MIN,
  sinceMinute,
  TEACHER_ABSENT_AFTER_MIN,
  type AlertRecipient,
  type AttendanceAlertSettings,
} from "@/lib/attendanceAlert";
import { QR_SOURCE } from "@/lib/attendanceCheck";
import { attendanceGroup, attendanceThreadId, branchAttendanceThreads, type AttendanceGroup } from "@/lib/attendanceNotify";
import { loadAttendanceSettings } from "@/lib/attendanceQr";
import { branchNames, normName } from "@/lib/gamification/scope";
import { sendToStaff } from "@/lib/staffBot/api";
import { resolveAccess } from "@/lib/staffBot/auth";
import { isStaffBotReady, loadStaffBotConfig, type StaffBotConfig } from "@/lib/staffBot/config";
import { checkinKeyboard, lessonPushKeyboard } from "@/lib/staffBot/keyboards";
import { markBlocked, STAFF_BOT_USERS, type StaffBotUser } from "@/lib/staffBot/session";
import * as V from "@/lib/staffBot/views";
import { formatPhone, phoneKey } from "@/lib/studentBot/phone";
import { uzTimeOf } from "@/lib/staffTasks";
import { callTelegram, telegramErrorMessage, telegramMuted, type InlineKeyboard } from "@/lib/telegramApi";
import {
  describeLesson,
  LESSON_GROUP_FIELDS,
  lessonBranchId,
  lessonsEndedBy,
  lessonsStartedBy,
  lessonsStartingSoon,
  uzClock,
  type LessonGroup,
  type UzClock,
} from "@/lib/teacherLessons";

// XODIMLAR BOTI — KUNLIK ESLATMALAR (05.11.2026). Egasi: «har kuni soat 8:00 da
// bot davomat habarnomasini eslatsin va habar pastida tugmada ishga keldim shu
// tugmalar chiqsin va o'qituvchiga biriktirilgan guruhni dars vaqt boshlanishidan
// 10 daqiqa oldin bot habar yuborsin davomatni boshlang deb».
//
//   08:00 — botga kirgan HAMMA xodimga, har kuni. Shu kuni ishga kelganini
//           belgilagan bo'lsa yozilmaydi.
//   −10 daqiqa — guruh ustoziga (ism bo'yicha, ismdoshlarning ikkalasiga ham).
//   +10 daqiqa — dars tugab, davomat belgilanmagan bo'lsa (sozlama yoqilgan bo'lsa,
//           lib/attendanceAlert.ts) — filialning Telegram guruhidagi «davomat» topigiga
//           (09.11.2026 dan, kechikish xabari bilan bitta joy — lib/attendanceNotify.ts);
//           topigi yo'q filialniki rahbarga botda. Bir paytda muddati kelgan guruhlar bitta
//           xabarda: hozircha kuniga 40 tagacha guruh chiqadi, har biriga alohida xabar
//           suhbatni to'ldirardi.
//   +5 daqiqa (dars boshidan) — ustoz bugun «Ishga keldim» belgilamagan bo'lsa rahbarga
//           (08.11.2026, sozlama `teacherAbsent`).
//   Face ID rad etilib, 5 daqiqa ichida o'tmasa — rahbarga, xodimga kuniga bir marta
//           (08.11.2026, sozlama `faceFail`).
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

type ReminderReason =
  | "sent"
  | "blocked"
  | "checked_in"
  | "no_access"
  | "marked"
  | "no_pupil"
  /** Ustoz kelgan («Ishga keldim» bor) — `absent` kerak emas. */
  | "arrived"
  /** Ustoz «Ishga keldim» dan foydalanmaydi (botda yo'q, oxirgi 30 kunda belgisi yo'q) yoki xodimlar ro'yxatida topilmadi. */
  | "no_checkin"
  /** Telegram guruh/topikka yozishni rad etdi (topik o'chirilgan, bot chiqarilgan) — bugun qayta urinilmaydi. */
  | "rejected";

interface ReminderDoc {
  _id: string;
  kind: "checkin" | "lesson" | "missed" | "absent" | "face";
  day: string;
  chatId: number;
  groupId?: number;
  /** `face` — qaysi xodim. */
  employeeId?: number;
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
  absent: Tally;
  face: Tally;
}

const tally = (): Tally => ({ sent: 0, blocked: 0, failed: 0, skipped: 0 });
const reminders = (db: Db) => db.collection<ReminderDoc>(STAFF_BOT_REMINDERS);
type Claim = Pick<ReminderDoc, "_id" | "kind" | "day" | "chatId" | "groupId" | "employeeId">;

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

// ── Rahbarga xabarlar (lib/attendanceAlert.ts) ──────────────────────

type LessonAlertKind = "missed" | "absent";
type LessonPair = { r: AlertRecipient; g: LessonGroup };

/** Muddati kelgan guruhlar × o'z filiali bo'yicha qabul qiluvchilar, hali ishlanmaganlari. */
async function pendingLessonPairs(
  db: Db,
  clock: UzClock,
  kind: LessonAlertKind,
  settings: AttendanceAlertSettings,
  due: LessonGroup[],
): Promise<{ recipients: AlertRecipient[]; todo: LessonPair[] } | null> {
  const keyOf = (groupId: number, chatId: number) => `${kind}:${clock.iso}:${groupId}:${chatId}`;
  const recipients = await alertRecipients(db, settings);
  const pairs = recipients.flatMap((r) => due.filter((g) => alertCovers(r, lessonBranchId(g))).map((g) => ({ r, g })));
  if (!pairs.length) return null;
  const handled = await handledKeys(db, pairs.map((p) => keyOf(p.g.id, p.r.chatId)));
  const todo = pairs.filter((p) => !handled.has(keyOf(p.g.id, p.r.chatId)));
  return todo.length ? { recipients, todo } : null;
}

/** Xodim ismi → telefon (ismdoshlardan birinchisi). */
function phonesByName(employees: readonly Record<string, unknown>[]): Map<string, string> {
  const phones = new Map<string, string>();
  for (const e of employees) {
    const key = phoneKey(e.phone);
    if (key && !phones.has(normName(e.name))) phones.set(normName(e.name), key);
  }
  return phones;
}

async function lessonRow(db: Db, g: LessonGroup, iso: string, branches: Map<number, string>, phones: Map<string, string>): Promise<V.MissedLessonRow | null> {
  const lesson = await describeLesson(db, g, iso, branches);
  if (lesson.pupils === 0) return null;
  const teacher = String(g.teacher ?? "").trim();
  const phone = phones.get(normName(teacher));
  return { ...lesson, group: lesson.title, teacher, phone: phone ? `+998 ${formatPhone(phone)}` : "" };
}

/**
 * Guruh bo'yicha xabar: har qabul qiluvchiga o'z guruhlari bitta xabarda (3500 belgidan oshsa
 * bo'linadi). `rows` da yo'q guruh `reasonOf` sababi bilan yopiladi — bugun qayta tekshirilmaydi.
 */
async function deliverLessonAlerts(
  db: Db,
  cfg: StaffBotConfig,
  clock: UzClock,
  kind: LessonAlertKind,
  pending: { recipients: AlertRecipient[]; todo: LessonPair[] },
  rows: Map<number, V.MissedLessonRow>,
  reasonOf: (groupId: number) => ReminderReason,
  push: (rows: readonly V.MissedLessonRow[], iso: string) => string,
  out: Tally,
): Promise<void> {
  for (const r of pending.recipients) {
    const mineTodo = pending.todo.filter((p) => p.r.chatId === r.chatId);
    if (!mineTodo.length) continue;
    const access = await resolveAccess(db, r.user);
    const send: (V.MissedLessonRow & { claim: Claim })[] = [];
    for (const { g } of mineTodo) {
      const c: Claim = { _id: `${kind}:${clock.iso}:${g.id}:${r.chatId}`, kind, day: clock.iso, chatId: r.chatId, groupId: g.id };
      const row = rows.get(g.id);
      if (row && access.ok) send.push({ ...row, claim: c });
      else await skip(db, c, row ? "no_access" : reasonOf(g.id), out);
    }
    send.sort((a, b) => a.start.localeCompare(b.start));
    const batches = kind === "absent" ? V.teacherAbsentBatches(send) : V.missedAttendanceBatches(send);
    for (const batch of batches) {
      const mine: typeof batch = [];
      for (const row of batch) if (await claim(db, row.claim, null)) mine.push(row);
      if (mine.length) await sendClaimed(db, cfg, mine.map((row) => row.claim), push(mine, clock.iso), undefined, out);
    }
  }
}

/**
 * Davomat qilinmagan guruhlar qatori (/nazorat-missed-groups qoidasi: guruhda shu kuni birorta belgi
 * bo'lsa — davomat qilingan). `rows` da yo'q guruhning sababi — `reasonOf`.
 */
async function missedRows(
  db: Db,
  iso: string,
  groups: LessonGroup[],
): Promise<{ rows: Map<number, V.MissedLessonRow>; reasonOf: (groupId: number) => ReminderReason }> {
  const marked = new Set((await db.collection("attendance").distinct("groupId", { date: iso, groupId: { $in: groups.map((g) => g.id) } })).map(Number));
  const [employees, branches] = await Promise.all([
    db.collection("hr_employees").find({}, { projection: { _id: 0, name: 1, phone: 1 } }).toArray(),
    branchNames(db),
  ]);
  const phones = phonesByName(employees);
  const rows = new Map<number, V.MissedLessonRow>();
  for (const g of groups) {
    if (marked.has(g.id)) continue;
    const row = await lessonRow(db, g, iso, branches, phones);
    if (row) rows.set(g.id, row);
  }
  return { rows, reasonOf: (id) => (marked.has(id) ? "marked" : "no_pupil") };
}

/** Kalit oxiri: topikka xabar bitta (qabul qiluvchilar bo'yicha emas) — `missed:<kun>:<guruh>:topic`. */
const TOPIC_KEY = "topic";

/** Egallangan eslatmalar guruh topigiga bitta xabarda. Natija shu yozuvlarda qoladi. */
async function sendClaimedToTopic(db: Db, group: AttendanceGroup, threadId: string, claims: Claim[], html: string, out: Tally): Promise<void> {
  const mine = { _id: { $in: claims.map((c) => c._id) } };
  const col = reminders(db);
  let error: unknown;
  try {
    const res = await callTelegram(group.token, "sendMessage", {
      chat_id: group.chatId,
      message_thread_id: Number(threadId),
      text: html,
      parse_mode: "HTML",
      disable_web_page_preview: true,
    });
    if (res.ok) {
      await col.updateMany(mine, { $set: { sent: true, reason: "sent" } });
      out.sent += claims.length;
      return;
    }
    const why = telegramErrorMessage(res.description || "noma'lum xato", group.chatId, threadId);
    // 400/403 — guruh yoki topik yo'q, bot chiqarilgan: har daqiqa qayta urinish foyda bermaydi.
    if (res.error_code === 400 || res.error_code === 403) {
      await col.updateMany(mine, { $set: { reason: "rejected" } });
      out.failed += claims.length;
      console.error(`[staff-bot] davomat topigiga yozilmadi (${claims[0]._id}):`, why);
      return;
    }
    error = why;
  } catch (e) {
    error = e instanceof Error ? e.message : e;
  }
  // Vaqtinchalik xato — egallash bo'shatiladi, keyingi daqiqada qayta uriniladi.
  await col.deleteMany(mine);
  out.failed += claims.length;
  console.error(`[staff-bot] davomat topigiga yozilmadi (${claims[0]._id}):`, error);
}

/**
 * Filial topigiga: har topikka o'z guruhlari bitta xabarda (3500 belgidan oshsa bo'linadi).
 * Bugun shu guruh haqida qaysi yo'l bilan bo'lmasin yozilgan bo'lsa (masalan, topik kun o'rtasida
 * ochilib, ertaroq rahbarga ketgan) — qayta yozilmaydi.
 */
async function sendMissedToTopics(
  db: Db,
  clock: UzClock,
  group: AttendanceGroup,
  due: LessonGroup[],
  threadOf: (g: LessonGroup) => string,
  out: Tally,
): Promise<void> {
  const done = new Set((await reminders(db).distinct("groupId", { kind: "missed", day: clock.iso, groupId: { $in: due.map((g) => g.id) } })).map(Number));
  const fresh = due.filter((g) => !done.has(g.id));
  if (!fresh.length) return;

  const { rows, reasonOf } = await missedRows(db, clock.iso, fresh);
  const chatId = Number(group.chatId);
  const byThread = new Map<string, (V.MissedLessonRow & { claim: Claim })[]>();
  for (const g of fresh) {
    const c: Claim = {
      _id: `missed:${clock.iso}:${g.id}:${TOPIC_KEY}`,
      kind: "missed",
      day: clock.iso,
      chatId: Number.isSafeInteger(chatId) ? chatId : 0,
      groupId: g.id,
    };
    const row = rows.get(g.id);
    if (!row) {
      await skip(db, c, reasonOf(g.id), out);
      continue;
    }
    const thread = threadOf(g);
    byThread.set(thread, [...(byThread.get(thread) ?? []), { ...row, claim: c }]);
  }
  for (const [threadId, list] of byThread) {
    list.sort((a, b) => a.start.localeCompare(b.start));
    for (const batch of V.missedAttendanceBatches(list)) {
      const mine: typeof batch = [];
      for (const row of batch) if (await claim(db, row.claim, null)) mine.push(row);
      if (mine.length) await sendClaimedToTopic(db, group, threadId, mine.map((row) => row.claim), V.missedAttendancePush(mine, clock.iso), out);
    }
  }
}

/**
 * Dars tugadi, davomat yo'q — filialning «davomat» topigiga; topigi yo'q filialniki (yoki guruh
 * Telegram'i sozlanmagan bo'lsa) rahbarga botda. Bir paytda muddati kelgan guruhlar bitta xabarda.
 */
async function sendMissedAttendance(db: Db, cfg: StaffBotConfig, clock: UzClock, settings: AttendanceAlertSettings, active: LessonGroup[], out: Tally): Promise<void> {
  if (!settings.enabled) return;
  const due = lessonsEndedBy(active, clock, MISSED_ALERT_AFTER_MIN, sinceMinute(settings, clock));
  if (!due.length) return;

  const group = attendanceGroup();
  const threads = group ? await branchAttendanceThreads(db) : new Map<number, string>();
  const threadOf = (g: LessonGroup): string => (group ? (threads.get(lessonBranchId(g)) ?? attendanceThreadId(null)) : "");
  const toTopic = due.filter((g) => threadOf(g));
  if (group && toTopic.length) await sendMissedToTopics(db, clock, group, toTopic, threadOf, out);

  const toAdmins = due.filter((g) => !threadOf(g));
  if (!toAdmins.length) return;
  const pending = await pendingLessonPairs(db, clock, "missed", settings, toAdmins);
  if (!pending) return;
  const groups = [...new Map(pending.todo.map((p) => [p.g.id, p.g])).values()];
  const { rows, reasonOf } = await missedRows(db, clock.iso, groups);
  await deliverLessonAlerts(db, cfg, clock, "missed", pending, rows, reasonOf, V.missedAttendancePush, out);
}

/** "YYYY-MM-DD" dan `days` kun oldingi kun. */
const isoDaysBefore = (iso: string, days: number) => new Date(Date.parse(`${iso}T00:00:00Z`) - days * 86_400_000).toISOString().slice(0, 10);

/**
 * Dars boshlanib TEACHER_ABSENT_AFTER_MIN o'tdi, ustoz bugun «Ishga keldim» belgilamagan — rahbarga.
 * Ustoz ISM bo'yicha (sendLessonReminders bilan bir xil; ismdoshlardan biri kelgan bo'lsa — keldi).
 * «Ishga keldim» dan foydalanmaydigan ustoz (botga kirmagan, 30 kunda birorta belgisi yo'q) uchun
 * yozilmaydi — aks holda u har darsda «kelmadi» bo'lib chiqardi.
 */
async function sendTeacherAbsent(db: Db, cfg: StaffBotConfig, clock: UzClock, settings: AttendanceAlertSettings, active: LessonGroup[], out: Tally): Promise<void> {
  if (!settings.teacherAbsent) return;
  const due = lessonsStartedBy(active, clock, TEACHER_ABSENT_AFTER_MIN, sinceMinute(settings, clock));
  if (!due.length) return;
  const pending = await pendingLessonPairs(db, clock, "absent", settings, due);
  if (!pending) return;

  const groups = [...new Map(pending.todo.map((p) => [p.g.id, p.g])).values()];
  const employees = await db.collection("hr_employees").find({}, { projection: { _id: 0, id: 1, name: 1, phone: 1, archReason: 1 } }).toArray();
  const ownersOf = new Map<number, number[]>();
  for (const g of groups) {
    const t = normName(g.teacher);
    ownersOf.set(g.id, t ? employees.filter((e) => !e.archReason && normName(e.name) === t).map((e) => Number(e.id)) : []);
  }
  const owners = [...new Set([...ownersOf.values()].flat())];
  const [came, inBot, usedCheckin, branches] = await Promise.all([
    db.collection("turnstile_io").distinct("employeeId", { date: clock.iso, employeeId: { $in: owners }, enterTime: { $nin: [null, ""] } }),
    db.collection(STAFF_BOT_USERS).distinct("employeeId", { stage: "in", employeeId: { $in: owners } }),
    db.collection("turnstile_io").distinct("employeeId", { date: { $gte: isoDaysBefore(clock.iso, 30) }, employeeId: { $in: owners } }),
    branchNames(db),
  ]);
  const arrived = new Set(came.map(Number));
  const checksIn = new Set([...inBot, ...usedCheckin].map(Number));
  const phones = phonesByName(employees);
  const rows = new Map<number, V.MissedLessonRow>();
  const reasons = new Map<number, ReminderReason>();
  for (const g of groups) {
    const ids = ownersOf.get(g.id) ?? [];
    if (ids.some((id) => arrived.has(id))) reasons.set(g.id, "arrived");
    else if (!ids.some((id) => checksIn.has(id))) reasons.set(g.id, "no_checkin");
    else {
      const row = await lessonRow(db, g, clock.iso, branches, phones);
      if (row) rows.set(g.id, row);
      else reasons.set(g.id, "no_pupil");
    }
  }
  await deliverLessonAlerts(db, cfg, clock, "absent", pending, rows, (id) => reasons.get(id) ?? "no_pupil", V.teacherAbsentPush, out);
}

interface FaceShotLite {
  employeeId: number;
  at: Date;
  ok: boolean;
}

/**
 * Face ID rad etildi va oxirgi rad etilgan urinishdan FACE_FAIL_GRACE_MIN o'tib ham muvaffaqiyatli
 * urinish yo'q — rahbarga. Xodim bo'yicha KUNIGA BIR MARTA (kalit `face:<kun>:<xodim>:<chat>`).
 * Faqat serverga yetgan urinishlar (lib/staffFace.ts → staff_face_shots, «yuz mos kelmadi»): kamera
 * ochilmagani yoki jonlilik telefonda o'tmagani serverga kelmaydi — bu holat «ustoz kelmadi»
 * xabarida ko'rinadi.
 */
async function sendFaceFails(db: Db, cfg: StaffBotConfig, clock: UzClock, settings: AttendanceAlertSettings, nowMs: number, out: Tally): Promise<void> {
  if (!settings.faceFail) return;
  const dayStart = Date.parse(`${clock.iso}T00:00:00+05:00`);
  const sinceMs = settings.since ? Date.parse(settings.since) : NaN;
  const from = new Date(Math.max(dayStart, Number.isFinite(sinceMs) ? sinceMs : 0));
  const shots = await db
    .collection<FaceShotLite>("staff_face_shots")
    .find({ purpose: "verify", at: { $gte: from } }, { projection: { _id: 0, employeeId: 1, at: 1, ok: 1 } })
    .sort({ at: 1 })
    .toArray();
  if (!shots.length) return;

  // Har xodimning oxirgi muvaffaqiyatli urinishidan keyingi rad etilganlari.
  const fails = new Map<number, Date[]>();
  for (const s of shots) {
    const id = Number(s.employeeId);
    if (!Number.isFinite(id)) continue;
    if (s.ok) fails.delete(id);
    else fails.set(id, [...(fails.get(id) ?? []), s.at]);
  }
  const graceMs = FACE_FAIL_GRACE_MIN * 60_000;
  const due = [...fails].filter(([, list]) => nowMs - list[list.length - 1].getTime() >= graceMs);
  if (!due.length) return;

  const ids = due.map(([id]) => id);
  const employees = await db
    .collection("hr_employees")
    .find({ id: { $in: ids } }, { projection: { _id: 0, id: 1, name: 1, turi: 1, phone: 1, branchIds: 1 } })
    .toArray();
  const emp = new Map(employees.map((e) => [Number(e.id), e]));
  const branchesOf = (id: number): number[] => {
    const raw = emp.get(id)?.branchIds;
    const list = (Array.isArray(raw) ? raw : []).map(Number).filter(Number.isFinite);
    return list.length ? list : [1];
  };
  const keyOf = (employeeId: number, chatId: number) => `face:${clock.iso}:${employeeId}:${chatId}`;
  const recipients = await alertRecipients(db, settings);
  const pairs = recipients.flatMap((r) => ids.filter((id) => branchesOf(id).some((b) => alertCovers(r, b))).map((id) => ({ r, id })));
  if (!pairs.length) return;
  const handled = await handledKeys(db, pairs.map((p) => keyOf(p.id, p.r.chatId)));
  const todo = pairs.filter((p) => !handled.has(keyOf(p.id, p.r.chatId)));
  if (!todo.length) return;

  const todoIds = [...new Set(todo.map((p) => p.id))];
  const [marks, branches] = await Promise.all([
    db
      .collection("turnstile_io")
      .find({ date: clock.iso, employeeId: { $in: todoIds }, enterTime: { $nin: [null, ""] } }, { projection: { _id: 0, employeeId: 1, enterTime: 1, exitTime: 1 } })
      .toArray(),
    branchNames(db),
  ]);
  const markOf = new Map(marks.map((m) => [Number(m.employeeId), m]));
  const failsOf = new Map(due);
  const rows = new Map<number, V.FaceFailRow>();
  for (const id of todoIds) {
    const e = emp.get(id);
    const list = failsOf.get(id) ?? [];
    const m = markOf.get(id);
    const phone = phoneKey(e?.phone);
    rows.set(id, {
      name: String(e?.name ?? "").trim() || `Xodim #${id}`,
      role: ROLE_LABELS[String(e?.turi ?? "") as keyof typeof ROLE_LABELS] ?? "",
      phone: phone ? `+998 ${formatPhone(phone)}` : "",
      branch: branchesOf(id).map((b) => branches.get(b) ?? "").filter(Boolean).join(", "),
      attempts: list.length,
      first: list.length ? uzTimeOf(list[0].getTime()) : "",
      last: list.length ? uzTimeOf(list[list.length - 1].getTime()) : "",
      enter: m?.enterTime ? String(m.enterTime) : null,
      exit: m?.exitTime ? String(m.exitTime) : null,
    });
  }

  for (const r of recipients) {
    const mineTodo = todo.filter((p) => p.r.chatId === r.chatId);
    if (!mineTodo.length) continue;
    const access = await resolveAccess(db, r.user);
    const send: (V.FaceFailRow & { claim: Claim })[] = [];
    for (const { id } of mineTodo) {
      const c: Claim = { _id: keyOf(id, r.chatId), kind: "face", day: clock.iso, chatId: r.chatId, employeeId: id };
      const row = rows.get(id);
      if (row && access.ok) send.push({ ...row, claim: c });
      else await skip(db, c, "no_access", out);
    }
    send.sort((a, b) => a.last.localeCompare(b.last));
    for (const batch of V.faceFailBatches(send)) {
      const mine: typeof batch = [];
      for (const row of batch) if (await claim(db, row.claim, null)) mine.push(row);
      if (mine.length) await sendClaimed(db, cfg, mine.map((row) => row.claim), V.faceFailPush(mine, clock.iso), undefined, out);
    }
  }
}

let running = false;

/** Har daqiqada chaqiriladi. Hech qachon xabarni ikki marta yubormaydi. */
export async function runDayReminders(db: Db, nowMs: number = Date.now()): Promise<DayRemindersReport> {
  const report: DayRemindersReport = { checkin: tally(), lessons: tally(), missed: tally(), absent: tally(), face: tally() };
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
    const alert = await loadAttendanceAlert(db);
    await sendTeacherAbsent(db, cfg, clock, alert, active, report.absent);
    await sendFaceFails(db, cfg, clock, alert, nowMs, report.face);
    await sendMissedAttendance(db, cfg, clock, alert, active, report.missed);
  } finally {
    running = false;
  }
  return report;
}
