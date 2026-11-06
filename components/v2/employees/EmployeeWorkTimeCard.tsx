"use client";

import { useState } from "react";
import { Pencil } from "lucide-react";
import { useModalClose } from "@/components/ui/Modal";
import { useT } from "@/components/shared/Language";
import V2Dialog from "@/components/v2/form/V2Dialog";
import V2TimeField, { finishTime } from "@/components/v2/form/V2TimeField";
import { Field, FieldError } from "@/components/v2/form/fields";
import { primaryBtn, secondaryBtn } from "@/components/v2/ui/buttons";
import { parseWorkTime, workTimeLabel } from "@/lib/workTime";

// XODIM PROFILI → «ISH VAQTI» (06.11.2026, lib/workTime.ts): kiritilgan vaqt ko'rinadi va
// shu yerdan o'zgaradi. Hozircha ko'p xodimda bo'sh — «Kiritilmagan» ko'rinadi; hammasini
// bir oynada kiritish /vaqtinchalik sahifasida.

export default function EmployeeWorkTimeCard({
  workStart,
  workEnd,
  canEdit,
  employeeName,
  onSave,
}: {
  workStart: string | null | undefined;
  workEnd: string | null | undefined;
  canEdit: boolean;
  employeeName: string;
  onSave: (next: { workStart: string | null; workEnd: string | null }) => Promise<void> | void;
}) {
  const { t } = useT();
  const [open, setOpen] = useState(false);
  const label = workTimeLabel({ workStart, workEnd });

  return (
    <section className="rounded-v2-lg border border-v2-border bg-v2-surface p-5 shadow-v2-sm" aria-label={t("Ish vaqti")}>
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-v2-section text-v2-text">{t("Ish vaqti")}</h2>
          {label ? (
            <p className="mt-1 text-v2-body font-medium tabular-nums text-v2-text">{label}</p>
          ) : (
            <p className="mt-1 text-v2-small text-v2-text-2">{t("Kiritilmagan")}</p>
          )}
        </div>
        {canEdit && (
          <button type="button" onClick={() => setOpen(true)} className={secondaryBtn}>
            <Pencil className="size-4" strokeWidth={1.75} aria-hidden />
            {label ? t("O'zgartirish") : t("Kiritish")}
          </button>
        )}
      </div>
      {open && (
        <WorkTimeDialog
          employeeName={employeeName}
          initialStart={workStart ?? ""}
          initialEnd={workEnd ?? ""}
          onClose={() => setOpen(false)}
          onSave={onSave}
        />
      )}
    </section>
  );
}

function WorkTimeDialog({
  employeeName,
  initialStart,
  initialEnd,
  onClose,
  onSave,
}: {
  employeeName: string;
  initialStart: string;
  initialEnd: string;
  onClose: () => void;
  onSave: (next: { workStart: string | null; workEnd: string | null }) => Promise<void> | void;
}) {
  const { t } = useT();
  const modal = useModalClose(onClose, "center");
  const [start, setStart] = useState(initialStart);
  const [end, setEnd] = useState(initialEnd);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (busy) return;
    // Enter maydon ichida bosilsa blur bo'lmaydi: «9» ham «09:00» bo'lsin.
    const parsed = parseWorkTime(start.trim() ? finishTime(start) : "", end.trim() ? finishTime(end) : "");
    if (!parsed.ok) {
      setErr(t(parsed.error));
      return;
    }
    setBusy(true);
    await onSave({ workStart: parsed.workStart, workEnd: parsed.workEnd });
    setBusy(false);
    modal.close();
  }

  return (
    <V2Dialog
      title={t("Ish vaqti")}
      subtitle={employeeName}
      onClose={onClose}
      controller={modal}
      dirty={start !== initialStart || end !== initialEnd}
      saving={busy}
      width={420}
      onSubmit={() => void submit()}
      footer={(api) => (
        <>
          <button type="button" onClick={api.requestClose} disabled={busy} className={`${secondaryBtn} h-10 justify-center`}>
            {t("Bekor qilish")}
          </button>
          <button type="button" onClick={() => void submit()} disabled={busy} className={`${primaryBtn} h-10 justify-center disabled:opacity-60`}>
            {busy ? t("Saqlanmoqda...") : t("Saqlash")}
          </button>
        </>
      )}
    >
      <div className="space-y-2">
        <div className="grid grid-cols-2 gap-3">
          <Field label={t("Ish boshlanishi")} htmlFor="emp-work-start">
            <V2TimeField id="emp-work-start" value={start} onChange={setStart} placeholder="09:00" state={err ? "error" : "default"} />
          </Field>
          <Field label={t("Ish tugashi")} htmlFor="emp-work-end">
            <V2TimeField id="emp-work-end" value={end} onChange={setEnd} placeholder="18:00" state={err ? "error" : "default"} />
          </Field>
        </div>
        {err && <FieldError>{err}</FieldError>}
        <p className="text-v2-caption font-normal text-v2-text-3">{t("Ikkalasini bo'sh qoldirsangiz, ish vaqti olib tashlanadi.")}</p>
      </div>
    </V2Dialog>
  );
}
