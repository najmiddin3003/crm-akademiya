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
  compareTasksForSort,
  KANBAN_STATES,
  TASK_TEMPLATES,
  todayStart,
  type Task,
  type TaskState,
} from "@/lib/tasksData";

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
  // "Mas'ul shaxs" ro'yxati bazadagi aktiv xodimlardan.
  const { names: staffNames } = useStaff();
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
        const soonEnd = new Date(todayStart().getTime() + 3 * 86400000);
        return getTaskStatus(t) === "upcoming" && new Date(t.date).getTime() <= soonEnd.getTime();
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

  const handleSaveModal = async (values: TaskModalValues) => {
    const isoDate = `${values.date}T${values.time || "09:00"}:00`;
    // Topshiriq kimga biriktirilgani: kartada sarlavha sifatida `student`
    // ko'rinadi, guruh tanlansa qo'shimcha ravishda `group` ham to'ladi.
    const target = values.targetValue.trim();
    if (modalTaskId != null) {
      const patch = {
        date: isoDate,
        description: values.note || undefined,
        staff: values.staff || undefined,
        type: values.type || undefined,
        priority: values.priority,
        recurring: values.recurring,
        student: target,
        group: values.targetKind === "group" ? target : "",
        targetKind: values.targetKind,
      };
      setTasks((prev) => prev.map((t) => (t.id === modalTaskId ? { ...t, ...patch, description: patch.description || t.description, staff: patch.staff || t.staff, type: patch.type || t.type } : t)));
      fetch(`/api/tasks/${modalTaskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      }).catch(() => {});
    } else {
      const newTask: Omit<Task, "id"> = {
        student: target,
        group: values.targetKind === "group" ? target : undefined,
        targetKind: values.targetKind,
        date: isoDate,
        description: values.note || values.type || "Yangi topshiriq",
        staff: values.staff || undefined,
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
        date: new Date(now + item.offsetHours * 3600000).toISOString().slice(0, 16),
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
    fetch(`/api/tasks/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ state }),
    }).catch(() => {});
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
    const today = todayStart().getTime();
    const anchor = targetStatus === "today" ? today : today - 86400000;
    const newDate = new Date(anchor);
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
          <div className="relative">
            <select
              value={filters.responsible}
              onChange={(e) => setFilter("responsible", e.target.value)}
              className="filter-select h-9 w-36 appearance-none rounded-lg border border-border bg-card px-3 pr-8 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Mas&apos;ul shaxs</option>
              {staffNames.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div className="relative">
            <select
              value={filters.student}
              onChange={(e) => setFilter("student", e.target.value)}
              className="filter-select h-9 w-32 appearance-none rounded-lg border border-border bg-card px-3 pr-8 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">O&apos;quvchi</option>
              {studentOptions.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div className="relative">
            <select
              value={filters.type}
              onChange={(e) => setFilter("type", e.target.value)}
              className="filter-select h-9 w-40 appearance-none rounded-lg border border-border bg-card px-3 pr-8 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Topshiriq turi</option>
              {taskTypes.types.map((t) => <option key={t.id} value={t.name}>{t.name}</option>)}
            </select>
          </div>
          {groupOptions.length > 0 && (
            <div className="relative">
              <select
                value={filters.group}
                onChange={(e) => setFilter("group", e.target.value)}
                className="filter-select h-9 w-32 appearance-none rounded-lg border border-border bg-card px-3 pr-8 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Guruh</option>
                {groupOptions.map((g) => <option key={g} value={g}>{g}</option>)}
              </select>
            </div>
          )}
          <input
            type="date"
            value={filters.from}
            onChange={(e) => setFilter("from", e.target.value)}
            className="filter-select h-9 rounded-lg border border-border bg-card px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            title="Boshlanish sanasi"
          />
          <input
            type="date"
            value={filters.to}
            onChange={(e) => setFilter("to", e.target.value)}
            className="filter-select h-9 rounded-lg border border-border bg-card px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            title="Tugash sanasi"
          />
          <div className="relative">
            <select
              value={filters.status}
              onChange={(e) => setFilter("status", e.target.value)}
              className="filter-select h-9 w-32 appearance-none rounded-lg border border-border bg-card px-3 pr-8 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Holati</option>
              {KANBAN_STATES.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
            </select>
          </div>
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

      <TaskTemplatesModal open={templatesOpen} onClose={() => setTemplatesOpen(false)} onApply={handleApplyTemplate} />

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
