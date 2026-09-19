"use client";

import { getTaskStatus, type Task } from "@/lib/tasksData";
import { uzDayKey, uzDayKeyIn } from "@/lib/uzTime";
import { useT } from "@/components/shared/Language";

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
  const { t } = useT();
  const total = tasks.length;
  const dueToday = tasks.filter((tv) => getTaskStatus(tv) === "today").length;
  const late = tasks.filter((tv) => getTaskStatus(tv) === "overdue").length;
  // Kunlar Toshkent taqvimi bo'yicha taqqoslanadi (lib/uzTime.ts).
  const soonEnd = uzDayKeyIn(3);
  const dueSoon = tasks.filter(
    (tv) => getTaskStatus(tv) === "upcoming" && uzDayKey(new Date(tv.date)) <= soonEnd,
  ).length;
  const done = tasks.filter((tv) => tv.state === "bajarilgan").length;

  const widgets: { key: DashboardFilter; label: string; value: number | string; icon: string; className: string }[] = [
    { key: "all", label: t("Jami"), value: total, icon: "i-list-todo", className: "t-widget-total" },
    { key: "today", label: t("Bugun muddat"), value: dueToday, icon: "i-calendar", className: "t-widget-today" },
    { key: "late", label: t("Kechikkan"), value: late, icon: "i-alert-triangle", className: "t-widget-late" },
    { key: "soon", label: "48 soat ichida", value: dueSoon, icon: "i-clock", className: "t-widget-soon" },
    { key: "done", label: t("Bajarilgan"), value: done, icon: "i-check-circle", className: "t-widget-done" },
  ];

  return (
    <div className="t-dashboard">
      {widgets.map((w) => (
        <div
          key={w.key}
          className={`t-widget ${w.className} ${active === w.key ? "active" : ""}`}
          onClick={() => onChange(w.key)}
          title={t(w.label)}
        >
          <div className="t-widget-icon"><svg className="icon"><use href={`#${w.icon}`} /></svg></div>
          <div className="t-widget-body">
            <div className="t-widget-value">{w.value}</div>
            <div className="t-widget-label">{t(w.label)}</div>
          </div>
        </div>
      ))}
    </div>
  );
}
