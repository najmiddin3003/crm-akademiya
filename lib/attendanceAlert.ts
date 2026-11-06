import type { Db } from "mongodb";
import { APPROVAL_FIELD } from "@/lib/adminApproval";
import { expandBranchPools } from "@/lib/branchPools";
import { allBranchIds } from "@/lib/branchScope";
import { STAFF_BOT_USERS, type StaffBotUser } from "@/lib/staffBot/session";
import { uzClock, type UzClock } from "@/lib/teacherLessons";

// DAVOMAT QILINMAGAN GURUHLAR — RAHBARGA XABAR (06.11.2026). Egasi: «davomat qilinmagan
// guruhlar haqida ma'lumotlar rahbarga kelib turishi kerak, bu amalni yoqib o'chiradigan
// bo'lsin sozlamalarda, telegram botda habar kelib tursin rahbarga agar davomat qilinmasa
// barcha ma'lumotlari bilan».
//
// Bu yerda sozlama va qabul qiluvchilar; yuborish — lib/staffBot/dayReminders.ts (har
// daqiqalik cron), sahifa — Sozlamalar → Nazorat → Nazorat qoidalari.
//
// «DAVOMAT QILINMAGAN» — /nazorat-missed-groups dagi qoida: shu kungi darsda birorta belgi
// yo'q. Chala belgilangan guruh bu ro'yxatga kirmaydi.
//
// NEGA UMUMIY `settings` DA EMAS: `PUT /api/settings` istalgan kalitni yozadi va unga o'nlab
// sahifaning ruxsati yetadi (lib/ai/settings.ts boshidagi sabab). Temuriylar'da o'qituvchi
// rolida 50 bo'lim ochiq — nazorat qilinayotgan odam xabarni o'zi o'chirib qo'ya olmasin.
//
// SUKUT — O'CHIQ: deploy o'zi hech kimga yozib yubormasin.
//
// KIMGA: `recipients` — Telegram chat id'lari. `null` — admin hali tanlamagan, botga kirgan
// admin hisoblariga boradi. «Rahbar» tizimda alohida rol emas: Akademiya'da admin hisobi
// bitta, egasining o'zi esa «IT mutaxassisi» — shu sabab ro'yxatni admin belgilaydi.
// Admin hamma filialni, boshqalar saytda ko'radigan filiallarini oladi (loadViewer qoidasi).

export const ATTENDANCE_ALERT_SETTINGS = "attendance_alert_settings";

/** Dars tugagandan necha daqiqa keyin davomat tekshiriladi: ustoz oxirgi daqiqada belgilashi mumkin. */
export const MISSED_ALERT_AFTER_MIN = 10;

const KEY = "main";
const MAX_RECIPIENTS = 50;

export interface AttendanceAlertSettings {
  enabled: boolean;
  /** `null` — admin tanlamagan: botga kirgan adminlar. */
  recipients: number[] | null;
  /**
   * Shu lahzagacha muddati kelib bo'lgan darslar yozilmaydi (ISO). Kun o'rtasida yoqilganda
   * yoki yangi odam qo'shilganda ertalabdan beri to'plangan ro'yxat birdan yuborilmasin.
   */
  since: string | null;
}

const isChatId = (v: unknown): v is number => Number.isSafeInteger(v);

export function normalizeAttendanceAlert(raw: unknown): AttendanceAlertSettings {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  return {
    enabled: r.enabled === true,
    recipients: Array.isArray(r.recipients) ? [...new Set(r.recipients.filter(isChatId))] : null,
    since: typeof r.since === "string" ? r.since : null,
  };
}

export async function loadAttendanceAlert(db: Db): Promise<AttendanceAlertSettings> {
  const doc = await db.collection(ATTENDANCE_ALERT_SETTINGS).findOne({ key: KEY }, { projection: { _id: 0 } });
  return normalizeAttendanceAlert(doc);
}

export type SaveAttendanceAlertResult = { ok: true; settings: AttendanceAlertSettings } | { ok: false; error: string };

/** Faqat yuborilgan maydonlar o'zgaradi; yaroqsiz qiymat rad etiladi. */
export async function saveAttendanceAlert(
  db: Db,
  patch: { enabled?: unknown; recipients?: unknown },
  now: Date = new Date(),
): Promise<SaveAttendanceAlertResult> {
  const set: Partial<AttendanceAlertSettings> = {};
  if (patch.enabled !== undefined) {
    if (typeof patch.enabled !== "boolean") return { ok: false, error: "Noto'g'ri so'rov" };
    set.enabled = patch.enabled;
  }
  if (patch.recipients !== undefined) {
    if (!Array.isArray(patch.recipients) || !patch.recipients.every(isChatId) || patch.recipients.length > MAX_RECIPIENTS) {
      return { ok: false, error: "Noto'g'ri so'rov" };
    }
    set.recipients = [...new Set(patch.recipients)];
  }
  if (set.enabled === undefined && set.recipients === undefined) return { ok: false, error: "Noto'g'ri so'rov" };

  const before = await loadAttendanceAlert(db);
  const turnedOn = set.enabled === true && !before.enabled;
  if (turnedOn || (before.enabled && set.recipients !== undefined)) set.since = now.toISOString();
  await db.collection(ATTENDANCE_ALERT_SETTINGS).updateOne({ key: KEY }, { $set: { key: KEY, ...set } }, { upsert: true });
  return { ok: true, settings: { ...before, ...set } };
}

/** Bugungi `since` daqiqasi; undan oldin muddati kelgan darslar yozilmaydi. Boshqa kun bo'lsa -1. */
export function sinceMinute(settings: Pick<AttendanceAlertSettings, "since">, clock: UzClock): number {
  const ms = settings.since ? Date.parse(settings.since) : NaN;
  if (!Number.isFinite(ms)) return -1;
  const since = uzClock(ms);
  return since.iso === clock.iso ? since.nowMin : -1;
}

export interface AlertCandidate {
  chatId: number;
  /** Xodim ismi; xodimga bog'lanmagan admin hisobida — Telegram nomi. */
  name: string;
  /** Telegram nomi: bitta odam ikki hisobdan kirgan bo'lishi mumkin. */
  tgName: string;
  isAdmin: boolean;
  /** Xabar qaysi filiallar bo'yicha keladi; `null` — hammasi. */
  branchIds: number[] | null;
  /** Botni to'xtatgan — xabar bormaydi. */
  blocked: boolean;
}

export interface AlertRecipient extends AlertCandidate {
  user: StaffBotUser;
}

async function loadRecipients(db: Db): Promise<AlertRecipient[]> {
  const [users, employees, admins, branches] = await Promise.all([
    db.collection<StaffBotUser>(STAFF_BOT_USERS).find({ stage: "in" }).toArray(),
    db.collection("hr_employees").find({}, { projection: { _id: 0, id: 1, name: 1, turi: 1, branchIds: 1, archReason: 1 } }).toArray(),
    db
      .collection("users")
      .find({ role: "admin", status: "active", [APPROVAL_FIELD]: { $nin: ["pending", "rejected"] } }, { projection: { _id: 1, hrEmployeeId: 1 } })
      .toArray(),
    allBranchIds(db),
  ]);
  const staff = new Map(employees.map((e) => [Number(e.id), e]));
  const adminUsers = new Set(admins.map((a) => String(a._id)));
  const adminStaff = new Set(admins.map((a) => Number(a.hrEmployeeId)).filter(Number.isFinite));

  const rows: AlertRecipient[] = [];
  for (const user of users) {
    const employeeId = typeof user.employeeId === "number" ? user.employeeId : null;
    const emp = employeeId === null ? undefined : staff.get(employeeId);
    const isAdmin = adminUsers.has(String(user.userId)) || (employeeId !== null && adminStaff.has(employeeId));
    // Ustoz o'zi nazorat qilinayotgan odam; arxivdagi xodimga xabar yo'q.
    if (!isAdmin && (!emp || emp.turi === "teacher" || emp.archReason)) continue;
    const mine = (Array.isArray(emp?.branchIds) ? emp.branchIds : []).map(Number).filter((id: number) => branches.includes(id));
    rows.push({
      chatId: user.chatId,
      name: String(emp?.name ?? user.name ?? "").trim() || user.tgName || String(user.chatId),
      tgName: user.tgName ?? "",
      isAdmin,
      branchIds: isAdmin ? null : expandBranchPools(mine.length ? mine : [branches[0] ?? 1]),
      blocked: user.blocked === true,
      user,
    });
  }
  return rows.sort((a, b) => Number(b.isAdmin) - Number(a.isAdmin) || a.name.localeCompare(b.name, "uz"));
}

/** Sozlamalar sahifasidagi ro'yxat: botga kirgan rahbar va xodimlar, o'qituvchilarsiz. */
export async function alertCandidates(db: Db): Promise<AlertCandidate[]> {
  return (await loadRecipients(db)).map(({ chatId, name, tgName, isAdmin, branchIds, blocked }) => ({ chatId, name, tgName, isAdmin, branchIds, blocked }));
}

/** Tanlanganlar yoki (admin tanlamagan bo'lsa) adminlar; `selected` — sahifadagi belgilar. */
export function selectedChats(settings: Pick<AttendanceAlertSettings, "recipients">, rows: readonly Pick<AlertCandidate, "chatId" | "isAdmin">[]): number[] {
  return settings.recipients ?? rows.filter((r) => r.isAdmin).map((r) => r.chatId);
}

/** Hozir xabar oladiganlar. */
export async function alertRecipients(db: Db, settings: AttendanceAlertSettings): Promise<AlertRecipient[]> {
  const rows = await loadRecipients(db);
  const chosen = new Set(selectedChats(settings, rows));
  return rows.filter((r) => !r.blocked && chosen.has(r.chatId));
}

export const alertCovers = (r: Pick<AlertCandidate, "branchIds">, branchId: number): boolean =>
  r.branchIds === null || r.branchIds.includes(branchId);
