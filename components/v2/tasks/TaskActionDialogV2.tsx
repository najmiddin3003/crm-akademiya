"use client";

import { useRef } from "react";
import { Calendar, Check, Loader2, Paperclip, X } from "lucide-react";
import { useT } from "@/components/shared/Language";
import { useModalClose } from "@/components/ui/Modal";
import V2Dialog from "@/components/v2/form/V2Dialog";
import V2DateField from "@/components/v2/form/V2DateField";
import V2TimeField from "@/components/v2/form/V2TimeField";
import { Field, FieldError, FieldLabel, TextInput, fieldCls } from "@/components/v2/form/fields";
import { primaryBtn, secondaryBtn } from "@/components/v2/ui/buttons";
import { useTaskAction, type ActionTarget } from "@/components/staff-tasks/useTaskAction";
import type { StaffFmt } from "@/components/staff-tasks/format";
import type { StaffTask, StaffTaskFine } from "@/lib/staffTasks";
import { useTaskV2Fmt } from "./taskBitsV2";

// YANGI VERSIYA — TOPSHIRIQ USTIDAGI AMAL OYNASI: «Bajardim», «Tasdiqlash»,
// «Qaytarish», «Bekor qilish», jarimani bekor qilish. Rasmi yo'q (ro'yxatdagi
// «✓ Tasdiqlash» va «↩» tugmalari shu oynani ochadi) — forma qoidalari bo'yicha
// (V2Dialog, maydonlar fields.tsx). Mantiq eski oyna bilan BITTA —
// components/staff-tasks/useTaskAction.ts.

const textareaCls = (bad: boolean) =>
  `block min-h-[72px] w-full resize-y rounded-v2-md border bg-v2-surface! px-3 py-2 text-v2-body text-v2-text placeholder:text-v2-text-3 transition-[border-color,box-shadow] focus:outline-none ${
    bad
      ? "border-v2-danger focus:shadow-[0_0_0_3px_color-mix(in_srgb,var(--v2-danger)_18%,transparent)]"
      : "border-v2-border-field focus:border-v2-brand focus:shadow-v2-focus"
  }`;

function dateOfIso(iso: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : null;
}
function isoOfDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export default function TaskActionDialogV2({
  target,
  nowMs,
  fmt,
  onClose,
  onTaskDone,
  onFineDone,
}: {
  target: ActionTarget;
  nowMs: number;
  fmt: StaffFmt;
  onClose: () => void;
  onTaskDone: (task: StaffTask, message: string) => void;
  onFineDone: (fine: StaffTaskFine, message: string) => void;
}) {
  const { t } = useT();
  const vf = useTaskV2Fmt();
  const modal = useModalClose(onClose, "center");
  const a = useTaskAction({ target, nowMs, fmt, onDone: modal.close, onTaskDone, onFineDone });
  const fileRef = useRef<HTMLInputElement>(null);
  const { kind, tried } = a;
  const danger = a.tone === "bad";
  const dateObj = dateOfIso(a.date);
  const subtitle = target.kind === "fineCancel" ? target.fine.taskTitle : target.task.title;
  // «Bekor qilish» amalida pastki tugmalar chalkashmasin: yopish — «Yopish».
  const okLabel = kind === "cancel" ? t("Topshiriqni bekor qilish") : a.ok;
  const dirty = !!(a.note.trim() || a.link.trim() || a.file);

  return (
    <V2Dialog
      controller={modal}
      title={a.title}
      subtitle={subtitle}
      width={480}
      onClose={onClose}
      dirty={dirty}
      saving={a.busy}
      onSubmit={() => void a.submit()}
      footer={(api) => (
        <>
          <button type="button" onClick={api.requestClose} disabled={a.busy} className={`${secondaryBtn} justify-center`}>
            {kind === "cancel" || kind === "fineCancel" ? t("Yopish") : t("Bekor qilish")}
          </button>
          <button
            type="button"
            onClick={() => void a.submit()}
            disabled={a.busy || a.uploading}
            // «Tasdiqlash»da maydon yo'q — fokus shu tugmada, Enter tasdiqlaydi (pastdagi «Enter saqlash»).
            autoFocus={kind === "approve"}
            className={
              danger
                ? "inline-flex h-9 shrink-0 items-center justify-center gap-2 rounded-v2-md bg-v2-danger px-4 text-v2-body font-semibold text-v2-on-danger transition-[filter] hover:brightness-95 focus-visible:shadow-v2-focus focus-visible:outline-none disabled:opacity-60"
                : `${primaryBtn} justify-center disabled:opacity-60`
            }
          >
            {a.busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : !danger && <Check className="size-4" strokeWidth={2} aria-hidden />}
            {okLabel}
          </button>
        </>
      )}
    >
      <div className="space-y-4">
        <p className="text-v2-small text-v2-text-2">{a.text}</p>

        {(kind === "done" || a.needNote) && (
          <Field
            label={kind === "cancel" || kind === "fineCancel" ? t("Sabab") : t("Izoh")}
            optional={!a.needNote}
            htmlFor="tav2-note"
            error={tried && a.noteBad ? t("To'ldiring") : undefined}
          >
            <textarea
              id="tav2-note"
              data-autofocus=""
              value={a.note}
              rows={3}
              maxLength={4000}
              onChange={(e) => a.setNote(e.target.value)}
              placeholder={kind === "done" ? t("Nima qilindi, natija qayerda") : kind === "return" ? t("Kamchilik nimada") : ""}
              className={textareaCls(tried && a.noteBad)}
            />
          </Field>
        )}

        {kind === "done" && (
          <>
            <Field label={t("Natija havolasi")} optional htmlFor="tav2-link">
              <TextInput id="tav2-link" value={a.link} onChange={(e) => a.setLink(e.target.value)} placeholder="https://" maxLength={500} />
            </Field>
            <div className="min-w-0">
              <FieldLabel optional>{t("Natija fayli")}</FieldLabel>
              {a.file ? (
                <span className="inline-flex h-8 max-w-full items-center gap-1.5 rounded-v2-md border border-v2-border bg-v2-surface-2 pl-2 pr-1 text-v2-small font-medium text-v2-text">
                  <Paperclip className="size-3.5 shrink-0 text-v2-text-2" strokeWidth={1.75} aria-hidden />
                  <span className="truncate">{a.file.name}</span>
                  <button type="button" onClick={() => a.setFile(null)} aria-label={t("Olib tashlash")} className="inline-flex size-6 shrink-0 items-center justify-center rounded-v2-sm text-v2-text-3 hover:bg-v2-hover hover:text-v2-text">
                    <X className="size-3.5" strokeWidth={2} />
                  </button>
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  disabled={a.uploading}
                  className="flex h-10 w-full items-center gap-2 rounded-v2-md border border-dashed border-v2-border-strong px-3 text-left text-v2-small text-v2-text-2 transition-colors hover:bg-v2-surface-2 hover:text-v2-text disabled:cursor-wait"
                >
                  {a.uploading ? <Loader2 className="size-4 shrink-0 animate-spin" aria-hidden /> : <Paperclip className="size-4 shrink-0" strokeWidth={1.75} aria-hidden />}
                  {a.uploading ? t("Yuklanmoqda…") : t("Rasm yoki PDF, 10 MB gacha")}
                </button>
              )}
              <input
                ref={fileRef}
                type="file"
                accept="image/png,image/jpeg,image/webp,application/pdf"
                className="hidden"
                aria-label={t("Fayl tanlash")}
                onChange={(e) => {
                  void a.pick(e.target.files);
                  e.target.value = "";
                }}
              />
            </div>
          </>
        )}

        {kind === "return" && (
          <div className="min-w-0">
            <FieldLabel>{t("Yangi muddat")}</FieldLabel>
            <div className="grid grid-cols-[minmax(0,1fr)_112px] gap-2">
              <V2DateField
                value={dateObj}
                onChange={(d) => a.setDate(isoOfDate(d))}
                trigger={(p, open) => (
                  <button
                    type="button"
                    {...p}
                    className={fieldCls(tried && a.dlBad ? "error" : "default", `flex items-center gap-2 text-left ${open ? "border-v2-brand shadow-v2-focus" : ""}`)}
                  >
                    <Calendar className="size-4 shrink-0 text-v2-text-2" strokeWidth={1.75} aria-hidden />
                    <span className="min-w-0 flex-1 truncate font-medium">{dateObj ? vf.dayLong(dateObj) : t("Sanani tanlang")}</span>
                  </button>
                )}
              />
              <V2TimeField value={a.time} onChange={a.setTime} icon={false} ariaLabel={t("Soat")} state={tried && a.dlBad ? "error" : "default"} />
            </div>
            {tried && a.dlBad && <FieldError>{t("Vaqt hozirgidan keyin bo'lishi kerak")}</FieldError>}
          </div>
        )}
      </div>
    </V2Dialog>
  );
}
