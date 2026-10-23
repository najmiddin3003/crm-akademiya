"use client";

import { useState } from "react";
import { useToast } from "@/components/ui/Toast";
import { DAY_MS, HOUR_MS, ms, uzDateOf, uzDayStart, uzTimeOf, uzWallToMs, type StaffTask, type StaffTaskFile, type StaffTaskFine } from "@/lib/staffTasks";
import { api, uploadTaskFile } from "./api";
import type { StaffFmt } from "./format";

// TOPSHIRIQ USTIDAGI AMAL — MANTIQ: «Bajardim», «Tasdiqlash», «Qaytarish», «Bekor
// qilish» va jarimani bekor qilish. Eski oyna (ActionModal.tsx) va yangi
// versiyadagi oyna (components/v2/tasks/TaskActionDialogV2.tsx) ikkalasi shundan
// ishlaydi (23.10.2026, ActionModal.tsx dan AYNAN ko'chirildi).

export type TaskActionKind = "done" | "approve" | "return" | "cancel";

export type ActionTarget =
  | { kind: TaskActionKind; task: StaffTask }
  | { kind: "fineCancel"; fine: StaffTaskFine };

/** Asosiy tugmaning rangi: oddiy (brend), tasdiq (yashil), qaytarish (sariq), xavfli (qizil). */
export type ActionTone = "primary" | "ok" | "warn" | "bad";

export function useTaskAction({
  target,
  nowMs,
  fmt,
  onDone,
  onTaskDone,
  onFineDone,
}: {
  target: ActionTarget;
  nowMs: number;
  fmt: StaffFmt;
  /** Muvaffaqiyatli bajarilgach — oynani yopish. */
  onDone: () => void;
  onTaskDone: (task: StaffTask, message: string) => void;
  onFineDone: (fine: StaffTaskFine, message: string) => void;
}) {
  const { t, money, monthLabel } = fmt;
  const { showError } = useToast();
  const [note, setNote] = useState("");
  const [link, setLink] = useState("");
  const [file, setFile] = useState<StaffTaskFile | null>(null);
  const [uploading, setUploading] = useState(false);
  const initial = uzDayStart(nowMs) + DAY_MS + 18 * HOUR_MS;
  const [date, setDate] = useState(uzDateOf(initial));
  const [time, setTime] = useState(uzTimeOf(initial));
  const [busy, setBusy] = useState(false);
  const [tried, setTried] = useState(false);

  const kind = target.kind;
  const task = target.kind === "fineCancel" ? null : target.task;
  const lateNow = task ? nowMs > ms(task.deadline) : false;
  const dl = uzWallToMs(date, time);

  let title = "";
  let text = "";
  let ok = "";
  let tone: ActionTone = "primary";
  switch (kind) {
    case "done":
      title = t("Bajardim");
      text = t("Natijani qisqacha yozing. Rahbar tasdiqlagach topshiriq yakunlanadi.") +
        (lateNow ? " " + t("Deadline o'tgan — «kechikib bajarildi» deb belgilanadi, jarima yozilmaydi.") : "");
      ok = t("Bajardim");
      break;
    case "approve":
      title = t("Tasdiqlash");
      text = t("«{title}» yakunlangan deb tasdiqlaysizmi?", { title: task?.title ?? "" }) +
        (task?.isLate ? " " + t("Xodim kechikib bajargan — jarima yozilmaydi, statistikada belgilanadi.") : "");
      ok = t("Tasdiqlash");
      tone = "ok";
      break;
    case "return":
      title = t("Qaytarish");
      text = t("Nimani to'g'rilash kerakligini yozing va yangi deadline qo'ying — sanoq yangi muddatdan qaytadan boshlanadi.");
      ok = t("Qaytarish");
      tone = "warn";
      break;
    case "cancel":
      title = t("Bekor qilish");
      text = t("Topshiriq yopiladi, jarima yozilmaydi. Sabab tarixga yoziladi va xodim ko'radi.");
      ok = t("Bekor qilish");
      tone = "bad";
      break;
    case "fineCancel": {
      const f = target.fine;
      title = t("Jarimani bekor qilish");
      text = `${money(f.amount)}, ${f.employeeName}, ${monthLabel(f.month)}. ` + t("Sabab tarixga yoziladi va xodim ko'radi.");
      ok = t("Jarimani bekor qilish");
      tone = "bad";
      break;
    }
  }

  const needNote = kind === "return" || kind === "cancel" || kind === "fineCancel";
  const noteBad = needNote && !note.trim();
  const dlBad = kind === "return" && !(dl > nowMs);

  const submit = async () => {
    setTried(true);
    if (noteBad || dlBad || uploading) return;
    setBusy(true);
    if (target.kind === "fineCancel") {
      const r = await api<{ fine: StaffTaskFine }>(`/api/staff-tasks/fines/${target.fine.id}`, { method: "POST", body: { reason: note } });
      setBusy(false);
      if (!r.ok) return showError(r.error);
      onFineDone(r.fine, t("Jarima bekor qilindi"));
      onDone();
      return;
    }
    const body: Record<string, unknown> = { action: kind };
    if (kind === "done") Object.assign(body, { note, link, file });
    if (kind === "return") Object.assign(body, { note, deadline: new Date(dl).toISOString() });
    if (kind === "cancel") Object.assign(body, { reason: note });
    const r = await api<{ task: StaffTask }>(`/api/staff-tasks/${target.task.id}`, { method: "POST", body });
    setBusy(false);
    if (!r.ok) return showError(r.error);
    const msg =
      kind === "done" ? t("Bajardim belgilandi — rahbar tasdig'i kutilmoqda")
      : kind === "approve" ? t("Yakunlandi")
      : kind === "return" ? t("Qaytarildi")
      : t("Bekor qilindi");
    onTaskDone(r.task, msg);
    onDone();
  };

  const pick = async (list: FileList | File[] | null) => {
    const f = list?.[0];
    if (!f) return;
    setUploading(true);
    const r = await uploadTaskFile(f);
    setUploading(false);
    if (r.ok) setFile(r.file);
    else showError(r.error);
  };

  return {
    kind,
    task,
    lateNow,
    note,
    setNote,
    link,
    setLink,
    file,
    setFile,
    uploading,
    date,
    setDate,
    time,
    setTime,
    busy,
    tried,
    dl,
    title,
    text,
    ok,
    tone,
    needNote,
    noteBad,
    dlBad,
    submit,
    pick,
  };
}
