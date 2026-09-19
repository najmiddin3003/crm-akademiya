"use client";

import { computeTaskRisk, type Task } from "@/lib/tasksData";
import { useT } from "@/components/shared/Language";

export interface RiskDashboardProps {
  tasks: Task[];
}

export default function RiskDashboard({ tasks }: RiskDashboardProps) {
  const { t } = useT();
  const stats = { overdue: 0, danger: 0, kritik: 0, total: 0, completed: 0 };
  for (const tv of tasks) {
    stats.total++;
    if (tv.state === "bajarilgan") {
      stats.completed++;
      continue;
    }
    const r = computeTaskRisk(tv);
    if (r === "overdue") stats.overdue++;
    if (r === "danger") stats.danger++;
    if (tv.priority === "kritik") stats.kritik++;
  }
  const pct = stats.total > 0 ? Math.round((stats.completed / stats.total) * 100) : 0;

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5 mb-4">
      <div className="risk-widget">
        <div className="risk-widget-icon" style={{ background: "hsl(0 84% 60% / 0.13)", color: "hsl(0 72% 51%)" }}>
          <svg className="icon icon-sm"><use href="#i-alert-triangle" /></svg>
        </div>
        <div>
          <div className="text-[11px] text-muted-foreground">{t("Muddati o'tgan")}</div>
          <div className="text-[17px] font-bold tabular-nums">{stats.overdue}</div>
        </div>
      </div>
      <div className="risk-widget">
        <div className="risk-widget-icon" style={{ background: "hsl(38 92% 50% / 0.15)", color: "hsl(38 92% 50%)" }}>
          <svg className="icon icon-sm"><use href="#i-clock" /></svg>
        </div>
        <div>
          <div className="text-[11px] text-muted-foreground">{t("Xavf ostida")}</div>
          <div className="text-[17px] font-bold tabular-nums">{stats.danger}</div>
        </div>
      </div>
      <div className="risk-widget">
        <div className="risk-widget-icon" style={{ background: "hsl(0 84% 60% / 0.13)", color: "hsl(0 72% 51%)" }}>
          <svg className="icon icon-sm"><use href="#i-flag" /></svg>
        </div>
        <div>
          <div className="text-[11px] text-muted-foreground">{t("KRITIK darajada")}</div>
          <div className="text-[17px] font-bold tabular-nums">{stats.kritik}</div>
        </div>
      </div>
      <div className="risk-widget">
        <div className="risk-widget-icon" style={{ background: "hsl(142 71% 41% / 0.13)", color: "hsl(142 71% 41%)" }}>
          <svg className="icon icon-sm"><use href="#i-check" /></svg>
        </div>
        <div>
          <div className="text-[11px] text-muted-foreground">{t("Yakunlangan")}</div>
          <div className="text-[17px] font-bold tabular-nums">{pct}%</div>
        </div>
      </div>
    </div>
  );
}
