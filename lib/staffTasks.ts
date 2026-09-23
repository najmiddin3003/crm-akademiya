import { uzDateIso, uzTimeHm } from "./uzTime";

// XODIM TOPSHIRIQLARI (/tasks) — mijoz va server uchun UMUMIY tiplar va sof
// yordamchilar. Bu fayl `mongodb` ni import QILMAYDI.
//
// Manba — foydalanuvchining prototipi ("topshiriqlar-prototip v2",
// 23.09.2026): rahbar xodimga muddat va muhimlik (1–5) bilan topshiriq
// beradi; xodim «Bajardim» bosadi, rahbar tasdiqlaydi yoki qaytaradi.
// Muddat o'tsa bir martalik qayta muddat (sukut 24 soat) beriladi, u ham
// o'tsa topshiriq «Bajarilmadi» bo'ladi va jarima Oylikka tushadi
// (lib/staffTasksServer.ts → Moliya → Jarima).
//
// ESKI `tasks` kolleksiyasi BILAN ARALASHMAYDI (qaror 23.09.2026): u
// o'quvchiga bog'langan vazifalar — o'quvchi profilidagi «Vazifa» tabi va
// navbardagi xodim oynasi o'shani o'qiydi. Bu yerdagisi — `staff_tasks`.
//
// VAQT: bazada hamma lahza `toISOString()` shaklida (UTC). Ko'rsatish va
// kun/oy chegarasi esa Toshkent taqvimida (lib/uzTime.ts) — server ham,
// chet eldagi brauzer ham bir xil javob bersin.

export type StaffTaskStatus =
  | "yangi"
  | "tasdiq_kutilmoqda"
  | "qaytarildi"
  | "muddati_otdi"
  | "yakunlandi"
  | "bajarilmadi"
  | "bekor";

export const STATUS_LABEL: Record<StaffTaskStatus, string> = {
  yangi: "Yangi",
  tasdiq_kutilmoqda: "Tasdiq kutilmoqda",
  qaytarildi: "Qaytarildi",
  muddati_otdi: "Muddati o'tdi",
  yakunlandi: "Yakunlandi",
  bajarilmadi: "Bajarilmadi",
  bekor: "Bekor qilindi",
};

export const STATUSES = Object.keys(STATUS_LABEL) as StaffTaskStatus[];

export function isStaffTaskStatus(v: unknown): v is StaffTaskStatus {
  return typeof v === "string" && v in STATUS_LABEL;
}

/** Xodim hali BAJARISHI kerak bo'lganlar — «Bajardim» shu holatlarda ochiq. */
export const ACTIVE_STATUSES: readonly StaffTaskStatus[] = ["yangi", "qaytarildi", "muddati_otdi"];
/** Yopilmagan — bekor qilish shu holatlarda mumkin. */
export const OPEN_STATUSES: readonly StaffTaskStatus[] = [...ACTIVE_STATUSES, "tasdiq_kutilmoqda"];

export const isActive = (s: StaffTaskStatus) => ACTIVE_STATUSES.includes(s);
export const isOpen = (s: StaffTaskStatus) => OPEN_STATUSES.includes(s);

/**
 * Ro'yxat tartibi: avval jarimaga yaqinlari (muddati o'tgan), keyin
 * rahbarning navbatidagisi (tasdiq kutilmoqda), keyin ish jarayonidagilar,
 * yopilganlar oxirida. Bir darajada — yaqin muddat oldin, yopilganlarda
 * esa yangisi oldin.
 */
export const STATUS_RANK: Record<StaffTaskStatus, number> = {
  muddati_otdi: 0,
  tasdiq_kutilmoqda: 1,
  yangi: 2,
  qaytarildi: 2,
  bajarilmadi: 3,
  yakunlandi: 4,
  bekor: 5,
};

/** Holat rangi — tasks.css dagi `stk-tone-*` klasslari. */
export type Tone = "pri" | "vio" | "amber" | "hot" | "ok" | "bad" | "gray";

export const STATUS_TONE: Record<StaffTaskStatus, Tone> = {
  yangi: "pri",
  tasdiq_kutilmoqda: "vio",
  qaytarildi: "amber",
  muddati_otdi: "hot",
  yakunlandi: "ok",
  bajarilmadi: "bad",
  bekor: "gray",
};

export const PRIORITIES = [1, 2, 3, 4, 5] as const;
export type StaffTaskPriority = (typeof PRIORITIES)[number];

export function isPriority(v: unknown): v is StaffTaskPriority {
  return typeof v === "number" && PRIORITIES.includes(v as StaffTaskPriority);
}

// ── Sozlamalar ───────────────────────────────────────────────────────

export interface StaffTaskSettings {
  /** Muhimlik → bajarilmasa yoziladigan jarima (so'm). Kalit "1".."5". */
  fines: Record<string, number>;
  /** Muddat o'tgach beriladigan BIR MARTALIK qayta muddat, soat. */
  graceHours: number;
  /**
   * Bir oyda ushlanadigan jarimaning chegarasi — okladning foizi
   * (MK 312-modda: 30%, ichki tartib bilan 50% gacha).
   */
  limitPercent: number;
}

export const DEFAULT_SETTINGS: StaffTaskSettings = {
  fines: { "1": 10000, "2": 20000, "3": 30000, "4": 40000, "5": 50000 },
  graceHours: 24,
  limitPercent: 30,
};

/** Bazadan/mijozdan kelgan qiymatni yaroqli sozlamaga keltiradi. */
export function normalizeSettings(raw: unknown): StaffTaskSettings {
  const o = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const finesRaw = o.fines && typeof o.fines === "object" ? (o.fines as Record<string, unknown>) : {};
  const fines: Record<string, number> = {};
  for (const p of PRIORITIES) {
    const n = Number(finesRaw[String(p)]);
    fines[String(p)] = Number.isFinite(n) && n >= 0 ? Math.round(n) : DEFAULT_SETTINGS.fines[String(p)];
  }
  const grace = Number(o.graceHours);
  const limit = Number(o.limitPercent);
  return {
    fines,
    graceHours: Number.isFinite(grace) && grace >= 1 && grace <= 24 * 14 ? Math.round(grace) : DEFAULT_SETTINGS.graceHours,
    limitPercent: Number.isFinite(limit) && limit >= 0 && limit <= 100 ? Math.round(limit) : DEFAULT_SETTINGS.limitPercent,
  };
}

// ── Hujjat shakllari ─────────────────────────────────────────────────

export interface StaffTaskFile {
  name: string;
  /** Cloudinary `secure_url` — mijozga BERILMAYDI, fayl server orqali oqadi. */
  url: string;
  type: string;
  size: number;
}

/** Mijozga ketadigan fayl — manzilsiz; ochish `/api/staff-tasks/:id/file`. */
export interface StaffTaskFileRef {
  name: string;
  type: string;
  size: number;
}

export type StaffTaskEventKind =
  | "created"
  | "seen"
  | "done"
  | "approved"
  | "returned"
  | "overdue"
  | "failed"
  | "cancelled"
  | "edited"
  | "fine_cancelled";

export const EVENT_LABEL: Record<StaffTaskEventKind, string> = {
  created: "Topshiriq berildi",
  seen: "Ko'rildi",
  done: "Bajardim",
  approved: "Tasdiqlandi",
  returned: "Qaytarildi",
  overdue: "Muddati o'tdi",
  failed: "Bajarilmadi",
  cancelled: "Bekor qilindi",
  edited: "Tahrirlandi",
  fine_cancelled: "Jarima bekor qilindi",
};

/** Tahrirlashda nima o'zgargani — tarix qatorida sanab o'tiladi. */
export interface StaffTaskChange {
  field: "deadline" | "priority" | "title" | "desc" | "link" | "files" | "grace";
  from?: string | number;
  to?: string | number;
}

/**
 * Tarix yozuvi. MATN EMAS, TUZILMA: sarlavha va izoh mijozda tanlangan
 * tilda yig'iladi (t()). Faqat `text` — foydalanuvchi yozgan izoh/sabab —
 * o'z holicha ko'rsatiladi.
 */
export interface StaffTaskEvent {
  at: string;
  /**
   * Avtomatik o'tish HAQIQATAN yozilgan lahza. `at` — muddat lahzasi
   * (tarixda shu ko'rinadi), avtomatika esa undan kechroq ishlashi mumkin
   * (lib/staffTasksServer.ts → runAutomation). Bildirishnoma ikkalasining
   * kechrog'ini oladi — aks holda kech yozilgan hodisa "o'qilgan" bo'lib
   * qolardi.
   */
  loggedAt?: string;
  kind: StaffTaskEventKind;
  /** Kim — xodim ismi; tizim (avtomatik o'tish) uchun bo'sh satr. */
  by: string;
  /** `users._id` — bildirishnoma o'z harakatini o'ziga ko'rsatmasin. */
  byUserId: string | null;
  text?: string;
  /** created/returned/edited — muddat; overdue — qayta muddat. */
  deadline?: string;
  priority?: number;
  late?: boolean;
  amount?: number;
  /** "YYYY-MM" — jarima qaysi oy oyligidan. */
  month?: string;
  graceHours?: number;
  changes?: StaffTaskChange[];
}

/** Topshiriqning jarimasi (bor bo'lsa) — mijoz ko'radigan qismi. */
export interface StaffTaskFineInfo {
  id: number;
  amount: number;
  /** Oylikdan HAQIQATAN ushlanadigani (oylik limiti ichida). */
  held: number;
  month: string;
  status: "kuchda" | "bekor";
  /** Shu oyning oyligi chiqarilgan — bekor qilib bo'lmaydi. */
  closed: boolean;
  cancelReason: string;
  cancelledBy: string;
  cancelledAt: string | null;
}

/** Mijozga ketadigan topshiriq. */
export interface StaffTask {
  id: number;
  batchId: number;
  /** Shu topshiriq nechta xodimga birga berilgan (1 — yakka). */
  batchSize: number;
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
  attachments: StaffTaskFileRef[];
  link: string;
  seenAt: string | null;
  doneAt: string | null;
  doneNote: string;
  resultLink: string;
  resultFile: StaffTaskFileRef | null;
  isLate: boolean;
  status: StaffTaskStatus;
  returnCount: number;
  cancelReason: string;
  completedAt: string | null;
  completedLate: boolean;
  failedAt: string | null;
  createdByName: string;
  createdAt: string;
  /** Faqat batafsil so'rovda (GET /api/staff-tasks/:id). */
  history?: StaffTaskEvent[];
  fine: StaffTaskFineInfo | null;
  /** Joriy foydalanuvchi — shu topshiriqning ijrochisi. */
  isMine: boolean;
  /** Joriy foydalanuvchi tasdiqlashi/qaytarishi/tahrirlashi mumkin. */
  canManage: boolean;
}

/** Jarimalar tabi qatori. */
export interface StaffTaskFine extends StaffTaskFineInfo {
  taskId: number;
  taskTitle: string;
  employeeId: number;
  employeeName: string;
  branchId: number;
  priority: number;
  deadline: string;
  redeadline: string | null;
  failedAt: string;
  createdAt: string;
}

/** «Oylik moduliga tushadigan qatorlar» — xodim va oy kesimi. */
export interface StaffFineSummaryRow {
  employeeId: number;
  employeeName: string;
  month: string;
  /** Oklad sozlanmagan bo'lsa `null` — limit qo'llanmaydi (hammasi ushlanadi). */
  oklad: number | null;
  limit: number | null;
  total: number;
  held: number;
  closed: boolean;
}

export interface StaffTaskStatRow {
  employeeId: number;
  employeeName: string;
  branchId: number;
  total: number;
  active: number;
  onTime: number;
  late: number;
  failed: number;
  /** o'z vaqtida ÷ (yakunlangan + bajarilmagan); maxraj 0 bo'lsa `null`. */
  pct: number | null;
  fineTotal: number;
}

export type ViewerRole = "direktor" | "rahbar" | "xodim";

export interface StaffTaskViewerInfo {
  role: ViewerRole;
  name: string;
  employeeId: number | null;
  /** Ko'ra oladigan filiallar; `null` — hammasi (direktor). */
  branchIds: number[] | null;
}

export interface StaffTaskEmployee {
  id: number;
  name: string;
  /** Lavozim yorlig'i (daraja yoki turi). */
  pos: string;
  /** Guruhlash va filial filtri uchun asosiy filial. */
  branchId: number;
}

export interface StaffTaskBranch {
  id: number;
  name: string;
}

/** GET /api/staff-tasks javobi. */
export interface StaffTasksPayload {
  ok: true;
  serverNow: string;
  viewer: StaffTaskViewerInfo;
  branches: StaffTaskBranch[];
  employees: StaffTaskEmployee[];
  settings: StaffTaskSettings;
  tasks: StaffTask[];
}

// ── Vaqt yordamchilari (Toshkent) ────────────────────────────────────

export const HOUR_MS = 3_600_000;
export const DAY_MS = 24 * HOUR_MS;

export function ms(iso: string | null | undefined): number {
  if (!iso) return NaN;
  const t = Date.parse(iso);
  return Number.isFinite(t) ? t : NaN;
}

/** "2026-09" — Toshkent oyi. */
export function uzMonthOf(msValue: number): string {
  return uzDateIso(new Date(msValue)).slice(0, 7);
}

/** Toshkent devor-soati ("2026-09-23", "18:00") → lahza. Yaroqsiz — NaN. */
export function uzWallToMs(date: string, time: string): number {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(time)) return NaN;
  const t = Date.parse(`${date}T${time}:00+05:00`);
  return Number.isFinite(t) ? t : NaN;
}

export function uzDateOf(msValue: number): string {
  return uzDateIso(new Date(msValue));
}

export function uzTimeOf(msValue: number): string {
  return uzTimeHm(new Date(msValue));
}

/** Toshkent kunining boshi (00:00) — lahza. */
export function uzDayStart(msValue: number): number {
  return Date.parse(`${uzDateOf(msValue)}T00:00:00+05:00`);
}

export function sameUzDay(a: number, b: number): boolean {
  return uzDateOf(a) === uzDateOf(b);
}

/**
 * Davomiylik — eng yirik birlikda: "45 daqiqa", "7 soat" (48 soatgacha),
 * "3 kun". Matnni mijoz yig'adi (t() kalitlari birlikka qarab).
 */
export function durParts(delta: number): { n: number; unit: "min" | "hour" | "day" } {
  const a = Math.abs(delta);
  if (a < HOUR_MS) return { n: Math.max(1, Math.round(a / 60_000)), unit: "min" };
  if (a < 48 * HOUR_MS) return { n: Math.round(a / HOUR_MS), unit: "hour" };
  return { n: Math.round(a / DAY_MS), unit: "day" };
}

/**
 * Tezkor muddat tugmalari — faqat hozirdan KEYINGILARI.
 * Soat Toshkent devor-soatida (18:00 — ish kuni oxiri).
 */
export function quickDeadlines(nowMs: number): { label: string; at: number }[] {
  const base = uzDayStart(nowMs);
  const at = (days: number, hour: number) => base + days * DAY_MS + hour * HOUR_MS;
  return [
    { label: "Bugun 18:00", at: at(0, 18) },
    { label: "Ertaga 12:00", at: at(1, 12) },
    { label: "Ertaga 18:00", at: at(1, 18) },
    { label: "3 kundan keyin", at: at(3, 18) },
  ].filter((q) => q.at > nowMs);
}

// ── Filtr ────────────────────────────────────────────────────────────

export type DueFilter = "" | "bugun" | "7" | "oy" | "otgan";

export const DUE_OPTIONS: { value: Exclude<DueFilter, "">; label: string }[] = [
  { value: "bugun", label: "Bugun" },
  { value: "7", label: "7 kun ichida" },
  { value: "oy", label: "Shu oy" },
  { value: "otgan", label: "Deadline o'tgan" },
];

/**
 * Muddat filtri. «Bajarilmadi» topshiriqda tayanch sana — bajarilmagan
 * lahza (jarima o'sha oyga tushadi), qolganlarida — deadline.
 */
export function matchesDue(task: StaffTask, due: DueFilter, nowMs: number): boolean {
  if (!due) return true;
  const dl = ms(task.deadline);
  const ref = task.status === "bajarilmadi" && task.failedAt ? ms(task.failedAt) : dl;
  if (due === "bugun") return sameUzDay(ref, nowMs);
  if (due === "7") return ref >= uzDayStart(nowMs) && ref <= nowMs + 7 * DAY_MS;
  if (due === "oy") return uzMonthOf(ref) === uzMonthOf(nowMs);
  if (due === "otgan") return dl < nowMs;
  return true;
}

export function sortTasks(a: StaffTask, b: StaffTask): number {
  const r = STATUS_RANK[a.status] - STATUS_RANK[b.status];
  if (r) return r;
  // Yopilganlar — yangisi oldin; ochiqlar — yaqin muddat oldin.
  return STATUS_RANK[a.status] >= 3 ? ms(b.deadline) - ms(a.deadline) : ms(a.deadline) - ms(b.deadline);
}

/** "Kechikib" belgisi: kechikib bajarilgan (tasdiqlangan yoki tasdiq kutayotgan). */
export function isLateDone(t: StaffTask): boolean {
  return (t.status === "yakunlandi" && t.completedLate) || (t.status === "tasdiq_kutilmoqda" && t.isLate);
}

/** Qayta muddat — hujjatda bo'lmasa sozlamadan hisoblanadi (hali o'tmagan). */
export function redeadlineOf(t: StaffTask, graceHours: number): number {
  const r = ms(t.redeadline);
  return Number.isFinite(r) ? r : ms(t.deadline) + graceHours * HOUR_MS;
}

/**
 * Muddat chizig'ining boshlanishi — berilgan vaqt, qaytarilgan bo'lsa
 * oxirgi qaytarilgan lahza (sanoq yangi muddatdan boshlanadi).
 */
export function windowStart(t: StaffTask): number {
  let s = ms(t.createdAt);
  for (const e of t.history ?? []) {
    if (e.kind === "returned") {
      const a = ms(e.at);
      if (a > s) s = a;
    }
  }
  return s;
}
