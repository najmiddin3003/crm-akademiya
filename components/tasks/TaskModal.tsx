"use client";

import { useState } from "react";
import Button from "@/components/ui/Button";
import { useEscapeClose } from "@/hooks/useEscapeClose";
import {
  RECURRENCE_OPTIONS,
  STAFF,
  TASK_TYPES,
  type Task,
  type TaskPriority,
  type TaskRecurring,
} from "@/lib/tasksData";

// Ported from crm-akademiya/src/app.js openTaskModal()/saveTask() (~line 4238).
// Deviation from source: the original auto-generates a random demo student name
// for new tasks (via window.prompt is not used there — a `pick()` helper is);
// here the user types the student name directly since there's no backend to
// pick a real student from yet.

export interface TaskModalValues {
  student: string;
  date: string;
  time: string;
  staff: string;
  type: string;
  priority: TaskPriority;
  recurring: TaskRecurring;
  note: string;
}

export interface TaskModalProps {
  task: Task | null;
  initialDate?: string;
  onClose: () => void;
  onSave: (values: TaskModalValues) => void;
}

function blankValues(initialDate?: string): TaskModalValues {
  return { student: "", date: initialDate || "", time: "09:00", staff: "", type: "", priority: "orta", recurring: "none", note: "" };
}

function valuesFromTask(task: Task): TaskModalValues {
  const [datePart, timePart] = task.date.split("T");
  return {
    student: task.student,
    date: datePart || "",
    time: (timePart || "09:00").slice(0, 5),
    staff: task.staff || "",
    type: task.type || "",
    priority: task.priority,
    recurring: task.recurring,
    note: task.description,
  };
}

// Mounted only while open (see TasksPage), so this initializer runs fresh
// every time the modal opens — no effect-based state sync needed.
export default function TaskModal({ task, initialDate, onClose, onSave }: TaskModalProps) {
  const [values, setValues] = useState<TaskModalValues>(() => (task ? valuesFromTask(task) : blankValues(initialDate)));
  const [dateError, setDateError] = useState(false);
  useEscapeClose(onClose);

  const set = <K extends keyof TaskModalValues>(key: K, value: TaskModalValues[K]) =>
    setValues((v) => ({ ...v, [key]: value }));

  const handleSave = () => {
    if (!values.date) {
      setDateError(true);
      setTimeout(() => setDateError(false), 1500);
      return;
    }
    onSave(values);
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div
        className="w-full max-w-md rounded-2xl border border-border bg-card shadow-2xl p-5 space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-lg font-semibold">{task ? "Topshiriqni o'zgartirish" : "Topshiriq"}</h3>

        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1 block">O&apos;quvchi</label>
          <input
            value={values.student}
            onChange={(e) => set("student", e.target.value)}
            readOnly={!!task}
            placeholder="Ism Familiya"
            className={`h-9 w-full rounded-lg border border-border px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${task ? "bg-secondary/40" : "bg-background"}`}
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Sana</label>
            <input
              type="date"
              value={values.date}
              onChange={(e) => set("date", e.target.value)}
              className={`h-9 w-full rounded-lg border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${dateError ? "ring-2 ring-red-400 border-red-400" : "border-border"}`}
            />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Vaqt</label>
            <input
              type="time"
              value={values.time}
              onChange={(e) => set("time", e.target.value)}
              className="h-9 w-full rounded-lg border border-border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1 block">Mas&apos;ul shaxs</label>
          <select
            value={values.staff}
            onChange={(e) => set("staff", e.target.value)}
            className="h-9 w-full rounded-lg border border-border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Tanlang</option>
            {STAFF.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1 block">Topshiriq turi</label>
          <select
            value={values.type}
            onChange={(e) => set("type", e.target.value)}
            className="h-9 w-full rounded-lg border border-border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Tanlang</option>
            {TASK_TYPES.map((t) => (
              <option key={t.id} value={t.name}>{t.name}</option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Muhimlik</label>
            <select
              value={values.priority}
              onChange={(e) => set("priority", e.target.value as TaskPriority)}
              className="h-9 w-full rounded-lg border border-border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="kritik">Kritik</option>
              <option value="yuqori">Yuqori</option>
              <option value="orta">O&apos;rta</option>
              <option value="past">Past</option>
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Takrorlanish</label>
            <select
              value={values.recurring}
              onChange={(e) => set("recurring", e.target.value as TaskRecurring)}
              className="h-9 w-full rounded-lg border border-border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {RECURRENCE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1 block">Izoh</label>
          <textarea
            value={values.note}
            onChange={(e) => set("note", e.target.value)}
            rows={3}
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div className="flex justify-end gap-2 pt-1">
          <Button variant="outline" onClick={onClose}>Bekor qilish</Button>
          <Button variant="primary" onClick={handleSave}>Saqlash</Button>
        </div>
      </div>
    </div>
  );
}
