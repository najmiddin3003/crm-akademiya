"use client";

import { useState } from "react";
import Button from "@/components/ui/Button";
import DateField from "@/components/ui/DateField";
import StudentSearchSelect from "@/components/orders/StudentSearchSelect";
import { useEscapeClose } from "@/hooks/useEscapeClose";
import { useTaskTypes } from "@/hooks/useTaskTypes";
import { useTaskTargets } from "@/hooks/useTaskTargets";
import { useStaff } from "@/hooks/useStaff";
import { selectPlaceholder } from "@/lib/selectPlaceholder";
import {
  RECURRENCE_OPTIONS,
  TASK_TARGET_KINDS,
  type Task,
  type TaskPriority,
  type TaskRecurring,
  type TaskTargetKind,
} from "@/lib/tasksData";
import Select from "@/components/ui/Select";

// Ported from crm-akademiya/src/app.js openTaskModal()/saveTask() (~line 4238).
//
// "O'quvchi" maydoni oynada YO'Q — referensdagi kabi (akademiya.edutizim.uz
// Topshiriq oynasi). Mavjud topshiriqni tahrirlaganda o'quvchi nomi
// o'zgarishsiz saqlanadi (`values.student`), yangi topshiriqda esa u bo'sh
// ketadi va TasksPage uni "Nomsiz o'quvchi" bilan to'ldiradi.
//
// "Sana" — brauzerning nativ <input type="date"> emas, o'zimiz yasagan
// components/ui/DateField.tsx (DD/MM/YYYY niqobi + kalendar), chunki nativ
// input brauzer tiliga qarab formatini o'zgartirib yuboradi.
//
// "Topshiriq turi" ro'yxati bazadan (/api/task-types) — uni Topshiriqlar
// sahifasidagi "⋮ → Topshiriq turi" paneli boshqaradi.
//
// "Kimga" — ikki bosqichli tanlov (referens: akademiya.edutizim.uz):
// avval TURI (O'quvchi / Guruh / Buyurtma), so'ng yonidagi ro'yxat shunga
// qarab bazadan to'ladi (hooks/useTaskTargets.ts). Ro'yxat uzun bo'lsa bir
// vaqtda 50 tasi chiziladi, qolganini qidiruvdan topiladi.
//
// "Saqlash" tugmasi majburiy maydonlar (sana, vaqt, mas'ul shaxs, turi,
// kimga) to'lgandagina yonadi; "Izoh" ixtiyoriy.

export interface TaskModalValues {
  student: string;
  /** Topshiriq kimga/nimaga biriktirilgan. */
  targetKind: TaskTargetKind;
  targetValue: string;
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
  return {
    student: "",
    targetKind: "student",
    targetValue: "",
    date: initialDate || "",
    time: "09:00",
    staff: "",
    type: "",
    priority: "orta",
    recurring: "none",
    note: "",
  };
}

function valuesFromTask(task: Task): TaskModalValues {
  const [datePart, timePart] = task.date.split("T");
  const targetKind = task.targetKind ?? (task.group ? "group" : "student");
  return {
    student: task.student,
    targetKind,
    targetValue: targetKind === "group" ? task.group || "" : task.student || "",
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
  const { types: taskTypes, loading: typesLoading } = useTaskTypes();
  const { byKind, loading: targetsLoading } = useTaskTargets();
  const { names: staffNames, loading: staffLoading } = useStaff();
  useEscapeClose(onClose);

  const targetOptions = byKind[values.targetKind] ?? [];
  const targetSubtitle = new Map(targetOptions.map((o) => [o.value, o.subtitle]));
  const targetLabel = TASK_TARGET_KINDS.find((k) => k.value === values.targetKind)?.label ?? "";

  // Tugma majburiy maydonlar to'lgandagina yonadi. "Izoh" — ixtiyoriy.
  const complete =
    Boolean(values.date) &&
    Boolean(values.time) &&
    Boolean(values.targetValue) &&
    Boolean(values.staff) &&
    Boolean(values.type);

  const set = <K extends keyof TaskModalValues>(key: K, value: TaskModalValues[K]) =>
    setValues((v) => ({ ...v, [key]: value }));

  // Turi almashsa oldingi tanlov boshqa ro'yxatdan qolib ketmasin.
  const setTargetKind = (kind: TaskTargetKind) =>
    setValues((v) => ({ ...v, targetKind: kind, targetValue: "" }));

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
        className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl border border-border bg-card shadow-2xl p-6 space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-lg font-semibold">{task ? "Topshiriqni o'zgartirish" : "Topshiriq"}</h3>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Sana</label>
            <DateField value={values.date} onChange={(iso) => set("date", iso)} error={dateError} />
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

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Mas&apos;ul shaxs</label>
            <Select value={values.staff} onChange={(v) => set("staff", v)} options={staffNames.map((s) => ({ value: s, label: s }))} placeholder={selectPlaceholder(staffLoading, staffNames.length, "Xodim qo'shilmagan")} clearable size="sm" disabled={staffLoading} />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Topshiriq turi</label>
            <Select value={values.type} onChange={(v) => set("type", v)} options={[...(values.type && !taskTypes.some((t) => t.name === values.type) ? [{ value: values.type, label: values.type }] : []), ...taskTypes.map((t) => ({ value: t.name, label: t.name }))]} placeholder={selectPlaceholder(typesLoading, taskTypes.length, "Topshiriq turi qo'shilmagan")} clearable size="sm" disabled={typesLoading} />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Kimga</label>
            <Select value={values.targetKind} onChange={(v) => setTargetKind(v as TaskTargetKind)} options={TASK_TARGET_KINDS.map((k) => ({ value: k.value, label: k.label }))} size="sm" />
          </div>
          <StudentSearchSelect
            variant="compact"
            label={targetLabel}
            value={values.targetValue}
            onChange={(v) => set("targetValue", v)}
            options={targetOptions.map((o) => o.value)}
            subtitleOf={(name) => targetSubtitle.get(name) ?? ""}
            placeholder={`${targetLabel}ni qidirish`}
            loading={targetsLoading}
            limit={50}
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Muhimlik</label>
            <Select value={values.priority} onChange={(v) => set("priority", v as TaskPriority)} options={[{ value: "kritik", label: "Kritik" }, { value: "yuqori", label: "Yuqori" }, { value: "orta", label: "O'rta" }, { value: "past", label: "Past" }]} size="sm" />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Takrorlanish</label>
            <Select value={values.recurring} onChange={(v) => set("recurring", v as TaskRecurring)} options={RECURRENCE_OPTIONS.map((o) => ({ value: o.value, label: o.label }))} size="sm" />
          </div>
        </div>

        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1 block">Izoh</label>
          <textarea
            value={values.note}
            onChange={(e) => set("note", e.target.value)}
            rows={4}
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm resize-y focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div className="flex justify-end gap-2 pt-1">
          <Button variant="outline" onClick={onClose}>Bekor qilish</Button>
          <Button variant="primary" onClick={handleSave} disabled={!complete}>Saqlash</Button>
        </div>
      </div>
    </div>
  );
}
