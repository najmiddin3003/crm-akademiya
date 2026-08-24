import { getTaskStatus, todayStart, type Task } from "@/lib/tasksData";

export type DashboardFilter = "all" | "today" | "late" | "soon" | "done";

export interface TaskDashboardWidgetsProps {
  tasks: Task[];
  active: DashboardFilter;
  onChange: (filter: DashboardFilter) => void;
}

// Ported from crm-akademiya/src/app.js renderTaskDashboard() (~line 1112).
// The original's 5th widget ("Tekshirilgan") tracks a submission-grading
// workflow that isn't ported yet, so it's repurposed here as "Bajarilgan"
// (completed) — same widget slot, closest available concept in this build.
export default function TaskDashboardWidgets({ tasks, active, onChange }: TaskDashboardWidgetsProps) {
  const total = tasks.length;
  const dueToday = tasks.filter((t) => getTaskStatus(t) === "today").length;
  const late = tasks.filter((t) => getTaskStatus(t) === "overdue").length;
  const soonEnd = new Date(todayStart().getTime() + 3 * 86400000);
  const dueSoon = tasks.filter((t) => {
    const d = new Date(t.date);
    return getTaskStatus(t) === "upcoming" && d.getTime() <= soonEnd.getTime();
  }).length;
  const done = tasks.filter((t) => t.state === "bajarilgan").length;

  const widgets: { key: DashboardFilter; label: string; value: number | string; icon: string; className: string }[] = [
    { key: "all", label: "Jami", value: total, icon: "i-list-todo", className: "t-widget-total" },
    { key: "today", label: "Bugun muddat", value: dueToday, icon: "i-calendar", className: "t-widget-today" },
    { key: "late", label: "Kechikkan", value: late, icon: "i-alert-triangle", className: "t-widget-late" },
    { key: "soon", label: "48 soat ichida", value: dueSoon, icon: "i-clock", className: "t-widget-soon" },
    { key: "done", label: "Bajarilgan", value: done, icon: "i-check-circle", className: "t-widget-done" },
  ];

  return (
    <div className="t-dashboard">
      {widgets.map((w) => (
        <div
          key={w.key}
          className={`t-widget ${w.className} ${active === w.key ? "active" : ""}`}
          onClick={() => onChange(w.key)}
          title={w.label}
        >
          <div className="t-widget-icon"><svg className="icon"><use href={`#${w.icon}`} /></svg></div>
          <div className="t-widget-body">
            <div className="t-widget-value">{w.value}</div>
            <div className="t-widget-label">{w.label}</div>
          </div>
        </div>
      ))}
    </div>
  );
}
