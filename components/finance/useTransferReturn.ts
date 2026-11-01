"use client";

import { useState } from "react";
import { useT } from "@/components/shared/Language";
import { useToast } from "@/components/ui/Toast";
import type { TransactionEntry } from "@/lib/transactionEntries";
import { RETURN_COMMENT_MAX } from "@/lib/transferReturns";

// «KO'CHIRMANI BEKOR QILISH» oynasining mantig'i — eski (./TransferReturnDialog)
// va yangi (components/v2/finance/TransferReturnDialogV2) oynalar uchun BITTA.
// Server: POST /api/transaction-entries/:id/transfer-return (lib/transferDecision.ts
// → returnTransferAs). Sababi MAJBURIY — u jo'natuvchining «pul qaytdi»
// oynasida ko'rinadi.

export interface TransferReturnState {
  comment: string;
  setComment: (v: string) => void;
  busy: boolean;
  /** Saqlash bosilganmi — xato faqat shundan keyin ko'rsatiladi. */
  tried: boolean;
  /** Sababi bo'sh. */
  bad: boolean;
  /** Ko'chirma allaqachon QABUL QILINGAN — pul shu kassadan qaytariladi. */
  accepted: boolean;
  submit: () => Promise<void>;
}

export function useTransferReturn(
  entry: TransactionEntry,
  /** Muvaffaqiyat: yangilangan "in" qator (eski server javobida bo'lmasligi mumkin). */
  onDone: (updated: TransactionEntry | null, afterConfirm: boolean) => void,
): TransferReturnState {
  const { t } = useT();
  const { showSuccess, showError } = useToast();
  const [comment, setCommentRaw] = useState("");
  const [busy, setBusy] = useState(false);
  const [tried, setTried] = useState(false);
  const bad = !comment.trim();

  async function submit() {
    setTried(true);
    if (bad || busy) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/transaction-entries/${entry.id}/transfer-return`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ comment: comment.trim() }),
      });
      const data = await res.json().catch(() => null);
      if (!data?.ok) {
        showError(t(data?.error || "Amal bajarilmadi"));
        return;
      }
      showSuccess(
        data.afterConfirm
          ? t("Ko'chirma bekor qilindi — pul jo'natuvchi kassaga qaytarildi")
          : t("Ko'chirma bekor qilindi — pul jo'natuvchi kassada qoldi"),
      );
      onDone((data.entry as TransactionEntry | undefined) ?? null, !!data.afterConfirm);
    } catch {
      showError(t("Serverga ulanib bo'lmadi"));
    } finally {
      setBusy(false);
    }
  }

  return {
    comment,
    setComment: (v) => setCommentRaw(v.slice(0, RETURN_COMMENT_MAX)),
    busy,
    tried,
    bad,
    accepted: entry.status === "",
    submit,
  };
}

/** «500 000 so'm · Naqd» — oyna sarlavhasi ostidagi qator. */
export function transferAmountLine(entry: TransactionEntry, som: string): string {
  const n = Math.round(Math.abs(Number(entry.amount) || 0)).toLocaleString("ru-RU").replace(/[ ,]/g, " ");
  return [`${n} ${som}`, entry.paymentType].filter(Boolean).join(" · ");
}
