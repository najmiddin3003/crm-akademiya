import { toUz, uzDayKey } from "./uzTime";
// Ported from crm-akademiya/src/app.js (TASKS seed array ~line 899,
// _augmentTasksWithPriority ~line 1926, PRIORITY_META/KANBAN_STATES ~line 1875,
// TASK_TEMPLATES ~line 2325, RECURRENCE_OPTIONS ~line 2506).
// Topshiriq turlari bu yerda emas — ular bazada (lib/taskTypes.ts,
// /api/task-types) va foydalanuvchi boshqaradi.

export type TaskState = "yangi" | "jarayonda" | "kutilmoqda" | "bajarilgan";
export type TaskPriority = "kritik" | "yuqori" | "orta" | "past";
export type TaskRecurring = "none" | "daily" | "weekly" | "monthly";
export type TaskRisk = "overdue" | "danger" | "warning" | "completed" | "normal";

/**
 * Topshiriq KIMGA/NIMAGA biriktirilgani. Oynada avval shu tanlanadi, so'ng
 * yonidagi ro'yxat shunga qarab to'ladi (referens: akademiya.edutizim.uz):
 *   student — bazadagi o'quvchilar
 *   group   — bazadagi guruhlar (raqami bo'yicha)
 *   order   — tizimdagi barcha odamlar (o'quvchilar + xodimlar)
 */
export type TaskTargetKind = "student" | "group" | "order";

export const TASK_TARGET_KINDS: { value: TaskTargetKind; label: string }[] = [
  { value: "student", label: "O'quvchi" },
  { value: "group", label: "Guruh" },
  { value: "order", label: "Buyurtma" },
];

export function isTaskTargetKind(v: unknown): v is TaskTargetKind {
  return v === "student" || v === "group" || v === "order";
}

/**
 * Mas'ul xodimning JAVOBI — "Bajarildi" yoki "Bajarilmadi".
 *
 * Ikkalasi ham IZOH bilan keladi (oynada izohsiz tugma yonmaydi): rahbar
 * "bajarilmadi" ning sababini, "bajarildi" ning natijasini o'qiy olsin.
 */
export type TaskOutcome = "bajarildi" | "bajarilmadi";

export function isTaskOutcome(v: unknown): v is TaskOutcome {
  return v === "bajarildi" || v === "bajarilmadi";
}

/** Mas'ul xodimning hisoboti — topshiriq hujjatining `report` maydoni. */
export interface TaskReport {
  outcome: TaskOutcome;
  comment: string;
  /** ISO UTC — javob berilgan lahza. */
  at: string;
  /** `hr_employees.name` — kim javob berdi (ismi kartada ko'rinadi). */
  byName: string;
  /**
   * Rahbar hisobotni "Ko'rdim" deb belgilagan lahza (ISO UTC). Yo'q bo'lsa
   * hisobot hali rahbarning oynasida turadi (app/api/tasks/inbox).
   */
  seenAt?: string;
}

/**
 * Topshiriqni KIM BERGANI — hisobot aynan shu odamga qaytadi.
 *
 * `userId` — `users._id`; hisobot qamrovi shu bo'yicha kesiladi, chunki
 * bitta `hr_employees` yozuviga ikkita hisob bog'langan holat bor (69).
 */
export interface TaskAuthor {
  userId: string;
  employeeId: number | null;
  name: string;
}

export interface Task {
  id: number;
  student: string;
  date: string;
  description: string;
  staff?: string;
  /**
   * Mas'ul xodimning `hr_employees.id` si.
   *
   * `staff` — ISM SATRI (shablonlar u yerga "Siz" deb yozadi), ya'ni
   * foydalanuvchi bilan solishtirib bo'lmaydi. Xodimning shaxsiy oynasi
   * (app/api/tasks/inbox) aynan shu id bo'yicha kesiladi: oyna sizga
   * berilgan topshiriqni ko'rsatishi uchun bu maydon TO'LGAN bo'lishi shart.
   * Ismdan id'ga o'tkazish POST /api/tasks da.
   */
  staffId?: number;
  type?: string;
  group?: string;
  /** `student` / `group` qaysi tanlovdan to'lganini eslab qoladi. */
  targetKind?: TaskTargetKind;
  state: TaskState;
  priority: TaskPriority;
  recurring: TaskRecurring;
  dependsOn?: number;
  /** ISO UTC — yaratilgan lahza (xodim oynasida "berildi: …"). */
  createdAt?: string;
  /** Kim berdi — hisobot shu odamga qaytadi. */
  createdBy?: TaskAuthor;
  /** Mas'ul xodimning javobi; yo'q bo'lsa topshiriq hali javob kutmoqda. */
  report?: TaskReport;
}

/**
 * Hujjatdagi `report` — faqat shakli to'g'ri bo'lsa. Yaroqsiz (qo'lda
 * buzilgan) hisobot butun sahifani yiqitmasin: `undefined` ga tushadi.
 */
export function parseTaskReport(v: unknown): TaskReport | undefined {
  if (!v || typeof v !== "object") return undefined;
  const o = v as Record<string, unknown>;
  if (!isTaskOutcome(o.outcome)) return undefined;
  return {
    outcome: o.outcome,
    comment: String(o.comment ?? ""),
    at: String(o.at ?? ""),
    byName: String(o.byName ?? ""),
    seenAt: typeof o.seenAt === "string" ? o.seenAt : undefined,
  };
}

/** Hujjatdagi `createdBy` — `userId` siz yozuv muallifsiz hisoblanadi. */
export function parseTaskAuthor(v: unknown): TaskAuthor | undefined {
  if (!v || typeof v !== "object") return undefined;
  const o = v as Record<string, unknown>;
  if (typeof o.userId !== "string" || !o.userId) return undefined;
  const emp = Number(o.employeeId);
  return { userId: o.userId, employeeId: Number.isFinite(emp) ? emp : null, name: String(o.name ?? "") };
}

/**
 * Hali yopilmagan holatlar — xodim oynasi va qo'ng'iroq shu ro'yxat bilan
 * so'raydi. `$ne: "bajarilgan"` EMAS: inkor indeksda chegaralangan sakrash
 * bermaydi (lib/mongodb.ts dagi `tasks` indeksi izohi).
 */
export const OPEN_TASK_STATES: TaskState[] = ["yangi", "jarayonda", "kutilmoqda"];

/**
 * Bugungi kun (00:00). Har chaqirilganda YANGI Date qaytaradi — ilgari bu
 * modul darajasidagi `TODAY_DATE = new Date("2026-05-22")` konstantasi edi
 * va butun sahifa (Bugun/Kechikkan ustunlari, "48 soat ichida" kartasi,
 * kalendarning "Bugun" tugmasi, topshiriq ko'chirish tekshiruvi) o'sha
 * qotib qolgan sanaga nisbatan hisoblanardi.
 */
export function todayStart(): Date {
  // Toshkent kunining boshi. FAQAT yil/oy/kun o'qish uchun (kalendar
  // ko'rinishi, sana maydonining boshlang'ich qiymati).
  //
  // Buni boshqa `Date` bilan TAQQOSLAMANG — u siljitilgan o'lchovda va
  // siljitilmagan sana bilan solishtirish 5 soatlik xato beradi. Kunlarni
  // taqqoslash uchun `uzDayKey()` bor.
  const d = toUz(new Date());
  d.setHours(0, 0, 0, 0);
  return d;
}

export const PRIORITY_META: Record<TaskPriority, { label: string; order: number }> = {
  kritik: { label: "KRITIK", order: 0 },
  yuqori: { label: "YUQORI", order: 1 },
  orta: { label: "ORTA", order: 2 },
  past: { label: "PAST", order: 3 },
};

export const KANBAN_STATES: { key: TaskState; label: string }[] = [
  { key: "yangi", label: "Yangi" },
  { key: "jarayonda", label: "Jarayonda" },
  { key: "kutilmoqda", label: "Kutilmoqda" },
  { key: "bajarilgan", label: "Tugallangan" },
];

export const RECURRENCE_OPTIONS: { value: TaskRecurring; label: string }[] = [
  { value: "none", label: "Takrorlanmaydi" },
  { value: "daily", label: "Har kuni" },
  { value: "weekly", label: "Har hafta" },
  { value: "monthly", label: "Har oy" },
];

// Tashqaridan kelgan qiymatlar uchun tekshiruvchilar. Bazaga faqat shu
// ro'yxatlardagi qiymatlar tushishi SHART: yaroqsiz `state` kanban guruhlashini
// (TasksPage `kanbanGroups`), yaroqsiz `priority` esa saralashni
// (`compareTasksForSort` → PRIORITY_META[...]) undefined'ga urib, butun
// sahifani render bo'lmay qoldiradi.
export function isTaskState(v: unknown): v is TaskState {
  return KANBAN_STATES.some((s) => s.key === v);
}

export function isTaskPriority(v: unknown): v is TaskPriority {
  return Object.keys(PRIORITY_META).includes(String(v));
}

export function isTaskRecurring(v: unknown): v is TaskRecurring {
  return RECURRENCE_OPTIONS.some((o) => o.value === v);
}

/** `new Date(...)` o'qiy oladigan sana satrimi (masalan "2026-08-21T09:00:00"). */
export function isTaskDate(v: unknown): v is string {
  return typeof v === "string" && v.trim() !== "" && !Number.isNaN(new Date(v).getTime());
}

export function getRecurrenceLabel(r: TaskRecurring): string {
  return r !== "none" ? RECURRENCE_OPTIONS.find((o) => o.value === r)?.label ?? "" : "";
}

export const CALENDAR_MONTHS_UZ = [
  "Yanvar", "Fevral", "Mart", "Aprel", "May", "Iyun",
  "Iyul", "Avgust", "Sentabr", "Oktabr", "Noyabr", "Dekabr",
];

interface TaskTemplateItem {
  offsetHours: number;
  description: string;
  type: string;
  priority: TaskPriority;
}

export interface TaskTemplate {
  id: string;
  name: string;
  description: string;
  icon: string;
  iconColor: string;
  iconBg: string;
  items: TaskTemplateItem[];
}

export const TASK_TEMPLATES: TaskTemplate[] = [
  {
    id: "new-lead",
    name: "Yangi lead",
    description: "Yangi mijoz uchun standart pipeline",
    icon: "i-user-plus",
    iconColor: "hsl(217 91% 60%)",
    iconBg: "hsl(217 91% 60% / 0.15)",
    items: [
      { offsetHours: 0, description: "Telefon qilish va tanishtirish", type: "Konsultatsiya", priority: "kritik" },
      { offsetHours: 24, description: "Sinov darsiga taklif qilish", type: "Sinov darsi belgilash", priority: "yuqori" },
      { offsetHours: 72, description: "Shartnoma tayyorlash va imzolash", type: "O'quvchi guruhdan chiqarish", priority: "yuqori" },
      { offsetHours: 168, description: "Birinchi to'lov muddati eslatmasi", type: "To'lov eslatmasi", priority: "orta" },
    ],
  },
  {
    id: "overdue-payment",
    name: "Qarzdorlik bilan ishlash",
    description: "To'lov muddati o'tgan o'quvchilar bilan",
    icon: "i-credit-card",
    iconColor: "hsl(0 72% 51%)",
    iconBg: "hsl(0 72% 51% / 0.15)",
    items: [
      { offsetHours: 0, description: "To'lov haqida eslatma yuborish", type: "To'lov eslatmasi", priority: "kritik" },
      { offsetHours: 24, description: "Telefonda aloqaga chiqish", type: "Konsultatsiya", priority: "yuqori" },
      { offsetHours: 72, description: "Ota-onaga aloqa qilish", type: "Konsultatsiya", priority: "yuqori" },
    ],
  },
  {
    id: "absent-student",
    name: "Davomatda yo'q o'quvchi",
    description: "Bir necha kun davomat tashlagan",
    icon: "i-user-x",
    iconColor: "hsl(38 92% 50%)",
    iconBg: "hsl(38 92% 50% / 0.15)",
    items: [
      { offsetHours: 0, description: "O'quvchi bilan aloqaga chiqish", type: "Davomat tekshiruvi", priority: "yuqori" },
      { offsetHours: 24, description: "Ota-onaga xabar berish", type: "Konsultatsiya", priority: "orta" },
    ],
  },
  {
    id: "exam-prep",
    name: "Imtihon tayyorgarligi",
    description: "Daraja imtihonidan oldin",
    icon: "i-graduation-cap",
    iconColor: "hsl(280 60% 65%)",
    iconBg: "hsl(280 60% 65% / 0.15)",
    items: [
      { offsetHours: 0, description: "Mock test belgilash", type: "Sinov darsi belgilash", priority: "yuqori" },
      { offsetHours: 48, description: "Mock test natijasini ko'rib chiqish", type: "Konsultatsiya", priority: "orta" },
      { offsetHours: 120, description: "Daraja imtihoni o'tkazish", type: "Sinov darsi belgilash", priority: "kritik" },
    ],
  },
];

export function getTaskStatus(task: Task): "overdue" | "today" | "upcoming" {
  // Toshkent taqvimi bo'yicha: server ham, chet eldagi brauzer ham bir xil
  // javob beradi. Ilgari bu `new Date()` ning lokal kuniga tayanardi —
  // UTC'da ishlaydigan serverda 00:00–05:00 oralig'ida "bugun" bir kunga
  // adashardi.
  const day = uzDayKey(new Date(task.date));
  const today = uzDayKey();
  if (day < today) return "overdue";
  if (day === today) return "today";
  return "upcoming";
}

export function formatTaskDate(iso: string): string {
  const d = toUz(new Date(iso));
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()} | ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Risk relative to NOW (real wall-clock), matching computeTaskRisk(). */
export function computeTaskRisk(task: Task): TaskRisk {
  if (task.state === "bajarilgan") return "completed";
  const d = new Date(task.date);
  if (isNaN(d.getTime())) return "normal";
  const hoursLeft = (d.getTime() - Date.now()) / 3600000;
  if (hoursLeft < 0) return "overdue";
  if (hoursLeft < 6) return "danger";
  if (hoursLeft < 24) return "warning";
  return "normal";
}

/**
 * Muddatgacha QANCHA QOLGANI — "2 kun 3 soat qoldi", "45 daqiqa qoldi",
 * muddat o'tgan bo'lsa "3 soat kechikdi". Xodim oynasidagi hisoblagich.
 *
 * `nowMs` tashqaridan keladi (server vaqtiga tekislangan "hozir",
 * components/shared/TaskInboxProvider.tsx): klient soati bir soat oldinda
 * bo'lsa ham hali muddati kelmagan topshiriq "kechikdi" deb turmasin.
 *
 * Ikki eng yirik birlik chiziladi (kun+soat, soat+daqiqa) — "2 kun 3 soat
 * 14 daqiqa" o'qishga og'ir, "2 kun" esa juda qo'pol. Bir daqiqadan kam
 * qolganda "1 daqiqadan kam qoldi": nol daqiqa hech narsa demaydi.
 */
export function remainingUz(dueMs: number, nowMs: number): string {
  const late = dueMs < nowMs;
  const totalMin = Math.floor(Math.abs(dueMs - nowMs) / 60_000);
  const suffix = late ? "kechikdi" : "qoldi";
  if (totalMin < 1) return late ? "hozirgina muddati o'tdi" : "1 daqiqadan kam qoldi";
  const days = Math.floor(totalMin / 1440);
  const hours = Math.floor((totalMin % 1440) / 60);
  const mins = totalMin % 60;
  const parts: string[] = [];
  if (days > 0) parts.push(`${days} kun`);
  if (hours > 0) parts.push(`${hours} soat`);
  if (days === 0 && mins > 0) parts.push(`${mins} daqiqa`);
  return `${parts.join(" ")} ${suffix}`;
}

export function getRiskLabel(risk: TaskRisk): string {
  return (
    {
      overdue: "Muddati o'tdi",
      danger: "⚠ Xavf ostida",
      warning: "⏰ Yaqinda",
      completed: "✓ Bajarildi",
      normal: "",
    }[risk] || ""
  );
}

/** 1) overdue first, 2) priority, 3) nearest deadline — 1:1 port of compareTasksForSort. */
export function compareTasksForSort(a: Task, b: Task): number {
  const oa = computeTaskRisk(a) === "overdue" ? 0 : 1;
  const ob = computeTaskRisk(b) === "overdue" ? 0 : 1;
  if (oa !== ob) return oa - ob;
  const pa = PRIORITY_META[a.priority].order;
  const pb = PRIORITY_META[b.priority].order;
  if (pa !== pb) return pa - pb;
  return new Date(a.date).getTime() - new Date(b.date).getTime();
}

/** Urgency bucket for the due-date badge — 1:1 port of _taskUrgency(). */
export function taskUrgency(dateStr: string): "overdue" | "today" | "soon" | "normal" {
  const hoursLeft = (new Date(dateStr).getTime() - Date.now()) / 3600000;
  if (hoursLeft < 0) return "overdue";
  if (hoursLeft < 12) return "today";
  if (hoursLeft < 48) return "soon";
  return "normal";
}

export function isTaskBlocked(task: Task, tasks: Task[]): boolean {
  if (!task.dependsOn) return false;
  const dep = tasks.find((t) => t.id === task.dependsOn);
  if (!dep) return false;
  return dep.state !== "bajarilgan";
}
