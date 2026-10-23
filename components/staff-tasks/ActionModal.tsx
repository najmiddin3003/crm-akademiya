"use client";

import { Loader2, Paperclip } from "lucide-react";
import Button from "@/components/ui/Button";
import DateField from "@/components/ui/DateField";
import Modal, { useModalClose } from "@/components/ui/Modal";
import TimeField from "@/components/ui/TimeField";
import type { StaffTask, StaffTaskFine } from "@/lib/staffTasks";
import type { StaffFmt } from "./format";
import { FILE_BTN } from "./TaskForm";
import { useTaskAction, type ActionTarget, type ActionTone } from "./useTaskAction";

// Topshiriq ustidagi AMAL OYNASI (prototipdagi modal()): «Bajardim»,
// «Tasdiqlash», «Qaytarish», «Bekor qilish» va jarimani bekor qilish.
// Oyna ui/Modal — kirish va chiqish animatsiyasi bilan; drawer ustida
// ochilsa ham Esc faqat shu oynani yopadi (Modal steki). Mantiq —
// useTaskAction.ts (yangi versiyadagi oyna bilan umumiy).

export type { TaskActionKind, ActionTarget } from "./useTaskAction";

/** Asosiy tugma rangi → tasks.css klassi (oddiy amal — `primary` tugma). */
const TONE_CLS: Record<ActionTone, string> = { primary: "", ok: "stk-btn-ok", warn: "stk-btn-warn", bad: "stk-btn-bad" };

interface Props {
  target: ActionTarget;
  nowMs: number;
  fmt: StaffFmt;
  onClose: () => void;
  onTaskDone: (task: StaffTask, message: string) => void;
  onFineDone: (fine: StaffTaskFine, message: string) => void;
}

export default function ActionModal({ target, nowMs, fmt, onClose, onTaskDone, onFineDone }: Props) {
  const { t } = fmt;
  const modal = useModalClose(onClose);
  const { kind, note, setNote, link, setLink, file, setFile, uploading, date, setDate, time, setTime, busy, tried, title, text, ok, tone, needNote, noteBad, dlBad, submit, pick } =
    useTaskAction({ target, nowMs, fmt, onDone: modal.close, onTaskDone, onFineDone });
  const okCls = TONE_CLS[tone];

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
