import {
  computeTaskRisk,
  formatTaskDate,
  getRecurrenceLabel,
  getRiskLabel,
  PRIORITY_META,
  type Task,
} from "@/lib/tasksData";
import TaskReportChip from "@/components/tasks/TaskReportChip";

export interface KanbanCardProps {
  task: Task;
  blocked: boolean;
  isDragging: boolean;
  onOpen: (id: number) => void;
  onDragStart: (e: React.DragEvent, id: number) => void;
  onDragEnd: (e: React.DragEvent) => void;
}

export default function KanbanCard({ task, blocked, isDragging, onOpen, onDragStart, onDragEnd }: KanbanCardProps) {
  const pri = PRIORITY_META[task.priority];
  const risk = computeTaskRisk(task);

  return (
    <div
      className={`task-card priority-left-${task.priority} ${blocked ? "task-blocked" : ""} rounded-lg border border-border bg-card p-2.5 cursor-pointer transition-all hover:shadow-md`}
      style={{ opacity: isDragging ? 0.5 : 1 }}
      draggable={!blocked}
      onDragStart={(e) => onDragStart(e, task.id)}
      onDragEnd={onDragEnd}
      onClick={() => onOpen(task.id)}
    >
      <div className="flex items-center justify-between mb-1.5 gap-2 flex-wrap">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className={`priority-badge priority-${task.priority}`}>{pri.label}</span>
          {task.recurring !== "none" && <span className="recurring-badge">🔁 {getRecurrenceLabel(task.recurring)}</span>}
          {task.dependsOn && (
            <span className="dependency-badge" title={`Avval #${task.dependsOn} task'ni yakunlang`}>
              🔗 #{task.dependsOn}
            </span>
          )}
          <TaskReportChip report={task.report} />
        </div>
        {risk !== "normal" && risk !== "completed" && (
          <span className={`risk-indicator risk-${risk}`}>
            <span className="risk-dot" />
            {getRiskLabel(risk)}
          </span>
        )}
      </div>

      <div className="text-[12.5px] font-semibold text-primary">{task.student}</div>
      <div className="mt-1 text-[12px] leading-snug line-clamp-2">{task.description}</div>

      <div className="mt-2 flex items-center justify-between text-[10.5px] text-muted-foreground">
        <span className="inline-flex items-center gap-1">
          <svg className="icon" style={{ width: 11, height: 11 }}><use href="#i-calendar" /></svg>
          {formatTaskDate(task.date)}
        </span>
        {task.staff && (
          <span className="truncate max-w-[100px]" title={`Mas'ul: ${task.staff}`}>
            {task.staff.split(" ")[0]}
          </span>
        )}
      </div>
    </div>
  );
}
