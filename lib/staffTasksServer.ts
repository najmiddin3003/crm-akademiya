import type { Db, Document, Filter, WithId } from "mongodb";
import type { CurrentUser } from "@/lib/auth";
import { allBranchIds, employeeBranchIds } from "@/lib/branchScope";
import { employeeNameById } from "@/lib/currentEmployee";
import { fixedSalaryOf, type EmployeeBranchAssignment } from "@/lib/hrEmployees";
import { CLOSING_SALARY_RUN } from "@/lib/salary";
import { hasSectionPermission } from "@/lib/permissions";
import { cloudinaryConfig, parseCloudinaryUrl } from "@/lib/cloudinary";
import { toUz } from "@/lib/uzTime";
import type { NotifItem } from "@/lib/notifications";
import { ROLE_LABELS } from "@/constants/employees";
import {
  ACTIVE_STATUSES,
  HOUR_MS,
  PRIORITIES,
  isPriority,
  ms,
  normalizeSettings,
  uzMonthOf,
  type StaffTask,
  type StaffTaskBranch,
  type StaffTaskEmployee,
  type StaffTaskEvent,
  type StaffTaskFile,
  type StaffTaskFileRef,
  type StaffTaskFineInfo,
  type StaffTaskPriority,
  type StaffTaskSettings,
  type StaffTaskStatus,
  type StaffTaskViewerInfo,
} from "@/lib/staffTasks";

// XODIM TOPSHIRIQLARI — SERVER QISMI (lib/staffTasks.ts izohiga qarang).
//
// KIM NIMANI KO'RADI (qaror 23.09.2026, "ruxsat bo'yicha"):
//   direktor — `users.role === "admin"`: hamma filial, Sozlamalar tabi,
//              jarimani bekor qilish.
//   rahbar   — /tasks bo'lim RUXSATI bor xodim: o'z filiallaridagi
//              (`hr_employees.branchIds`) topshiriqlar + o'zi berganlari.
//   xodim    — qolgan hamma: faqat O'ZIGA berilganlar.
// /tasks sahifasi HAMMAGA ochiq (lib/permissions.ts → SELF_SERVICE_PATHS),
// ruxsat kaliti esa "rahbar rejimi" degani bo'lib qoladi. Shu sabab bu
// yerdagi route'lar gen-api-permissions'da SHARED_EXTRA da (sessiya
// yetarli) va qamrov HAR BIR handler ichida shu fayl orqali kesiladi.
//
// Hech kim O'Z topshirig'ini o'zi tasdiqlamaydi/qaytarmaydi (canManage).
//
// FILIAL: topshiriq binoga emas, odamga beriladi (qaror 23.09.2026) —
// navbardagi filial tanlovi bu yerni KESMAYDI. `branchId` — xodimning
// topshiriq berilgan paytdagi filiali (rahbar uchun — o'z filiallaridan
// biri), filtr va rahbar qamrovi shunga qaraydi.

export const TASKS_COL = "staff_tasks";
export const FINES_COL = "staff_task_fines";
export const SETTINGS_KEY = "topshiriq.sozlamalar";
/** Cloudinary papkasi — biriktirma shu papkada bo'lmasa qabul qilinmaydi. */
export const TASK_FILES_FOLDER = "topshiriqlar";

export interface StaffTaskAuthor {
  userId: string;
  employeeId: number | null;
  name: string;
}

/** Bazadagi hujjat (`staff_tasks`). */
export interface StaffTaskDoc {
  id: number;
  batchId: number;
  title: string;
  desc: string;
  employeeId: number;
  employeeName: string;
  branchId: number;
  priority: StaffTaskPriority;
  fineAmount: number;
  deadline: string;
  originalDeadline: string;
  redeadline: string | null;
  attachments: StaffTaskFile[];
  link: string;
  seenAt: string | null;
  doneAt: string | null;
  doneNote: string;
  resultLink: string;
  resultFile: StaffTaskFile | null;
  isLate: boolean;
  status: StaffTaskStatus;
  returnCount: number;
  cancelReason: string;
  completedAt: string | null;
  completedLate: boolean;
  failedAt: string | null;
  createdBy: StaffTaskAuthor;
  createdAt: string;
  updatedAt: string;
  history: StaffTaskEvent[];
}

/** Bazadagi jarima (`staff_task_fines`). Bitta topshiriqqa ko'pi bilan bitta. */
export interface StaffFineDoc {
  id: number;
  taskId: number;
  taskTitle: string;
  employeeId: number;
  employeeName: string;
  branchId: number;
  priority: number;
  amount: number;
  /** "YYYY-MM" — qaysi oy oyligidan ushlanadi. */
  month: string;
  deadline: string;
  redeadline: string | null;
  failedAt: string;
  createdAt: string;
  status: "kuchda" | "bekor";
  cancelReason: string;
  cancelledBy: string;
  cancelledAt: string | null;
  /** Oylik limiti ichida ushlanadigani — `penalties` dagi yozuv summasi. */
  held: number;
  /** Moliya → Jarima (`penalties`) dagi yozuv; ushlanadigan summa 0 bo'lsa `null`. */
  penaltyId: number | null;
}

export interface StaffTaskViewer extends StaffTaskViewerInfo {
  userId: string;
}

// ── Kim ko'rmoqda ────────────────────────────────────────────────────

export async function loadViewer(db: Db, me: CurrentUser): Promise<StaffTaskViewer> {
  const isAdmin = me.role === "admin";
  const manager = isAdmin || hasSectionPermission("/tasks", me.permissions);
  const employeeId = me.hrEmployeeId;
  const name = (await employeeNameById(db, employeeId)) || String(me.fullName ?? "").trim();
  if (isAdmin) return { role: "direktor", userId: me.id, employeeId, name, branchIds: null };
  if (!manager) return { role: "xodim", userId: me.id, employeeId, name, branchIds: [] };
  // Filial ro'yxati navbardagi qamrov bilan bir xil qoidada
  // (lib/branchScope.ts → loadBranchScope): biriktirilmagan xodim —
  // birinchi filial, aks holda uni bo'limdan uzib qo'yardik.
  const [all, mine] = await Promise.all([allBranchIds(db), employeeBranchIds(db, employeeId)]);
  const allowed = mine.filter((id) => all.includes(id));
  return { role: "rahbar", userId: me.id, employeeId, name, branchIds: allowed.length ? allowed : [all[0] ?? 1] };
}

export function viewerInfo(v: StaffTaskViewer): StaffTaskViewerInfo {
  return { role: v.role, name: v.name, employeeId: v.employeeId, branchIds: v.branchIds };
}

/** Ko'rinadigan topshiriqlar sharti — `canSee` bilan AYNAN bir xil. */
export function taskScope(v: StaffTaskViewer): Filter<StaffTaskDoc> {
  if (v.role === "direktor") return {};
  const mine: Filter<StaffTaskDoc>[] = v.employeeId !== null ? [{ employeeId: v.employeeId }] : [];
  if (v.role === "rahbar") {
    return { $or: [{ branchId: { $in: v.branchIds ?? [] } }, { "createdBy.userId": v.userId }, ...mine] };
  }
  return mine[0] ?? { id: -1 };
}

export function isAssignee(v: StaffTaskViewer, t: Pick<StaffTaskDoc, "employeeId">): boolean {
  return v.employeeId !== null && t.employeeId === v.employeeId;
}

export function canSee(v: StaffTaskViewer, t: Pick<StaffTaskDoc, "employeeId" | "branchId" | "createdBy">): boolean {
  if (v.role === "direktor" || isAssignee(v, t)) return true;
  if (v.role === "rahbar") return (v.branchIds ?? []).includes(t.branchId) || t.createdBy?.userId === v.userId;
  return false;
}

/** Tasdiqlash / qaytarish / tahrirlash / bekor qilish. */
export function canManage(v: StaffTaskViewer, t: Pick<StaffTaskDoc, "employeeId" | "branchId" | "createdBy">): boolean {
  if (v.role === "xodim" || isAssignee(v, t)) return false;
  if (v.role === "direktor") return true;
  return (v.branchIds ?? []).includes(t.branchId) || t.createdBy?.userId === v.userId;
}

/** Jarimalar qamrovi — topshiriq qamrovining o'zi (filial yoki o'zimniki). */
export function fineScope(v: StaffTaskViewer): Filter<StaffFineDoc> {
  if (v.role === "direktor") return {};
  const mine: Filter<StaffFineDoc>[] = v.employeeId !== null ? [{ employeeId: v.employeeId }] : [];
  if (v.role === "rahbar") return { $or: [{ branchId: { $in: v.branchIds ?? [] } }, ...mine] };
  return mine[0] ?? { id: -1 };
}

// ── Ma'lumotnomalar ──────────────────────────────────────────────────

export async function loadBranches(db: Db): Promise<StaffTaskBranch[]> {
  const rows = await db.collection("branches").find({}, { projection: { _id: 0, id: 1, name: 1 } }).sort({ id: 1 }).toArray();
  return rows
    .map((r) => ({ id: Number(r.id), name: String(r.name ?? `Filial ${r.id}`) }))
    .filter((b) => Number.isFinite(b.id));
}

interface EmployeeRow {
  id: number;
  name: string;
  turi?: string;
  degree?: string;
  branchIds?: number[];
  payrollBranchId?: number;
}

/**
 * Topshiriq berish mumkin bo'lgan xodimlar — FAOL (`archReason` bo'sh).
 * Direktor — hammasi; rahbar — o'z filiallarida ishlaydiganlar; xodim —
 * hech kim (u topshiriq bermaydi).
 *
 * `branchId` — guruhlash va yangi topshiriqning filiali: rahbarda o'z
 * filiallaridan biri (xodim ikki filialda ishlasa ham topshiriq rahbar
 * qamrovida qolsin), direktorda — xodimning oylik filiali.
 */
export async function loadPickableEmployees(db: Db, v: StaffTaskViewer): Promise<StaffTaskEmployee[]> {
  if (v.role === "xodim") return [];
  const [all, rows] = await Promise.all([
    allBranchIds(db),
    db.collection<EmployeeRow>("hr_employees")
      .find({ archReason: { $in: ["", null] } } as Filter<EmployeeRow>, {
        projection: { _id: 0, id: 1, name: 1, turi: 1, degree: 1, branchIds: 1, payrollBranchId: 1 },
      })
      .toArray(),
  ]);
  const out: StaffTaskEmployee[] = [];
  for (const r of rows) {
    const id = Number(r.id);
    const name = String(r.name ?? "").trim();
    if (!Number.isFinite(id) || !name) continue;
    const own = (Array.isArray(r.branchIds) ? r.branchIds : []).map(Number).filter((b) => all.includes(b));
    const ids = own.length ? own : [all[0] ?? 1];
    const payroll = Number(r.payrollBranchId);
    const primary = ids.includes(payroll) ? payroll : ids[0];
    let branchId = primary;
    if (v.role === "rahbar") {
      const inter = ids.filter((b) => (v.branchIds ?? []).includes(b));
      if (!inter.length) continue;
      branchId = inter.includes(primary) ? primary : inter[0];
    }
    const degree = String(r.degree ?? "").trim();
    const turi = String(r.turi ?? "");
    const pos = degree || (ROLE_LABELS as Record<string, string>)[turi] || "";
    out.push({ id, name, pos, branchId });
  }
  return out.sort((a, b) => a.name.localeCompare(b.name));
}

export async function loadSettings(db: Db): Promise<StaffTaskSettings> {
  const doc = await db.collection("settings").findOne({ key: SETTINGS_KEY }, { projection: { _id: 0, values: 1 } });
  return normalizeSettings(doc?.values);
}

export async function saveSettings(db: Db, s: StaffTaskSettings): Promise<void> {
  await db.collection("settings").updateOne({ key: SETTINGS_KEY }, { $set: { key: SETTINGS_KEY, values: s } }, { upsert: true });
}

export function fineFor(settings: StaffTaskSettings, priority: StaffTaskPriority): number {
  return settings.fines[String(priority)] ?? 0;
}

// ── Id ajratish ──────────────────────────────────────────────────────

function isDupKey(e: unknown, field: string): boolean {
  const err = e as { code?: number; keyPattern?: Record<string, unknown>; message?: string };
  if (err?.code !== 11000) return false;
  if (err.keyPattern) return field in err.keyPattern;
  return String(err.message ?? "").includes(`${field}_`);
}

/**
 * Keyingi `id` bilan qo'shadi — loyihadagi "eng kattasi + 1" qolipi, lekin
 * `id` unique indeksi to'qnashuvni ushlasa QAYTA urinadi: bir vaqtda ikki
 * so'rov (masalan ikki jarima) bir xil raqamga urinishi mumkin.
 * Boshqa unique maydon to'qnashsa xato tashqariga otiladi.
 */
export async function insertWithNextId<T extends { id: number }>(db: Db, col: string, build: (id: number) => T): Promise<T> {
  for (let attempt = 0; attempt < 8; attempt++) {
    const [last] = await db.collection(col).find({}, { projection: { _id: 0, id: 1 } }).sort({ id: -1 }).limit(1).toArray();
    const doc = build((Number(last?.id) || 0) + 1 + attempt);
    try {
      await db.collection(col).insertOne({ ...doc } as Document);
      return doc;
    } catch (e) {
      if (isDupKey(e, "id")) continue;
      throw e;
    }
  }
  throw new Error("Yozuv raqamini ajratib bo'lmadi — qayta urinib ko'ring");
}

// ── Oylik bilan bog'lanish ───────────────────────────────────────────

/**
 * Oyligi CHIQARILGAN (Moliya → Oylik chiqarish) oylar — xodim kesimida.
 * Bunday oyning jarimasini bekor qilib bo'lmaydi: hisob-kitob allaqachon
 * qilingan. Eski, xodim ro'yxatisiz chiqarish butun oyni yopgan deb
 * hisoblanadi (ehtiyot tomonga).
 */
export async function loadClosedMonths(db: Db): Promise<(employeeId: number, month: string) => boolean> {
  // «Faqat karta» chiqarish oyni yopmaydi — naqd qismi hali berilmagan
  // (lib/salary.ts → SalaryRun.kind).
  const runs = await db
    .collection("salary_runs")
    .find({ month: { $type: "string" }, ...CLOSING_SALARY_RUN }, { projection: { _id: 0, month: 1, "items.employeeId": 1 } })
    .toArray();
  const byMonth = new Map<string, Set<number> | "all">();
  for (const r of runs) {
    const m = String(r.month);
    if (byMonth.get(m) === "all") continue;
    if (!Array.isArray(r.items)) {
      byMonth.set(m, "all");
      continue;
    }
    const set = (byMonth.get(m) as Set<number> | undefined) ?? new Set<number>();
    for (const it of r.items as { employeeId?: unknown }[]) {
      const id = Number(it?.employeeId);
      if (Number.isFinite(id)) set.add(id);
    }
    byMonth.set(m, set);
  }
  return (employeeId, month) => {
    const e = byMonth.get(month);
    return e === "all" || (e instanceof Set && e.has(employeeId));
  };
}

/** Oylik (payroll) jarimani `createdAt` oyiga qarab oladi — "DD.MM.YYYY HH:mm". */
function penaltyStamp(iso: string): string {
  const d = toUz(new Date(iso));
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getDate())}.${p(d.getMonth() + 1)}.${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

function okladLimit(oklad: number, settings: StaffTaskSettings): number {
  return oklad > 0 ? Math.round((oklad * settings.limitPercent) / 100) : Infinity;
}

export async function okladOf(db: Db, employeeId: number): Promise<number> {
  const emp = await db
    .collection("hr_employees")
    .findOne({ id: employeeId }, { projection: { _id: 0, branchAssignments: 1 } });
  return emp ? fixedSalaryOf(emp as { branchAssignments?: EmployeeBranchAssignment[] }) : 0;
}

/**
 * Moliya → Jarima dagi yozuvni jarima holatiga moslaydi va uning id'sini
 * qaytaradi (`null` — yozuv yo'q va kerak ham emas).
 *
 * Oylik (lib/payrollSources.ts) `penalties` dan bekor qilinmagan yozuvlarni
 * `createdAt` oyi bo'yicha ayiradi — ya'ni jarima oylikka SHU YERDAN tushadi.
 * Yozuv O'CHIRILMAYDI (penalties — audit-log): ushlanmaydigan bo'lsa
 * "cancelled" ga o'tadi, keyin yana ushlanadigan bo'lsa qaytib faollashadi.
 * Qo'lda bekor qilish esa bloklangan (app/api/penalties/[id]) — aks holda
 * ikki bo'lim bir-biriga zid bo'lib qolardi.
 */
async function reconcilePenalty(db: Db, f: StaffFineDoc, held: number): Promise<number | null> {
  const pen = db.collection("penalties");
  const find = () => pen.findOne({ "source.kind": "staff_task", "source.fineId": f.id });
  const apply = async (existing: WithId<Document>) => {
    const reason = f.status === "bekor"
      ? `Topshiriq jarimasi bekor qilindi: ${f.cancelReason}`
      : "Oylik jarima limitidan oshdi — ushlanmaydi";
    const want = held > 0 ? { amount: held, status: "", reason: "" } : { status: "cancelled", reason };
    const same = held > 0
      ? Number(existing.amount) === held && String(existing.status ?? "") === ""
      : existing.status === "cancelled" && existing.reason === reason;
    if (!same) await pen.updateOne({ _id: existing._id }, { $set: want });
    return Number(existing.id);
  };

  const existing = await find();
  if (existing) return apply(existing);
  if (held <= 0) return null;

  // Jarima oyiga tushishi shart: yopilgan oydan ko'chirilgan jarima
  // (createFine) o'z `createdAt` iga ko'ra joriy oyga yoziladi.
  const at = uzMonthOf(ms(f.failedAt)) === f.month ? f.failedAt : f.createdAt;
  try {
    const doc = await insertWithNextId(db, "penalties", (id) => ({
      id,
      type: "employee",
      cashboxId: null,
      recipientName: f.employeeName,
      before: null,
      amount: held,
      after: null,
      note: `Topshiriq bajarilmadi: «${f.taskTitle}» (muhimlik ${f.priority})`,
      reason: "",
      status: "",
      image: "",
      createdAt: penaltyStamp(at),
      source: { kind: "staff_task", taskId: f.taskId, fineId: f.id },
    }));
    return doc.id;
  } catch (e) {
    // Parallel sinxron allaqachon yozgan (unique `source.fineId`).
    if (isDupKey(e, "source.fineId")) {
      const again = await find();
      if (again) return apply(again);
    }
    throw e;
  }
}

/**
 * Xodimning bir oydagi jarimalarini oylik limiti bo'yicha qayta taqsimlaydi
 * va Moliya → Jarima yozuvlarini shunga moslaydi.
 *
 * Limit — okladning `limitPercent` foizi; jarimalar vaqt tartibida
 * ushlanadi, limitdan oshgan qismi tarixda qoladi, ushlanmaydi. Oklad
 * sozlanmagan (foizli) xodimda limitni hisoblab bo'lmaydi — jarima to'liq
 * ushlanadi (jadvalda "limit yo'q" deb ko'rinadi).
 */
export async function syncFinePenalties(db: Db, employeeId: number, month: string): Promise<void> {
  const [settings, oklad] = await Promise.all([loadSettings(db), okladOf(db, employeeId)]);
  const cap = okladLimit(oklad, settings);
  const col = db.collection<StaffFineDoc>(FINES_COL);
  const fines = await col.find({ employeeId, month }).sort({ failedAt: 1, id: 1 }).toArray();
  let sum = 0;
  for (const f of fines) {
    const held = f.status === "kuchda" ? Math.max(0, Math.min(f.amount, cap - sum)) : 0;
    sum += held;
    const penaltyId = await reconcilePenalty(db, f, held);
    if (f.held !== held || (f.penaltyId ?? null) !== penaltyId) {
      await col.updateOne({ id: f.id }, { $set: { held, penaltyId } });
    }
  }
}

/**
 * Bajarilmagan topshiriqqa jarima yozadi (bir topshiriqqa bitta — unique
 * `taskId`). Summa topshiriqqa berilgan paytda yozib olingan `fineAmount`.
 *
 * Oy — bajarilmagan lahzaning oyi. Lekin o'sha oyning oyligi allaqachon
 * chiqarilgan bo'lsa (avtomatika kech ishlagan: kechasi hech kim kirmagan),
 * jarima JORIY oyga tushadi — yopilgan hisobga orqadan qo'shilmasin.
 */
async function createFine(db: Db, t: StaffTaskDoc, nowMs: number): Promise<StaffFineDoc | null> {
  if (!(t.fineAmount > 0) || !t.failedAt) return null;
  const closed = await loadClosedMonths(db);
  let month = uzMonthOf(ms(t.failedAt));
  if (closed(t.employeeId, month)) month = uzMonthOf(nowMs);
  const nowIso = new Date(nowMs).toISOString();
  let fine: StaffFineDoc;
  try {
    fine = await insertWithNextId<StaffFineDoc>(db, FINES_COL, (id) => ({
      id,
      taskId: t.id,
      taskTitle: t.title,
      employeeId: t.employeeId,
      employeeName: t.employeeName,
      branchId: t.branchId,
      priority: t.priority,
      amount: t.fineAmount,
      month,
      deadline: t.deadline,
      redeadline: t.redeadline,
      failedAt: t.failedAt as string,
      createdAt: nowIso,
      status: "kuchda",
      cancelReason: "",
      cancelledBy: "",
      cancelledAt: null,
      held: 0,
      penaltyId: null,
    }));
  } catch (e) {
    if (isDupKey(e, "taskId")) return db.collection<StaffFineDoc>(FINES_COL).findOne({ taskId: t.id });
    throw e;
  }
  await syncFinePenalties(db, fine.employeeId, fine.month);
  return db.collection<StaffFineDoc>(FINES_COL).findOne({ id: fine.id });
}

// ── Avtomatik o'tishlar ──────────────────────────────────────────────

/**
 * Muddat → qayta muddat → «Bajarilmadi» + jarima.
 *
 * CRON YO'Q — o'tish "dangasa": ro'yxat, batafsil oyna, har qanday amal va
 * navbardagi qo'ng'iroq (har 60 soniyada, har bir kirgan foydalanuvchida)
 * shu funksiyani chaqiradi. Kimdir tizimda bo'lsa o'tish bir daqiqa ichida
 * bo'ladi; hech kim bo'lmasa — birinchi kirishda, lekin tarix va jarima
 * oyi HAQIQIY lahza (deadline / qayta muddat) bilan yoziladi.
 *
 * Har o'tish holat sharti bilan (`status` + muddat) yangilanadi — ikki
 * jarayon bir vaqtda ishlasa ham topshiriq ikki marta o'tmaydi, jarima esa
 * `taskId` unique indeksi bilan qo'riqlanadi.
 */
const AUTO_THROTTLE_MS = 20_000;
let lastAutoRun = 0;
let autoRunning: Promise<number> | null = null;

export function runAutomation(db: Db, opts: { force?: boolean } = {}): Promise<number> {
  const now = Date.now();
  if (autoRunning) return autoRunning;
  if (!opts.force && now - lastAutoRun < AUTO_THROTTLE_MS) return Promise.resolve(0);
  lastAutoRun = now;
  autoRunning = automate(db, now).finally(() => {
    autoRunning = null;
  });
  return autoRunning;
}

async function automate(db: Db, nowMs: number): Promise<number> {
  const col = db.collection<StaffTaskDoc>(TASKS_COL);
  const nowIso = new Date(nowMs).toISOString();
  let n = 0;

  const due = await col
    .find({ status: { $in: ["yangi", "qaytarildi"] }, deadline: { $lt: nowIso } }, { projection: { _id: 0, id: 1, status: 1, deadline: 1 } })
    .limit(500)
    .toArray();
  if (due.length) {
    const settings = await loadSettings(db);
    for (const t of due) {
      const redeadline = new Date(ms(t.deadline) + settings.graceHours * HOUR_MS).toISOString();
      const ev: StaffTaskEvent = {
        at: t.deadline,
        kind: "overdue",
        by: "",
        byUserId: null,
        deadline: redeadline,
        graceHours: settings.graceHours,
        loggedAt: nowIso,
      };
      const r = await col.updateOne(
        { id: t.id, status: t.status, deadline: t.deadline },
        { $set: { status: "muddati_otdi", redeadline, updatedAt: nowIso }, $push: { history: ev } },
      );
      n += r.modifiedCount;
    }
  }

  const failing = await col
    .find({ status: "muddati_otdi", redeadline: { $lt: nowIso } }, { projection: { _id: 0, id: 1, redeadline: 1 } })
    .limit(500)
    .toArray();
  for (const t of failing) {
    const doc = await col.findOneAndUpdate(
      { id: t.id, status: "muddati_otdi", redeadline: t.redeadline },
      { $set: { status: "bajarilmadi", failedAt: t.redeadline, updatedAt: nowIso } },
      { returnDocument: "after", projection: { _id: 0 } },
    );
    if (!doc) continue;
    const fine = await createFine(db, doc as StaffTaskDoc, nowMs);
    const ev: StaffTaskEvent = {
      at: doc.failedAt as string,
      kind: "failed",
      by: "",
      byUserId: null,
      amount: fine?.amount ?? 0,
      month: fine?.month,
      loggedAt: nowIso,
    };
    await col.updateOne({ id: doc.id }, { $push: { history: ev } });
    n++;
  }
  return n;
}

// ── Qo'ng'iroq va yon panel ──────────────────────────────────────────

/** Ijrochiga ko'rsatiladigan hodisalar (o'z harakatidan tashqari). */
const ASSIGNEE_NOTIF: Partial<Record<StaffTaskEvent["kind"], string>> = {
  created: "Sizga yangi topshiriq",
  returned: "Topshiriq qaytarildi",
  approved: "Topshiriq tasdiqlandi",
  overdue: "Topshiriq muddati o'tdi",
  failed: "Topshiriq bajarilmadi — jarima",
  cancelled: "Topshiriq bekor qilindi",
  edited: "Topshiriq tahrirlandi",
  fine_cancelled: "Jarima bekor qilindi",
};

/** Rahbarga — xodim natija topshirdi yoki muddat buzildi. */
const MANAGER_NOTIF: Partial<Record<StaffTaskEvent["kind"], string>> = {
  done: "«Bajardim» — tasdiq kutilmoqda",
  overdue: "Xodim topshirig'i muddati o'tdi",
  failed: "Xodim topshirig'i bajarilmadi",
};

/**
 * Navbardagi qo'ng'iroq uchun topshiriq hodisalari (app/api/notifications).
 *
 * Alohida `notifications` kolleksiyasi YO'Q — o'sha route'ning qoidasi
 * bilan: qator — topshiriq TARIXINING proyeksiyasi. Yaqinda o'zgargan
 * (`updatedAt`) topshiriqlar olinadi va tarixidan oynaga tushgan hodisalar
 * shu odamga tegishli bo'lsa chiziladi. Havola topshiriqni ochadi.
 */
export async function loadTaskNotifications(
  db: Db,
  me: CurrentUser,
  sinceMs: number,
  limit: number,
): Promise<NotifItem[]> {
  await runAutomation(db);
  const v = await loadViewer(db, me);
  const sinceIso = new Date(sinceMs).toISOString();
  const docs = await db
    .collection<StaffTaskDoc>(TASKS_COL)
    .find(
      { $and: [taskScope(v), { updatedAt: { $gte: sinceIso } }] },
      { projection: { _id: 0, id: 1, title: 1, employeeId: 1, employeeName: 1, branchId: 1, createdBy: 1, history: 1 } },
    )
    .sort({ updatedAt: -1 })
    .limit(limit)
    .toArray();
  const out: NotifItem[] = [];
  for (const d of docs) {
    const mine = isAssignee(v, d);
    const manage = canManage(v, d);
    (d.history ?? []).forEach((e, i) => {
      if (e.byUserId && e.byUserId === v.userId) return;
      const at = e.loggedAt && e.loggedAt > e.at ? e.loggedAt : e.at;
      if (!at || at < sinceIso) return;
      const title = mine ? ASSIGNEE_NOTIF[e.kind] : manage ? MANAGER_NOTIF[e.kind] : undefined;
      if (!title) return;
      out.push({
        id: `stask:${d.id}:${i}`,
        kind: "task",
        title,
        body: mine ? `«${d.title}»` : `«${d.title}» — ${d.employeeName}`,
        meta: null,
        at,
        href: `/tasks?open=${d.id}`,
        unread: false,
      });
    });
  }
  return out.slice(0, limit);
}

/**
 * Yon paneldagi "Topshiriqlar" nishoni — HARAKAT KUTAYOTGANLAR soni:
 * o'zimga berilgan faol topshiriqlar + (rahbar bo'lsam) tasdiqimni
 * kutayotganlar. Sahifa hammaga ochiq, ya'ni nishon ham hammada.
 */
export async function taskBadgeCount(db: Db, me: CurrentUser): Promise<number> {
  const v = await loadViewer(db, me);
  const col = db.collection<StaffTaskDoc>(TASKS_COL);
  const [own, waiting] = await Promise.all([
    v.employeeId !== null
      ? col.countDocuments({ employeeId: v.employeeId, status: { $in: [...ACTIVE_STATUSES] } })
      : Promise.resolve(0),
    v.role !== "xodim"
      ? col.countDocuments({
          $and: [taskScope(v), { status: "tasdiq_kutilmoqda" }, ...(v.employeeId !== null ? [{ employeeId: { $ne: v.employeeId } }] : [])],
        })
      : Promise.resolve(0),
  ]);
  return own + waiting;
}

// ── Mijozga berish ───────────────────────────────────────────────────

function fileRef(f: StaffTaskFile | null | undefined): StaffTaskFileRef | null {
  if (!f || typeof f !== "object") return null;
  return { name: String(f.name ?? ""), type: String(f.type ?? ""), size: Number(f.size) || 0 };
}

export function fineInfo(f: StaffFineDoc | null | undefined, closed: (e: number, m: string) => boolean): StaffTaskFineInfo | null {
  if (!f) return null;
  return {
    id: f.id,
    amount: f.amount,
    held: Number(f.held) || 0,
    month: f.month,
    status: f.status,
    closed: closed(f.employeeId, f.month),
    cancelReason: f.cancelReason ?? "",
    cancelledBy: f.cancelledBy ?? "",
    cancelledAt: f.cancelledAt ?? null,
  };
}

export function toClientTask(
  d: StaffTaskDoc,
  v: StaffTaskViewer,
  extra: { batchSize?: number; fine?: StaffTaskFineInfo | null; withHistory?: boolean } = {},
): StaffTask {
  return {
    id: d.id,
    batchId: d.batchId,
    batchSize: extra.batchSize ?? 1,
    title: d.title,
    desc: d.desc ?? "",
    employeeId: d.employeeId,
    employeeName: d.employeeName,
    branchId: d.branchId,
    priority: isPriority(d.priority) ? d.priority : 3,
    fineAmount: Number(d.fineAmount) || 0,
    deadline: d.deadline,
    originalDeadline: d.originalDeadline ?? d.deadline,
    redeadline: d.redeadline ?? null,
    attachments: (Array.isArray(d.attachments) ? d.attachments : []).map((f) => fileRef(f)).filter((f): f is StaffTaskFileRef => !!f),
    link: d.link ?? "",
    seenAt: d.seenAt ?? null,
    doneAt: d.doneAt ?? null,
    doneNote: d.doneNote ?? "",
    resultLink: d.resultLink ?? "",
    resultFile: fileRef(d.resultFile),
    isLate: !!d.isLate,
    status: d.status,
    returnCount: Number(d.returnCount) || 0,
    cancelReason: d.cancelReason ?? "",
    completedAt: d.completedAt ?? null,
    completedLate: !!d.completedLate,
    failedAt: d.failedAt ?? null,
    createdByName: d.createdBy?.name ?? "",
    createdAt: d.createdAt,
    history: extra.withHistory ? (Array.isArray(d.history) ? d.history : []) : undefined,
    fine: extra.fine ?? null,
    isMine: isAssignee(v, d),
    canManage: canManage(v, d),
  };
}

/** Bir to'plamdagi topshiriqlar soni — "3 xodimga berilgan". */
export async function batchSizes(db: Db, batchIds: number[]): Promise<Map<number, number>> {
  if (!batchIds.length) return new Map();
  const rows = await db
    .collection(TASKS_COL)
    .aggregate<{ _id: number; n: number }>([{ $match: { batchId: { $in: [...new Set(batchIds)] } } }, { $group: { _id: "$batchId", n: { $sum: 1 } } }])
    .toArray();
  return new Map(rows.map((r) => [Number(r._id), r.n]));
}

// ── Kiruvchi qiymatlarni tekshirish ──────────────────────────────────

export const TITLE_MAX = 200;
export const TEXT_MAX = 4000;
export const LINK_MAX = 500;
export const FILES_MAX = 10;

export function cleanText(v: unknown, max: number): string {
  return typeof v === "string" ? v.trim().slice(0, max) : "";
}

/** Havola — faqat http(s). Bo'sh satr ham yaroqli ("havola yo'q"). */
export function cleanLink(v: unknown): string | null {
  const s = cleanText(v, LINK_MAX);
  if (!s) return "";
  try {
    const u = new URL(s);
    return u.protocol === "http:" || u.protocol === "https:" ? u.toString() : null;
  } catch {
    return null;
  }
}

/**
 * Mijoz yuborgan fayl — faqat BIZNING yuklash route'imiz qaytargan
 * Cloudinary manzili (o'z bulutimiz, `topshiriqlar/` papkasi). Aks holda
 * boshqa papkadagi hujjatni (nomzod CV'si) biriktirib, fayl proksisi
 * orqali o'qib olish mumkin bo'lardi.
 */
export function cleanFile(v: unknown): StaffTaskFile | null {
  if (!v || typeof v !== "object") return null;
  const o = v as Record<string, unknown>;
  const url = typeof o.url === "string" ? o.url : "";
  const ref = parseCloudinaryUrl(url);
  const cfg = cloudinaryConfig();
  if (!ref || !cfg || !url.startsWith(`https://res.cloudinary.com/${cfg.cloudName}/`)) return null;
  if (!ref.publicId.startsWith(`${TASK_FILES_FOLDER}/`)) return null;
  return {
    name: cleanText(o.name, 200) || "fayl",
    url,
    type: cleanText(o.type, 100),
    size: Math.max(0, Math.round(Number(o.size) || 0)),
  };
}

export function cleanFiles(v: unknown): StaffTaskFile[] | null {
  if (v === undefined) return [];
  if (!Array.isArray(v) || v.length > FILES_MAX) return null;
  const out: StaffTaskFile[] = [];
  for (const it of v) {
    const f = cleanFile(it);
    if (!f) return null;
    out.push(f);
  }
  return out;
}

/** Muddat — ISO lahza, hozirdan keyin (1 daqiqa zaxira bilan). */
export function cleanDeadline(v: unknown, nowMs: number): string | null {
  const t = typeof v === "string" ? Date.parse(v) : NaN;
  if (!Number.isFinite(t) || t <= nowMs + 60_000) return null;
  return new Date(t).toISOString();
}

export function cleanPriority(v: unknown): StaffTaskPriority | null {
  const n = Number(v);
  return PRIORITIES.includes(n as StaffTaskPriority) ? (n as StaffTaskPriority) : null;
}

export const isActiveStatus = (s: StaffTaskStatus) => ACTIVE_STATUSES.includes(s);
