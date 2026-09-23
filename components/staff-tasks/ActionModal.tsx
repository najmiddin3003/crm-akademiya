"use client";

import { useState } from "react";
import { Loader2, Paperclip } from "lucide-react";
import Button from "@/components/ui/Button";
import DateField from "@/components/ui/DateField";
import Modal, { useModalClose } from "@/components/ui/Modal";
import TimeField from "@/components/ui/TimeField";
import { useToast } from "@/components/ui/Toast";
import { DAY_MS, HOUR_MS, ms, uzDateOf, uzDayStart, uzTimeOf, uzWallToMs, type StaffTask, type StaffTaskFile, type StaffTaskFine } from "@/lib/staffTasks";
import { api, uploadTaskFile } from "./api";
import type { StaffFmt } from "./format";
import { FILE_BTN } from "./TaskForm";

// Topshiriq ustidagi AMAL OYNASI (prototipdagi modal()): «Bajardim»,
// «Tasdiqlash», «Qaytarish», «Bekor qilish» va jarimani bekor qilish.
// Oyna ui/Modal — kirish va chiqish animatsiyasi bilan; drawer ustida
// ochilsa ham Esc faqat shu oynani yopadi (Modal steki).

export type TaskActionKind = "done" | "approve" | "return" | "cancel";

export type ActionTarget =
  | { kind: TaskActionKind; task: StaffTask }
  | { kind: "fineCancel"; fine: StaffTaskFine };

interface Props {
  target: ActionTarget;
  nowMs: number;
  fmt: StaffFmt;
  onClose: () => void;
  onTaskDone: (task: StaffTask, message: string) => void;
  onFineDone: (fine: StaffTaskFine, message: string) => void;
}

export default function ActionModal({ target, nowMs, fmt, onClose, onTaskDone, onFineDone }: Props) {
  const { t, money, monthLabel } = fmt;
  const { showError } = useToast();
  const modal = useModalClose(onClose);
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
  let okCls = "";
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
      okCls = "stk-btn-ok";
      break;
    case "return":
      title = t("Qaytarish");
      text = t("Nimani to'g'rilash kerakligini yozing va yangi deadline qo'ying — sanoq yangi muddatdan qaytadan boshlanadi.");
      ok = t("Qaytarish");
      okCls = "stk-btn-warn";
      break;
    case "cancel":
      title = t("Bekor qilish");
      text = t("Topshiriq yopiladi, jarima yozilmaydi. Sabab tarixga yoziladi va xodim ko'radi.");
      ok = t("Bekor qilish");
      okCls = "stk-btn-bad";
      break;
    case "fineCancel": {
      const f = target.fine;
      title = t("Jarimani bekor qilish");
      text = `${money(f.amount)}, ${f.employeeName}, ${monthLabel(f.month)}. ` + t("Sabab tarixga yoziladi va xodim ko'radi.");
      ok = t("Jarimani bekor qilish");
      okCls = "stk-btn-bad";
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
      modal.close();
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
    modal.close();
  };

  const pick = async (list: FileList | null) => {
    const f = list?.[0];
    if (!f) return;
    setUploading(true);
    const r = await uploadTaskFile(f);
    setUploading(false);
    if (r.ok) setFile(r.file);
    else showError(r.error);
  };

  return (
    <Modal
      controller={modal}
      onClose={onClose}
      title={title}
      size="md"
      locked={busy}
      zIndex={110}
      footer={
        <>
          <Button variant="outline" onClick={modal.close} disabled={busy}>
            {t("Bekor")}
          </Button>
          <Button variant={okCls ? "outline" : "primary"} className={okCls} onClick={submit} disabled={busy || uploading}>
            {busy && <Loader2 className="h-4 w-4 animate-spin" />}
            {ok}
          </Button>
        </>
      }
    >
      <p className="text-[13.5px] leading-relaxed text-foreground/80">{text}</p>

      {(kind === "done" || needNote) && (
        <div className="stk-field" style={{ marginBottom: 0 }}>
          <label className="stk-label" htmlFor="stk-act-note">
            {t(kind === "done" ? "Izoh" : kind === "return" ? "Izoh" : "Sabab")}
            {needNote && <small> {t("(majburiy)")}</small>}
          </label>
          <textarea
            id="stk-act-note"
            className={`stk-input ${tried && noteBad ? "is-err" : ""}`}
            value={note}
            autoFocus
            maxLength={4000}
            onChange={(e) => setNote(e.target.value)}
            placeholder={t(kind === "done" ? "Nima qilindi, natija qayerda" : kind === "return" ? "Kamchilik nimada" : "")}
          />
          {tried && noteBad && <div className="stk-err">{t("To'ldiring")}</div>}
        </div>
      )}

      {kind === "done" && (
        <>
          <div className="stk-field" style={{ marginBottom: 0 }}>
            <label className="stk-label" htmlFor="stk-act-link">{t("Natija havolasi")}</label>
            <input id="stk-act-link" className="stk-input" value={link} onChange={(e) => setLink(e.target.value)} placeholder="https://" maxLength={500} />
          </div>
          <div className="stk-field" style={{ marginBottom: 0 }}>
            <label className="stk-label">{t("Natija fayli")}</label>
            <div className="flex flex-wrap items-center gap-2">
              <label className={`stk-file-btn ${FILE_BTN} ${uploading ? "pointer-events-none opacity-60" : ""}`}>
                {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Paperclip className="h-4 w-4" />}
                {t(uploading ? "Yuklanmoqda…" : "Fayl tanlash")}
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp,application/pdf"
                  aria-label={t("Fayl tanlash")}
                  onChange={(e) => {
                    void pick(e.target.files);
                    e.target.value = "";
                  }}
                />
              </label>
              {file && (
                <span className="stk-tag">
                  <Paperclip className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate">{file.name}</span>
                  <button type="button" className="stk-tag-x" onClick={() => setFile(null)} aria-label={t("Olib tashlash")}>
                    ×
                  </button>
                </span>
              )}
            </div>
          </div>
        </>
      )}

      {kind === "return" && (
        <div className="stk-field" style={{ marginBottom: 0 }}>
          <label className="stk-label">
            {t("Yangi deadline")} <small>{t("(majburiy)")}</small>
          </label>
          <div className="stk-two">
            <DateField value={date} onChange={setDate} variant="form" error={tried && dlBad} />
            <TimeField value={time} onChange={setTime} variant="form" error={tried && dlBad} />
          </div>
          {tried && dlBad && <div className="stk-err">{t("Vaqt hozirgidan keyin bo'lishi kerak")}</div>}
        </div>
      )}
    </Modal>
  );
}
