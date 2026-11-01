"use client";

import { Loader2, Undo2 } from "lucide-react";
import { useT } from "@/components/shared/Language";
import { useModalClose } from "@/components/ui/Modal";
import { transferAmountLine, useTransferReturn } from "@/components/finance/useTransferReturn";
import V2Dialog from "@/components/v2/form/V2Dialog";
import { Field } from "@/components/v2/form/fields";
import { secondaryBtn } from "@/components/v2/ui/buttons";
import type { TransactionEntry } from "@/lib/transactionEntries";
import { RETURN_COMMENT_MAX } from "@/lib/transferReturns";

// YANGI VERSIYA — «KO'CHIRMANI BEKOR QILISH» (01.11.2026; rasmi yo'q — forma
// qoidalari bo'yicha: V2Dialog, maydon fields.tsx). Tranzaksiyalar jadvalidagi
// × (kutilayotgan), ↩ (qabul qilingan) va ⋯ menyusi ochadi. Mantiq eski oyna
// bilan BITTA — components/finance/useTransferReturn.ts.

const textareaCls = (bad: boolean) =>
  `block min-h-[72px] w-full resize-y rounded-v2-md border bg-v2-surface! px-3 py-2 text-v2-body text-v2-text placeholder:text-v2-text-3 transition-[border-color,box-shadow] focus:outline-none ${
    bad
      ? "border-v2-danger focus:shadow-[0_0_0_3px_color-mix(in_srgb,var(--v2-danger)_18%,transparent)]"
      : "border-v2-border-field focus:border-v2-brand focus:shadow-v2-focus"
  }`;

export default function TransferReturnDialogV2({
  entry,
  onClose,
  onDone,
}: {
  /** Ko'chirmaning pul KELGAN qatori. */
  entry: TransactionEntry;
  onClose: () => void;
  onDone: (updated: TransactionEntry | null, afterConfirm: boolean) => void;
}) {
  const { t } = useT();
  const modal = useModalClose(onClose, "center");
  const r = useTransferReturn(entry, (u, after) => {
    onDone(u, after);
    modal.close();
  });

  return (
    <V2Dialog
      controller={modal}
      title={t("Ko'chirmani bekor qilish")}
      subtitle={[transferAmountLine(entry, t("so'm")), entry.txName].filter(Boolean).join(" · ")}
      width={520}
      onClose={onClose}
      dirty={!!r.comment.trim()}
      saving={r.busy}
      onSubmit={() => void r.submit()}
      footer={(api) => (
        <>
          <button type="button" onClick={api.requestClose} disabled={r.busy} className={`${secondaryBtn} justify-center`}>
            {t("Yopish")}
          </button>
          <button
            type="button"
            onClick={() => void r.submit()}
            disabled={r.busy}
            className="inline-flex h-9 shrink-0 items-center justify-center gap-2 rounded-v2-md bg-v2-danger px-4 text-v2-body font-semibold text-v2-on-danger transition-[filter] hover:brightness-95 focus-visible:shadow-v2-focus focus-visible:outline-none disabled:opacity-60"
          >
            {r.busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Undo2 className="size-4" strokeWidth={2} aria-hidden />}
            {t("Ko'chirmani bekor qilish")}
          </button>
        </>
      )}
    >
      <div className="space-y-4">
        <p className="rounded-v2-md bg-v2-warning-bg px-3 py-2 text-v2-small text-v2-text">
          {r.accepted
            ? t("Ko'chirma qabul qilingan — bekor qilinsa, pul shu kassadan jo'natuvchi kassaga qaytariladi.")
            : t("Ko'chirma hali qabul qilinmagan — bekor qilinsa, pul jo'natuvchi kassada qoladi.")}{" "}
          {t("Jo'natuvchiga «pul qaytdi» xabari chiqadi.")}
        </p>
        <Field label={t("Bekor qilish sababi")} htmlFor="trv2-comment" error={r.tried && r.bad ? t("Sababini yozing") : undefined}>
          <textarea
            id="trv2-comment"
            data-autofocus=""
            value={r.comment}
            rows={3}
            maxLength={RETURN_COMMENT_MAX}
            onChange={(e) => r.setComment(e.target.value)}
            placeholder={t("Masalan: summa noto'g'ri yoki boshqa kassaga yuborilishi kerak edi")}
            className={textareaCls(r.tried && r.bad)}
          />
        </Field>
      </div>
    </V2Dialog>
  );
}
