import {
  computeTaskRisk,
  formatTaskDate,
  getRecurrenceLabel,
  getRiskLabel,
  PRIORITY_META,
  taskUrgency,
  type Task,
} from "@/lib/tasksData";

export interface TaskCardProps {
  task: Task;
  blocked: boolean;
  isDragging: boolean;
  onOpen: (id: number) => void;
  onDragStart: (e: React.DragEvent, id: number) => void;
  onDragEnd: (e: React.DragEvent) => void;
}

export default function TaskCard({ task, blocked, isDragging, onOpen, onDragStart, onDragEnd }: TaskCardProps) {
  const pri = PRIORITY_META[task.priority];
  const risk = computeTaskRisk(task);
  const urgency = taskUrgency(task.date);

  return (
    <div
      className={`task-card priority-left-${task.priority} ${blocked ? "task-blocked" : ""} ${isDragging ? "dragging" : ""} rounded-xl border border-border bg-card p-3 transition-all`}
      draggable={!blocked}
      onDragStart={(e) => onDragStart(e, task.id)}
      onDragEnd={onDragEnd}
    >
      <div className="flex items-center justify-between gap-2 mb-1.5 flex-wrap">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className={`priority-badge priority-${task.priority}`}>{pri.label}</span>
          {task.recurring !== "none" && <span className="recurring-badge">🔁 {getRecurrenceLabel(task.recurring)}</span>}
          {task.dependsOn && (
            <span className="dependency-badge" title={`Avval #${task.dependsOn} task'ni yakunlang`}>
              🔗 #{task.dependsOn}
            </span>
          )}
        </div>
        {risk !== "normal" && risk !== "completed" && (
          <span className={`risk-indicator risk-${risk}`}>
            <span className="risk-dot" />
            {getRiskLabel(risk)}
          </span>
        )}
      </div>

      <button onClick={() => onOpen(task.id)} className="text-[13px] font-semibold text-primary hover:underline cursor-pointer text-left">
        {task.student}
      </button>

      <div className="mt-2 flex items-center gap-1.5 flex-wrap">
        <button
          onClick={() => onOpen(task.id)}
          className={`inline-flex items-center rounded-md px-2 py-1 text-[11px] font-medium t-urgency-${urgency} tabular-nums cursor-pointer hover:opacity-80 transition-opacity`}
          title="Muddat — yakunlash uchun bosing"
        >
          {formatTaskDate(task.date)}
        </button>
      </div>

      <div className="mt-1 text-[13px] leading-snug">{task.description}</div>
    </div>
  );
}
