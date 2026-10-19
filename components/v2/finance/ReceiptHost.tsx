"use client";

import { useEffect, useState } from "react";
import { printReceipt, ReceiptPreviewModal } from "@/components/finance/cashReceipt";
import { useToast } from "@/components/ui/Toast";
import type { TransactionEntry } from "@/lib/transactionEntries";

// YANGI VERSIYA: CHEK OYNASI — istalgan sahifadan. Forma saqlangach toastdagi
// «Chekni ko'rish» (rasm «Saqlangandan keyin — burchakda xabar») shu yerga
// hodisa yuboradi: oyna allaqachon yopilgan bo'ladi, chek esa qobiqda
// (components/v2/shell/AppShellV2.tsx) ochiladi. Yozuv `?cashboxId=&id=` bilan
// so'raladi — kassa egaligi tekshiruvi odatdagidek (app/api/transaction-entries).

const EVENT = "v2:open-receipt";

export interface ReceiptRequest {
  entryId: number;
  cashboxId: number;
  cashboxName: string;
}

export function openReceipt(req: ReceiptRequest): void {
  window.dispatchEvent(new CustomEvent<ReceiptRequest>(EVENT, { detail: req }));
}

export default function ReceiptHost() {
  const { showError } = useToast();
  const [open, setOpen] = useState<{ entry: TransactionEntry; cashboxName: string } | null>(null);

  useEffect(() => {
    function onOpen(e: Event) {
      const req = (e as CustomEvent<ReceiptRequest>).detail;
      if (!req) return;
      fetch(`/api/transaction-entries?cashboxId=${req.cashboxId}&id=${req.entryId}&limit=1`)
        .then((r) => r.json())
        .then((d) => {
          const entry = d?.ok ? ((d.entries as TransactionEntry[]) ?? [])[0] : undefined;
          if (!entry) {
            showError("Chekni ochib bo'lmadi");
            return;
          }
          setOpen({ entry, cashboxName: req.cashboxName });
        })
        .catch(() => showError("Serverga ulanib bo'lmadi"));
    }
    window.addEventListener(EVENT, onOpen);
    return () => window.removeEventListener(EVENT, onOpen);
  }, [showError]);

  if (!open) return null;
  return (
    <ReceiptPreviewModal
      entry={open.entry}
      cashboxName={open.cashboxName}
      onClose={() => setOpen(null)}
      onPrint={() => {
        const { entry, cashboxName } = open;
        setOpen(null);
        // Modal yopilgach bosma oynasi ochilsin (CashboxesV2 bilan bir xil).
        setTimeout(() => printReceipt(entry, cashboxName), 0);
      }}
    />
  );
}
