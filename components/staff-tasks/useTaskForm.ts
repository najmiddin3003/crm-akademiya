"use client";

import { useMemo, useState } from "react";
import { useToast } from "@/components/ui/Toast";
import {
  DAY_MS,
  HOUR_MS,
  quickDeadlines,
  uzDateOf,
  uzDayStart,
  uzTimeOf,
  uzWallToMs,
  type StaffTask,
  type StaffTaskBranch,
  type StaffTaskEmployee,
  type StaffTaskFile,
  type StaffTaskPriority,
  type StaffTaskSettings,
} from "@/lib/staffTasks";
import { api, uploadTaskFile } from "./api";
import type { StaffFmt } from "./format";

// TOPSHIRIQ QO'SHISH / TAHRIRLASH — FORMA MANTIQI. Eski drawer ichidagi forma
// (TaskForm.tsx) va yangi versiyadagi «Yangi topshiriq» oynasi
// (components/v2/tasks/TaskFormDialogV2.tsx) ikkalasi shundan ishlaydi
// (23.10.2026, TaskForm.tsx dan AYNAN ko'chirildi).
//
// Bir nechta xodim tanlansa har biriga ALOHIDA topshiriq yaratiladi — o'z
// holati va o'z jarimasi bilan. Tahrirlashda xodim o'zgarmaydi (boshqa odamga
// berish — yangi topshiriq).

/** Sukut deadline — ertaga 18:00 (tezkor tugmalardan biri). */
export function defaultDeadline(nowMs: number): number {
  return uzDayStart(nowMs) + DAY_MS + 18 * HOUR_MS;
}

export function useTaskForm({
  task,
  initialEmployeeIds,
  employees,
  branches,
  settings,
  nowMs,
  fmt,
  onBusy,
  onCreated,
  onUpdated,
}: {
  task: StaffTask | null;
  /** Yangi topshiriqda oldindan tanlangan xodim(lar) — faqat ro'yxatda bori olinadi. */
  initialEmployeeIds?: number[];
  employees: StaffTaskEmployee[];
  branches: StaffTaskBranch[];
  settings: StaffTaskSettings;
  nowMs: number;
  fmt: StaffFmt;
  /** Saqlash ketayotganini o'rab turgan oynaga aytadi (Esc/overlay bloklanadi). */
  onBusy?: (busy: boolean) => void;
  onCreated: (tasks: StaffTask[]) => void;
  onUpdated: (task: StaffTask) => void;
}) {
  const { t, stamp, rel, money } = fmt;
  const { showError } = useToast();
  const editing = !!task;
  const [title, setTitle] = useState(task?.title ?? "");
  const [desc, setDesc] = useState(task?.desc ?? "");
  const [link, setLink] = useState(task?.link ?? "");
  const [prio, setPrio] = useState<StaffTaskPriority>(task?.priority ?? 3);
  const initialDl = task ? Date.parse(task.deadline) : defaultDeadline(nowMs);
  const [date, setDate] = useState(uzDateOf(initialDl));
  const [time, setTime] = useState(uzTimeOf(initialDl));
  const [sel, setSel] = useState<number[]>(() => (task ? [] : (initialEmployeeIds ?? []).filter((id) => employees.some((e) => e.id === id))));
  const [q, setQ] = useState("");
  const [keep, setKeep] = useState<number[]>(() => (task?.attachments ?? []).map((_, i) => i));
  const [added, setAdded] = useState<StaffTaskFile[]>([]);
  const [uploading, setUploading] = useState(0);
  const [saving, setSaving] = useState(false);
  const [tried, setTried] = useState(false);

  const dl = uzWallToMs(date, time);
  const dlBad = !(dl > nowMs);
  const titleBad = !title.trim();
  const empBad = !editing && sel.length === 0;
  const branchName = useMemo(() => new Map(branches.map((b) => [b.id, b.name])), [branches]);

  const groups = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const byBranch = new Map<number, StaffTaskEmployee[]>();
    for (const e of employees) {
      if (needle && !e.name.toLowerCase().includes(needle)) continue;
      const list = byBranch.get(e.branchId) ?? [];
      list.push(e);
      byBranch.set(e.branchId, list);
    }
    return [...byBranch]
      .sort((a, b) => a[0] - b[0])
      .map(([id, list]) => ({ id, name: branchName.get(id) ?? t("Filial {n}", { n: id }), list }));
  }, [employees, q, branchName, t]);

  const selSet = useMemo(() => new Set(sel), [sel]);
  const empById = useMemo(() => new Map(employees.map((e) => [e.id, e])), [employees]);
  const toggle = (id: number) => setSel((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  const toggleGroup = (ids: number[], all: boolean) =>
    setSel((s) => (all ? s.filter((x) => !ids.includes(x)) : [...new Set([...s, ...ids])]));

  const quick = quickDeadlines(nowMs);
  const fine = settings.fines[String(prio)] ?? 0;

  const pickFiles = async (files: FileList | File[] | null) => {
    if (!files?.length) return;
    const list = Array.from(files);
    setUploading((n) => n + list.length);
    for (const file of list) {
      const r = await uploadTaskFile(file);
      if (r.ok) setAdded((a) => [...a, r.file]);
      else showError(r.error);
      setUploading((n) => n - 1);
    }
  };

  const save = async () => {
    setTried(true);
    if (titleBad || dlBad || empBad || uploading) return;
    setSaving(true);
    onBusy?.(true);
    const deadline = new Date(dl).toISOString();
    if (task) {
      const r = await api<{ task: StaffTask }>(`/api/staff-tasks/${task.id}`, {
        method: "PATCH",
        body: { title, desc, link, priority: prio, deadline, keepAttachments: keep, addAttachments: added },
      });
      setSaving(false);
      onBusy?.(false);
      if (r.ok) onUpdated(r.task);
      else showError(r.error);
    } else {
      const r = await api<{ tasks: StaffTask[] }>("/api/staff-tasks", {
        method: "POST",
        body: { title, desc, link, priority: prio, deadline, employeeIds: sel, attachments: added },
      });
      setSaving(false);
      onBusy?.(false);
      if (r.ok) onCreated(r.tasks);
      else showError(r.error);
    }
  };

  const summary =
    (editing ? "" : sel.length ? t("{n} xodimga alohida topshiriq beriladi.", { n: sel.length }) + " " : t("Hali xodim tanlanmagan.") + " ") +
    (dl > nowMs
      ? t("Deadline {deadline} ({rel}).", { deadline: stamp(dl, nowMs), rel: rel(dl, nowMs) }) + " "
      : t("Deadline hozirgi vaqtdan keyin bo'lishi kerak.") + " ") +
    t(sel.length > 1 && !editing ? "Bajarilmasa har biriga {fine} jarima (muhimlik {p}); avval {grace} soat qayta muddat beriladi." : "Bajarilmasa {fine} jarima (muhimlik {p}); avval {grace} soat qayta muddat beriladi.", {
      fine: money(fine),
      p: prio,
      grace: settings.graceHours,
    });

  return {
    editing,
    title,
    setTitle,
    desc,
    setDesc,
    link,
    setLink,
    prio,
    setPrio,
    date,
    setDate,
    time,
    setTime,
    sel,
    setSel,
    q,
    setQ,
    keep,
    setKeep,
    added,
    setAdded,
    uploading,
    saving,
    tried,
    dl,
    dlBad,
    titleBad,
    empBad,
    branchName,
    groups,
    selSet,
    empById,
    toggle,
    toggleGroup,
    quick,
    fine,
    pickFiles,
    save,
    summary,
  };
}

export type TaskFormState = ReturnType<typeof useTaskForm>;
