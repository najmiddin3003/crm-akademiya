import { ACTIVE_STATUSES, OPEN_STATUSES, STATUS_LABEL, ms, type StaffTaskStatus, type ViewerRole } from "@/lib/staffTasks";
import { TASKS_COL, taskScope, type StaffTaskDoc } from "@/lib/staffTasksServer";
import { uzStamp } from "@/lib/uzTime";
import { taskViewerOf } from "../context";
import { optString, ToolInputError, type AiTool } from "./types";

// XODIM TOPSHIRIQLARI (/tasks) — sahifa bilan BIR XIL qamrov
// (lib/staffTasksServer.ts → taskScope): direktor — hammasi, rahbar —
// o'z filiallaridagilar va o'zi berganlari, xodim — faqat o'ziga berilgan.
//
// HECH NARSA YOZMAYDI: sahifa ochilganda ishlaydigan avtomatika
// (`runAutomation` — muddati o'tganini «Bajarilmadi» qilish, jarima) bu
// yerda CHAQIRILMAYDI. Shu bois muddati o'tganini vosita o'zi sanaydi:
// bajarilishi kerak bo'lgan (yangi / qaytarildi) topshiriqning muddati
// o'tgan bo'lsa ham "muddati o'tgan" deb ko'rsatiladi.

const LIST = 30;

export type TaskFilter = "open" | "overdue" | "awaiting" | "done" | "failed" | "all";
const FILTERS: readonly TaskFilter[] = ["open", "overdue", "awaiting", "done", "failed", "all"];

export type TaskRow = Pick<
  StaffTaskDoc,
  "id" | "title" | "employeeId" | "employeeName" | "priority" | "deadline" | "status" | "completedAt" | "completedLate" | "createdBy" | "updatedAt"
>;

/** Bajarilishi kerak bo'lgani va muddati o'tgani (avtomatika kechiksa ham). */
export function isOverdue(t: Pick<TaskRow, "status" | "deadline">, nowMs: number): boolean {
  if (t.status === "muddati_otdi") return true;
  return ACTIVE_STATUSES.includes(t.status) && ms(t.deadline) < nowMs;
}

function matches(t: TaskRow, f: TaskFilter, nowMs: number): boolean {
  switch (f) {
    case "open": return OPEN_STATUSES.includes(t.status);
    case "overdue": return isOverdue(t, nowMs);
    case "awaiting": return t.status === "tasdiq_kutilmoqda";
    case "done": return t.status === "yakunlandi";
    case "failed": return t.status === "bajarilmadi";
    default: return true;
  }
}

const SCOPE_TEXT: Record<ViewerRole, string> = {
  direktor: "all tasks (administrator)",
  rahbar: "tasks of the user's branches and tasks the user assigned",
  xodim: "only tasks assigned to the user",
};

/** Sof hisob (sinov shu orqali): holatlar, xodimlar kesimi, ro'yxat. */
export function summarizeTasks(rows: readonly TaskRow[], filter: TaskFilter, nowMs: number) {
  const byStatus = new Map<StaffTaskStatus, number>();
  const perEmployee = new Map<string, { open: number; overdue: number; awaitingApproval: number; done: number; failed: number }>();
  for (const t of rows) {
    byStatus.set(t.status, (byStatus.get(t.status) ?? 0) + 1);
    const name = t.employeeName || `#${t.employeeId}`;
    const e = perEmployee.get(name) ?? { open: 0, overdue: 0, awaitingApproval: 0, done: 0, failed: 0 };
    if (OPEN_STATUSES.includes(t.status)) e.open++;
    if (isOverdue(t, nowMs)) e.overdue++;
    if (t.status === "tasdiq_kutilmoqda") e.awaitingApproval++;
    if (t.status === "yakunlandi") e.done++;
    if (t.status === "bajarilmadi") e.failed++;
    perEmployee.set(name, e);
  }

  const hit = rows.filter((t) => matches(t, filter, nowMs));
  // Avval muddati o'tganlar, keyin ochiqlar (yaqin muddat oldin), keyin yopilganlar (yangisi oldin).
  const rank = (t: TaskRow) => (isOverdue(t, nowMs) ? 0 : OPEN_STATUSES.includes(t.status) ? 1 : 2);
  hit.sort((a, b) => {
    const r = rank(a) - rank(b);
    if (r) return r;
    return rank(a) < 2 ? ms(a.deadline) - ms(b.deadline) : String(b.updatedAt).localeCompare(String(a.updatedAt));
  });

  return {
    total: rows.length,
    byStatus: [...byStatus].map(([s, count]) => ({ status: STATUS_LABEL[s] ?? s, count })).sort((a, b) => b.count - a.count),
    overdue: rows.filter((t) => isOverdue(t, nowMs)).length,
    byEmployee: [...perEmployee]
      .map(([employee, c]) => ({ employee, ...c }))
      .sort((a, b) => b.overdue - a.overdue || b.open - a.open || a.employee.localeCompare(b.employee))
      .slice(0, 20),
    tasks: hit.slice(0, LIST).map((t) => ({
      id: t.id,
      title: t.title,
      employee: t.employeeName || `#${t.employeeId}`,
      deadline: Number.isFinite(ms(t.deadline)) ? uzStamp(new Date(t.deadline)) : "—",
      status: STATUS_LABEL[t.status] ?? t.status,
      overdue: isOverdue(t, nowMs) || undefined,
      priority: t.priority,
      completedLate: (t.status === "yakunlandi" && t.completedLate) || undefined,
      assignedBy: t.createdBy?.name || undefined,
    })),
    matched: hit.length,
  };
}

export const staffTasks: AiTool = {
  name: "staff_tasks",
  description:
    "Staff tasks (topshiriqlar) the user can see — the same scope as the Topshiriqlar page: an administrator sees all, " +
    "a manager sees tasks of their branches and tasks they assigned, an employee sees only their own. Returns counts by " +
    "status, overdue tasks, a per-employee summary and a task list (title, employee, deadline in Tashkent time, status, " +
    "priority 1–5). Filter: open (default), overdue, awaiting (waiting for approval), done, failed, all.",
  parameters: {
    type: "object",
    properties: {
      filter: { type: "string", enum: [...FILTERS], description: "Which tasks to list (default: open)." },
      employee: { type: "string", description: "Optional employee name filter." },
    },
    additionalProperties: false,
  },
  pages: ["/tasks"],
  async run(ctx, args) {
    const filterIn = optString(args, "filter", 20) || "open";
    if (!FILTERS.includes(filterIn as TaskFilter)) throw new ToolInputError(`"filter" must be one of ${FILTERS.join(", ")}`);
    const q = optString(args, "employee", 60).toLowerCase();

    const v = await taskViewerOf(ctx);
    const rows = (await ctx.db
      .collection<StaffTaskDoc>(TASKS_COL)
      .find(taskScope(v), {
        projection: {
          _id: 0, id: 1, title: 1, employeeId: 1, employeeName: 1, priority: 1, deadline: 1, status: 1,
          completedAt: 1, completedLate: 1, createdBy: 1, updatedAt: 1,
        },
      })
      .toArray()) as unknown as TaskRow[];
    const mine = q ? rows.filter((t) => String(t.employeeName ?? "").toLowerCase().includes(q)) : rows;

    return {
      scope: SCOPE_TEXT[v.role],
      filter: filterIn,
      employeeFilter: q || undefined,
      ...summarizeTasks(mine, filterIn as TaskFilter, Date.now()),
      note: "Deadlines are Tashkent time. overdue = still to be done and the deadline has passed.",
      page: "/tasks",
    };
  },
};
