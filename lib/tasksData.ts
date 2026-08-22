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

export interface Task {
  id: number;
  student: string;
  date: string;
  description: string;
  staff?: string;
  type?: string;
  group?: string;
  /** `student` / `group` qaysi tanlovdan to'lganini eslab qoladi. */
  targetKind?: TaskTargetKind;
  state: TaskState;
  priority: TaskPriority;
  recurring: TaskRecurring;
  dependsOn?: number;
}

export const TODAY_DATE = new Date("2026-05-22");
TODAY_DATE.setHours(0, 0, 0, 0);

export const STAFF = [
  "Abdulloh Raxmatullayev",
  "Sevinch Madaminova",
  "Mashxura Kutupova",
  "Nodira Teshaboyeva",
  "Jasurbek O'rinboyev",
  "Durdona Yoldasheva",
  "Gulnoza Abdurahimova",
  "Ilhomjon Sharabidinov",
];

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
  const d = new Date(task.date);
  d.setHours(0, 0, 0, 0);
  if (d.getTime() < TODAY_DATE.getTime()) return "overdue";
  if (d.getTime() === TODAY_DATE.getTime()) return "today";
  return "upcoming";
}

export function formatTaskDate(iso: string): string {
  const d = new Date(iso);
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
