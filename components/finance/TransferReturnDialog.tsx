"use client";

import { Undo2 } from "lucide-react";
import Modal, { useModalClose } from "@/components/ui/Modal";
import { useT } from "@/components/shared/Language";
import type { TransactionEntry } from "@/lib/transactionEntries";
import { RETURN_COMMENT_MAX } from "@/lib/transferReturns";
import { transferAmountLine, useTransferReturn } from "./useTransferReturn";

// ESKI VERSIYA — «KO'CHIRMANI BEKOR QILISH» (01.11.2026). Kassalar jadvalidagi
// × (kutilayotgan ko'chirma) va «Bekor qilish» (qabul qilingani) tugmalari,
// hamda tranzaksiya tafsilot oynasi shu oynani ochadi. Mantiq —
// ./useTransferReturn.ts (yangi versiya oynasi bilan bitta).

export default function TransferReturnDialog({
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
  const modal = useModalClose(onClose);
  const r = useTransferReturn(entry, (u, after) => {
    onDone(u, after);
    modal.close();
  });

  return (
    <Modal onClose={onClose} controller={modal} locked={r.busy} bare size="md" zIndex={130}>
      <div className="flex items-start gap-3 px-5 pt-5">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-rose-100 text-rose-600" aria-hidden>
          <Undo2 className="h-5 w-5" />
        </span>
        <div className="min-w-0">
          <h3 className="text-[16px] font-semibold">{t("Ko'chirmani bekor qilish")}</h3>
          <p className="mt-0.5 text-[13px] font-medium tabular-nums">{transferAmountLine(entry, t("so'm"))}</p>
          {entry.txName && <p className="mt-0.5 truncate text-[12.5px] text-muted-foreground">{entry.txName}</p>}
        </div>
      </div>

      <div className="space-y-3 px-5 py-4">
        <p className="rounded-lg bg-amber-500/10 px-3 py-2 text-[13px] text-amber-800 dark:text-amber-300">
          {r.accepted
            ? t("Ko'chirma qabul qilingan — bekor qilinsa, pul shu kassadan jo'natuvchi kassaga qaytariladi.")
            : t("Ko'chirma hali qabul qilinmagan — bekor qilinsa, pul jo'natuvchi kassada qoladi.")}{" "}
          {t("Jo'natuvchiga «pul qaytdi» xabari chiqadi.")}
        </p>
        <div>
          <label htmlFor="transfer-return-comment" className="mb-1 block text-[13px] font-medium">
            {t("Bekor qilish sababi")} <span className="text-rose-500">*</span>
          </label>
          <textarea
            id="transfer-return-comment"
            autoFocus
            value={r.comment}
            onChange={(e) => r.setComment(e.target.value)}
            rows={3}
            maxLength={RETURN_COMMENT_MAX}
            disabled={r.busy}
            placeholder={t("Masalan: summa noto'g'ri yoki boshqa kassaga yuborilishi kerak edi")}
            className={`w-full resize-y rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 disabled:opacity-60 ${
              r.tried && r.bad ? "border-rose-400 focus:ring-rose-300" : "border-border focus:ring-blue-500"
            }`}
          />
          {r.tried && r.bad && <p className="mt-1 text-[12px] text-rose-600">{t("Sababini yozing")}</p>}
        </div>
      </div>

      <div className="flex justify-end gap-2 border-t border-border px-5 py-3">
        <button
          type="button"
          onClick={modal.close}
          disabled={r.busy}
          className="h-9 rounded-lg border border-border bg-card px-4 text-sm font-medium hover:bg-secondary disabled:opacity-60"
        >
          {t("Yopish")}
        </button>
        <button
          type="button"
          onClick={() => void r.submit()}
          disabled={r.busy}
          className="h-9 rounded-lg bg-rose-600 px-4 text-sm font-medium text-white hover:opacity-90 disabled:opacity-60"
        >
          {r.busy ? t("Bekor qilinmoqda…") : t("Ko'chirmani bekor qilish")}
        </button>
      </div>
    </Modal>
  );
}
