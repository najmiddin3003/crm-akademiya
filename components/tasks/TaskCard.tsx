import {
  computeTaskRisk,
  formatTaskDate,
  getRecurrenceLabel,
  getRiskLabel,
  PRIORITY_META,
  taskUrgency,
  type Task,
} from "@/lib/tasksData";
import TaskReportChip from "@/components/tasks/TaskReportChip";

// "Vaqt" ko'rinishidagi topshiriq kartasi.
//
// MUDDAT CHIPI: ilgari uning tooltipi "Muddat — yakunlash uchun bosing"
// deb turardi, bosilganda esa faqat tahrirlash oynasini ochardi — ya'ni
// karta bajarib bo'lmaydigan narsani va'da qilardi. Endi chip ROSTINI
// aytadi: `onComplete` berilgan bo'lsa topshiriqni "bajarilgan" holatiga
// o'tkazadi, berilmagan bo'lsa tooltip ham shunchaki "ochish" deydi.
// Allaqachon bajarilgan topshiriqni qayta yakunlash mumkin emas — u
// holda chip yana oynani ochadi.
export interface TaskCardProps {
  task: Task;
  blocked: boolean;
  isDragging: boolean;
  onOpen: (id: number) => void;
  /** Berilsa — muddat chipi topshiriqni yakunlaydi (state → "bajarilgan"). */
  onComplete?: (id: number) => void;
  onDragStart: (e: React.DragEvent, id: number) => void;
  onDragEnd: (e: React.DragEvent) => void;
}

export default function TaskCard({ task, blocked, isDragging, onOpen, onComplete, onDragStart, onDragEnd }: TaskCardProps) {
  const pri = PRIORITY_META[task.priority];
  const risk = computeTaskRisk(task);
  const urgency = taskUrgency(task.date);
  const complete = onComplete && task.state !== "bajarilgan" ? onComplete : null;

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
          <TaskReportChip report={task.report} />
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
          onClick={() => (complete ? complete(task.id) : onOpen(task.id))}
          className={`inline-flex items-center rounded-md px-2 py-1 text-[11px] font-medium t-urgency-${urgency} tabular-nums cursor-pointer hover:opacity-80 transition-opacity`}
          title={complete ? "Muddat — yakunlash uchun bosing" : "Muddat — topshiriqni ochish uchun bosing"}
        >
          {formatTaskDate(task.date)}
        </button>
      </div>

      <div className="mt-1 text-[13px] leading-snug">{task.description}</div>
    </div>
  );
}
