"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { MoreVertical } from "lucide-react";
import Button from "@/components/ui/Button";
import TaskCard from "@/components/tasks/TaskCard";
import KanbanCard from "@/components/tasks/KanbanCard";
import CalendarView from "@/components/tasks/CalendarView";
import RiskDashboard from "@/components/tasks/RiskDashboard";
import TaskDashboardWidgets, { type DashboardFilter } from "@/components/tasks/TaskDashboardWidgets";
import TaskModal, { type TaskModalValues } from "@/components/tasks/TaskModal";
import TaskTemplatesModal from "@/components/tasks/TaskTemplatesModal";
import MoveTaskModal from "@/components/tasks/MoveTaskModal";
import TaskTypesDrawer from "@/components/tasks/TaskTypesDrawer";
import TaskTypeIcon from "@/components/tasks/TaskTypeIcon";
import { useTaskTypes } from "@/hooks/useTaskTypes";
import { useStaff } from "@/hooks/useStaff";
import {
  getTaskStatus,
  isTaskBlocked,
  isTaskState,
  compareTasksForSort,
  KANBAN_STATES,
  parseTaskReport,
  TASK_TEMPLATES,
  todayStart,
  type Task,
  type TaskState,
} from "@/lib/tasksData";
import { uzDayKey, uzDayKeyIn, uzWall } from "@/lib/uzTime";
import Select from "@/components/ui/Select";
import DateField from "@/components/ui/DateField";

// Ported from crm-akademiya/index-dev.html lines 551-877 (id="view-tasks") +
// src/app.js (renderTasks/renderKanbanView/renderCalendarView/setTaskView).
// Scope cuts from the source for this pass (noted so they aren't mistaken for bugs):
// - bulk-selection/grading, submission-state (checked/late) badges, and activity
//   log/comments tabs are not ported.
// - the custom date-range calendar popover is replaced with two native date inputs.
//
// "⋮" menyusi → "Topshiriq turi": chap tomondan ochiladigan panel
// (TaskTypesDrawer) orqali topshiriq turlari boshqariladi. Turlar bazadan
// keladi (/api/task-types) va shu sahifadagi filtr hamda Topshiriq oynasidagi
// tanlov o'shandan to'ladi.

type ViewMode = "time" | "kanban" | "calendar";

const VIEW_TOGGLES: { mode: ViewMode; label: string; icon: string }[] = [
  { mode: "time", label: "Vaqt", icon: "i-list" },
  { mode: "kanban", label: "Kanban", icon: "i-grid" },
  { mode: "calendar", label: "Kalendar", icon: "i-calendar" },
];

interface Filters {
  responsible: string;
  student: string;
  type: string;
  group: string;
  status: string;
  from: string;
  to: string;
}

const EMPTY_FILTERS: Filters = { responsible: "", student: "", type: "", group: "", status: "", from: "", to: "" };

export default function TasksPage() {
  const [tasks, setTasks] = useState<Task[]>([]);

  useEffect(() => {
    fetch("/api/tasks")
      .then((r) => r.json())
      .then((data) => {
        if (data.ok) setTasks(data.tasks);
      })
      .catch(() => {});
  }, []);
  // "Mas'ul shaxs" ro'yxati bazadagi aktiv xodimlardan. `employees` —
  // tanlangan ismni `hr_employees.id` ga bog'lash uchun: xodimning shaxsiy
  // topshiriq oynasi (app/api/tasks/inbox) aynan id bo'yicha kesiladi.
  const { names: staffNames, employees: staffEmployees } = useStaff();
  const [viewMode, setViewMode] = useState<ViewMode>("time");
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [dashFilter, setDashFilter] = useState<DashboardFilter>("all");
  const [calendarMonth, setCalendarMonth] = useState(() => todayStart());
  const [modalOpen, setModalOpen] = useState(false);
  const [modalTaskId, setModalTaskId] = useState<number | null>(null);
  const [modalInitialDate, setModalInitialDate] = useState<string | undefined>(undefined);
  const [templatesOpen, setTemplatesOpen] = useState(false);
  const [draggingId, setDraggingId] = useState<number | null>(null);
  const [dragOverState, setDragOverState] = useState<TaskState | null>(null);
  // Topshiriq turlari — bazadan (/api/task-types).
  const taskTypes = useTaskTypes();
  const [typesDrawerOpen, setTypesDrawerOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const moreRef = useRef<HTMLDivElement>(null);
  const [timeDraggingId, setTimeDraggingId] = useState<number | null>(null);
  const [timeDragOverStatus, setTimeDragOverStatus] = useState<"overdue" | "today" | "upcoming" | null>(null);
  const [moveTaskId, setMoveTaskId] = useState<number | null>(null);

  const setFilter = <K extends keyof Filters>(key: K, value: Filters[K]) =>
    setFilters((f) => ({ ...f, [key]: value }));

  const studentOptions = useMemo(() => Array.from(new Set(tasks.map((t) => t.student))).sort(), [tasks]);
  const groupOptions = useMemo(
    () => Array.from(new Set(tasks.map((t) => t.group).filter((g): g is string => !!g))),
    [tasks],
  );

  useEffect(() => {
    if (!moreOpen) return;
    const onDown = (e: MouseEvent) => {
      if (moreRef.current && !moreRef.current.contains(e.target as Node)) setMoreOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [moreOpen]);

  const baseFiltered = useMemo(() => {
    return tasks.filter((t) => {
      if (filters.responsible && t.staff !== filters.responsible) return false;
      if (filters.student && t.student !== filters.student) return false;
      if (filters.type && t.type !== filters.type) return false;
      if (filters.group && (t.group || "") !== filters.group) return false;
      if (filters.from && new Date(t.date) < new Date(filters.from)) return false;
      if (filters.to && new Date(t.date) > new Date(filters.to + "T23:59:59")) return false;
      return true;
    });
  }, [tasks, filters]);

  const withStatus = useMemo(
    () => baseFiltered.filter((t) => !filters.status || t.state === filters.status),
    [baseFiltered, filters.status],
  );

  const timeFiltered = useMemo(() => {
    return withStatus.filter((t) => {
      if (dashFilter === "all") return true;
      if (dashFilter === "today") return getTaskStatus(t) === "today";
      if (dashFilter === "late") return getTaskStatus(t) === "overdue";
      if (dashFilter === "soon") {
        // Kunlar Toshkent taqvimi bo'yicha (lib/uzTime.ts).
        return getTaskStatus(t) === "upcoming" && uzDayKey(new Date(t.date)) <= uzDayKeyIn(3);
      }
      if (dashFilter === "done") return t.state === "bajarilgan";
      return true;
    });
  }, [withStatus, dashFilter]);

  const buckets = useMemo(() => {
    const b: Record<"overdue" | "today" | "upcoming", Task[]> = { overdue: [], today: [], upcoming: [] };
    for (const t of timeFiltered) b[getTaskStatus(t)].push(t);
    b.overdue.sort((a, c) => new Date(c.date).getTime() - new Date(a.date).getTime());
    b.today.sort((a, c) => new Date(a.date).getTime() - new Date(c.date).getTime());
    b.upcoming.sort((a, c) => new Date(a.date).getTime() - new Date(c.date).getTime());
    return b;
  }, [timeFiltered]);

  const kanbanGroups = useMemo(() => {
    const g: Record<TaskState, Task[]> = { yangi: [], jarayonda: [], kutilmoqda: [], bajarilgan: [] };
    for (const t of baseFiltered) g[t.state].push(t);
    (Object.keys(g) as TaskState[]).forEach((k) => g[k].sort(compareTasksForSort));
    return g;
  }, [baseFiltered]);

  const openAddModal = (initialDate?: string) => {
    setModalTaskId(null);
    setModalInitialDate(initialDate);
    setModalOpen(true);
  };
  const openEditModal = (id: number) => {
    setModalTaskId(id);
    setModalInitialDate(undefined);
    setModalOpen(true);
  };
  const editingTask = modalTaskId != null ? tasks.find((t) => t.id === modalTaskId) || null : null;

  /**
   * PATCH javobidagi hujjatdan FAQAT server o'zi hal qiladigan maydonlar
   * olinadi — `report` (qayta berilganda o'chadi), `state` (qayta
   * berilganda "yangi" ga qaytadi) va `staffId` (ism → id). Qolganini
   * optimistik yangilash allaqachon qo'ygan.
   */
  const syncFromServer = (id: number, doc: Record<string, unknown>) => {
    const report = parseTaskReport(doc.report);
    const staffId = Number(doc.staffId) > 0 ? Number(doc.staffId) : undefined;
    setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, report, staffId, state: isTaskState(doc.state) ? doc.state : t.state } : t)));
  };

  const handleSaveModal = async (values: TaskModalValues) => {
    const isoDate = `${values.date}T${values.time || "09:00"}:00`;
    // Topshiriq kimga biriktirilgani: kartada sarlavha sifatida `student`
    // ko'rinadi, guruh tanlansa qo'shimcha ravishda `group` ham to'ladi.
    const target = values.targetValue.trim();
    // Ism → id. Tanlov ro'yxati aynan shu ismlardan qurilgan, ya'ni aniq
    // tenglik yetarli (bazadagi "Najmiddin Turgunpolatov" / "Najmiddin
    // turgunpolatov" juftligini ham to'g'ri ajratadi). Topilmasa server ism
    // bo'yicha o'zi izlaydi (lib/taskStaff.ts).
    const staffId = values.staff ? staffEmployees.find((e) => e.name === values.staff)?.id : undefined;
    if (modalTaskId != null) {
      const patch = {
        date: isoDate,
        description: values.note || undefined,
        staff: values.staff || undefined,
        staffId,
        type: values.type || undefined,
        priority: values.priority,
        recurring: values.recurring,
        student: target,
        group: values.targetKind === "group" ? target : "",
        targetKind: values.targetKind,
      };
      setTasks((prev) => prev.map((t) => (t.id === modalTaskId ? { ...t, ...patch, description: patch.description || t.description, staff: patch.staff || t.staff, type: patch.type || t.type } : t)));
      // Javobdan `report`/`staffId` olinadi: qayta berilgan (yangi muddat,
      // boshqa mas'ul) topshiriqning eski hisobotini server o'chiradi
      // (app/api/tasks/[id]) — karta ham o'sha zahoti "hisobotsiz" bo'lsin.
      fetch(`/api/tasks/${modalTaskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      }).then((r) => r.json()).then((d) => { if (d?.ok && d.task) syncFromServer(modalTaskId, d.task); }).catch(() => {});
    } else {
      const newTask: Omit<Task, "id"> = {
        student: target,
        group: values.targetKind === "group" ? target : undefined,
        targetKind: values.targetKind,
        date: isoDate,
        description: values.note || values.type || "Yangi topshiriq",
        staff: values.staff || undefined,
        staffId,
        type: values.type || undefined,
        priority: values.priority,
        recurring: values.recurring,
        state: "yangi",
      };
      const res = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newTask),
      });
      const data = await res.json();
      if (data.ok) setTasks((prev) => [...prev, data.task]);
    }
    setModalOpen(false);
  };

  const handleApplyTemplate = async (templateId: string, studentName: string) => {
    const tpl = TASK_TEMPLATES.find((t) => t.id === templateId);
    if (!tpl) return;
    const now = Date.now();
    // Ketma-ket yuboriladi (Promise.all emas) — /api/tasks POST'dagi id hisoblash
    // atomik emas, parallel so'rovlar bir xil id'ga urinib duplicate key xatosi berardi.
    const newTasks: Task[] = [];
    for (const item of tpl.items) {
      const payload: Omit<Task, "id"> = {
        student: studentName,
        targetKind: "student",
        // `toISOString().slice(0,16)` EDI — u UTC beradi, ya'ni shablondan
        // yaratilgan topshiriqning muddati Toshkent vaqtidan 5 soat orqada
        // yozilardi (soat 14:00 da yaratilgan "48 soat" topshirig'i
        // 09:00 ga tushardi). Boshqa yozuvchilar bilan bir xil devor-soati.
        date: uzWall(new Date(now + item.offsetHours * 3600000)),
        description: item.description,
        type: item.type,
        priority: item.priority,
        recurring: "none",
        state: "yangi",
        staff: "Siz",
      };
      const res = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (data.ok) newTasks.push(data.task as Task);
    }
    setTasks((prev) => [...newTasks, ...prev]);
    setTemplatesOpen(false);
  };

  const onKanbanDragStart = (e: React.DragEvent, id: number) => {
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", String(id));
    setDraggingId(id);
  };
  const onKanbanDragEnd = () => {
    setDraggingId(null);
    setDragOverState(null);
  };
  const onKanbanDrop = (e: React.DragEvent, state: TaskState) => {
    e.preventDefault();
    const id = parseInt(e.dataTransfer.getData("text/plain"), 10);
    setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, state } : t)));
    setDragOverState(null);
    // "Yangi" ga qaytarilganda server hisobotni o'chiradi — javobdan olinadi.
    fetch(`/api/tasks/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ state }),
    }).then((r) => r.json()).then((d) => { if (d?.ok && d.task) syncFromServer(id, d.task); }).catch(() => {});
  };

  // Ported from crm-akademiya/src/app.js onTaskDragStart/onTaskDragOver/onTaskDrop
  // (~line 3597) — dropping on "Bugun"/"O'tib ketgan" snaps the date to today/
  // yesterday (keeping the existing time-of-day); dropping on "Keyinchalik" asks
  // for an explicit future date via MoveTaskModal, since there's no way to guess one.
  const onTimeDragStart = (e: React.DragEvent, id: number) => {
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", String(id));
    setTimeDraggingId(id);
  };
  const onTimeDragEnd = () => {
    setTimeDraggingId(null);
    setTimeDragOverStatus(null);
  };
  const draggingTimeTask = timeDraggingId != null ? tasks.find((t) => t.id === timeDraggingId) || null : null;
  const onTimeDragOver = (e: React.DragEvent, targetStatus: "overdue" | "today" | "upcoming") => {
    if (!draggingTimeTask || getTaskStatus(draggingTimeTask) === targetStatus) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setTimeDragOverStatus(targetStatus);
  };
  const onTimeDragLeave = (targetStatus: "overdue" | "today" | "upcoming") => {
    setTimeDragOverStatus((s) => (s === targetStatus ? null : s));
  };
  const onTimeDrop = (e: React.DragEvent, targetStatus: "overdue" | "today" | "upcoming") => {
    e.preventDefault();
    setTimeDragOverStatus(null);
    const id = parseInt(e.dataTransfer.getData("text/plain"), 10);
    const task = tasks.find((t) => t.id === id);
    if (!task || getTaskStatus(task) === targetStatus) return;
    if (targetStatus === "upcoming") {
      setMoveTaskId(id);
      return;
    }
    const existing = new Date(task.date);
    // `todayStart()` — siljitilgan sana: undan faqat Toshkent kunining
    // yil/oy/kunini olamiz. Saqlanadigan lahza esa ODDIY `Date` bilan
    // quriladi, aks holda `toISOString()` 5 soat surilib ketardi.
    const uzToday = todayStart();
    const newDate = new Date(uzToday.getFullYear(), uzToday.getMonth(), uzToday.getDate());
    if (targetStatus !== "today") newDate.setDate(newDate.getDate() - 1);
    newDate.setHours(existing.getHours() || 9, existing.getMinutes() || 0, 0, 0);
    const isoDate = newDate.toISOString();
    setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, date: isoDate } : t)));
    fetch(`/api/tasks/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ date: isoDate }),
    }).catch(() => {});
  };
  const moveTaskTarget = moveTaskId != null ? tasks.find((t) => t.id === moveTaskId) || null : null;

  const clearFilters = () => setFilters(EMPTY_FILTERS);

  return (
    <div className="container mx-auto max-w-[1600px] p-4 md:p-5 space-y-4">
      <svg width="0" height="0" style={{ position: "absolute" }} aria-hidden="true">
        <defs>
          <symbol id="i-list" viewBox="0 0 24 24"><line x1="8" y1="6" x2="21" y2="6" /><line x1="8" y1="12" x2="21" y2="12" /><line x1="8" y1="18" x2="21" y2="18" /><line x1="3" y1="6" x2="3.01" y2="6" /><line x1="3" y1="12" x2="3.01" y2="12" /><line x1="3" y1="18" x2="3.01" y2="18" /></symbol>
          <symbol id="i-filter" viewBox="0 0 24 24"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" /></symbol>
          <symbol id="i-layers" viewBox="0 0 24 24"><polygon points="12 2 2 7 12 12 22 7 12 2" /><polyline points="2 17 12 22 22 17" /><polyline points="2 12 12 17 22 12" /></symbol>
          <symbol id="i-check-circle" viewBox="0 0 24 24"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" /></symbol>
          <symbol id="i-alert-triangle" viewBox="0 0 24 24"><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></symbol>
          <symbol id="i-clock" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></symbol>
          <symbol id="i-check" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12" /></symbol>
          <symbol id="i-arrow-right" viewBox="0 0 24 24"><line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" /></symbol>
        </defs>
      </svg>

      <TaskDashboardWidgets tasks={withStatus} active={dashFilter} onChange={setDashFilter} />

      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-xl font-semibold tracking-tight">Topshiriqlar</h1>
        <div className="flex items-center gap-2">
          <div className="view-toggle-group">
            {VIEW_TOGGLES.map((v) => (
              <button
                key={v.mode}
                className={`view-toggle-btn ${viewMode === v.mode ? "active" : ""}`}
                onClick={() => setViewMode(v.mode)}
              >
                <svg className="icon" style={{ width: 14, height: 14 }}><use href={`#${v.icon}`} /></svg>
                <span>{v.label}</span>
              </button>
            ))}
          </div>

          <Button variant="primary" icon="i-filter" onClick={() => setFiltersOpen((o) => !o)} title="Filterlarni ko'rsatish/yashirish">
            Filtr
          </Button>
          <Button variant="outline" icon="i-layers" onClick={() => setTemplatesOpen(true)} title="Tayyor shablondan task'lar yaratish">
            Shablon
          </Button>
          <Button variant="primary" icon="i-file-plus" onClick={() => openAddModal()}>
            Qo&apos;shish
          </Button>

          <div className="relative" ref={moreRef}>
            <button
              type="button"
              title="Qo'shimcha amallar"
              onClick={() => setMoreOpen((o) => !o)}
              className={`inline-flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-card hover:bg-secondary ${moreOpen ? "bg-secondary" : ""}`}
            >
              <MoreVertical className="h-4 w-4" />
            </button>
            {moreOpen && (
              <div className="absolute right-0 top-full z-50 mt-2 w-56 overflow-hidden rounded-xl border border-border bg-card p-1 shadow-xl">
                <button
                  type="button"
                  onClick={() => { setMoreOpen(false); setTypesDrawerOpen(true); }}
                  className="flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-left text-sm transition-colors hover:bg-secondary"
                >
                  <span className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-primary/10 text-primary">
                    <TaskTypeIcon icon="list-checks" className="h-4 w-4" />
                  </span>
                  <span>Topshiriq turi</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {viewMode === "kanban" && (
        <div>
          <RiskDashboard tasks={baseFiltered} />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {KANBAN_STATES.map((st) => (
              <div
                key={st.key}
                className={`kanban-column ${dragOverState === st.key ? "drag-over" : ""}`}
                data-state={st.key}
                onDragOver={(e) => { e.preventDefault(); setDragOverState(st.key); }}
                onDragLeave={() => setDragOverState((s) => (s === st.key ? null : s))}
                onDrop={(e) => onKanbanDrop(e, st.key)}
              >
                <div className="kanban-column-header">
                  <div className="kanban-column-title">{st.label}</div>
                  <span className="kanban-column-count">{kanbanGroups[st.key].length}</span>
                </div>
                <div className="kanban-cards">
                  {kanbanGroups[st.key].length === 0 ? (
                    <div className="text-center py-10 text-[12px] text-muted-foreground opacity-50">Bo&apos;sh</div>
                  ) : (
                    kanbanGroups[st.key].map((task) => (
                      <KanbanCard
                        key={task.id}
                        task={task}
                        blocked={isTaskBlocked(task, tasks)}
                        isDragging={draggingId === task.id}
                        onOpen={openEditModal}
                        onDragStart={onKanbanDragStart}
                        onDragEnd={onKanbanDragEnd}
                      />
                    ))
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {viewMode === "calendar" && (
        <CalendarView
          month={calendarMonth}
          tasks={baseFiltered}
          onNavigate={(delta) => setCalendarMonth((m) => new Date(m.getFullYear(), m.getMonth() + delta, 1))}
          onToday={() => { const t = todayStart(); setCalendarMonth(new Date(t.getFullYear(), t.getMonth(), 1)); }}
          onDayClick={(year, month, day) => {
            const dt = new Date(year, month, day);
            openAddModal(dt.toISOString().slice(0, 10));
          }}
          onTaskClick={openEditModal}
        />
      )}

      {filtersOpen && (
        <div className="flex flex-wrap items-center justify-end gap-2">
          <Select value={filters.responsible} onChange={(v) => setFilter("responsible", v)} options={staffNames.map((s) => ({ value: s, label: s }))} placeholder="Mas'ul shaxs" clearable size="sm" className="w-36" />
          <Select value={filters.student} onChange={(v) => setFilter("student", v)} options={studentOptions.map((s) => ({ value: s, label: s }))} placeholder="O'quvchi" clearable size="sm" className="w-32" />
          <Select value={filters.type} onChange={(v) => setFilter("type", v)} options={taskTypes.types.map((t) => ({ value: t.name, label: t.name }))} placeholder="Topshiriq turi" clearable size="sm" className="w-40" />
          {groupOptions.length > 0 && (
            <Select value={filters.group} onChange={(v) => setFilter("group", v)} options={groupOptions.map((g) => ({ value: g, label: g }))} placeholder="Guruh" clearable size="sm" className="w-32" />
          )}
          <DateField value={filters.from} onChange={(v) => setFilter("from", v)} />
          <DateField value={filters.to} onChange={(v) => setFilter("to", v)} />
          <Select value={filters.status} onChange={(v) => setFilter("status", v)} options={KANBAN_STATES.map((s) => ({ value: s.key, label: s.label }))} placeholder="Holati" clearable size="sm" className="w-32" />
          <button onClick={clearFilters} className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg border border-border bg-card hover:bg-secondary text-sm font-medium">
            <svg className="icon icon-xs"><use href="#i-x-circle" /></svg> Tozalash
          </button>
        </div>
      )}

      {viewMode === "time" && (() => {
        const isDraggingTime = timeDraggingId != null;
        const sourceStatus = draggingTimeTask ? getTaskStatus(draggingTimeTask) : null;
        const columns: { status: "overdue" | "today" | "upcoming"; label: string; border: string; items: Task[] }[] = [
          { status: "overdue", label: "O'tib ketgan", border: "border-red-300", items: buckets.overdue },
          { status: "today", label: "Bugun", border: "border-emerald-300", items: buckets.today },
          { status: "upcoming", label: "Keyinchalik keladigan", border: "border-blue-300", items: buckets.upcoming },
        ];
        return (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-4">
            {columns.map((col) => (
              <div
                key={col.status}
                /* Referensda ustunlar kartasiz — faqat tepasida rangli chiziq.
                   Ramka SHAFFOF qoldirildi: sudrab tashlash holatlari
                   (.drop-eligible/.drag-over) uning rangini o'zgartiradi. */
                className={`task-column rounded-2xl border border-transparent p-3 flex flex-col ${isDraggingTime && sourceStatus !== col.status ? "drop-eligible" : ""} ${timeDragOverStatus === col.status ? "drag-over" : ""}`}
                onDragOver={(e) => onTimeDragOver(e, col.status)}
                onDragLeave={() => onTimeDragLeave(col.status)}
                onDrop={(e) => onTimeDrop(e, col.status)}
              >
                <div className={`text-center pt-3 mb-3 border-t-[3px] ${col.border}`}>
                  <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{col.label}</div>
                  <div className="text-2xl font-bold mt-1 tabular-nums">{col.items.length}</div>
                </div>
                <div className="task-col space-y-2 overflow-y-auto pr-1">
                  {col.items.length === 0 ? (
                    <div className="text-center py-8 text-sm text-muted-foreground">Bo&apos;sh</div>
                  ) : (
                    col.items.map((t) => (
                      <TaskCard
                        key={t.id}
                        task={t}
                        blocked={isTaskBlocked(t, tasks)}
                        isDragging={timeDraggingId === t.id}
                        onOpen={openEditModal}
                        onDragStart={onTimeDragStart}
                        onDragEnd={onTimeDragEnd}
                      />
                    ))
                  )}
                </div>
              </div>
            ))}
          </div>
        );
      })()}

      {modalOpen && (
        <TaskModal task={editingTask} initialDate={modalInitialDate} onClose={() => setModalOpen(false)} onSave={handleSaveModal} />
      )}
      {typesDrawerOpen && (
        <TaskTypesDrawer
          types={taskTypes.types}
          loading={taskTypes.loading}
          onCreate={taskTypes.create}
          onUpdate={taskTypes.update}
          onRemove={taskTypes.remove}
          onClose={() => setTypesDrawerOpen(false)}
        />
      )}

      {/* Yonidagi TaskModal (:574) va TaskTypesDrawer (:577) kabi — faqat
          ochilganda mount bo'ladi. Ilgari bu oyna shartsiz chizilardi va
          o'zi ichida `useStudents({light:true})` chaqirardi, ya'ni
          /tasks ning har ochilishida 546 KB / 1407 ms ketardi, oyna
          umuman ochilmasa ham. */}
      {templatesOpen && (
        <TaskTemplatesModal open onClose={() => setTemplatesOpen(false)} onApply={handleApplyTemplate} />
      )}

      {moveTaskTarget && (
        <MoveTaskModal
          task={moveTaskTarget}
          onClose={() => setMoveTaskId(null)}
          onConfirm={(isoDate) => {
            setTasks((prev) => prev.map((t) => (t.id === moveTaskTarget.id ? { ...t, date: isoDate } : t)));
            fetch(`/api/tasks/${moveTaskTarget.id}`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ date: isoDate }),
            }).catch(() => {});
            setMoveTaskId(null);
          }}
        />
      )}
    </div>
  );
}
