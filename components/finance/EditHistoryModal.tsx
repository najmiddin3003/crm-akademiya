"use client";

import Modal, { useModalClose } from "@/components/ui/Modal";
import { useT } from "@/components/shared/Language";
import type { TransactionEntry } from "@/lib/transactionEntries";
import { toUz } from "@/lib/uzTime";

// TAHRIRLAR TARIXI — kassa yozuvi summasi o'zgartirilgan bo'lsa («Tahrirlangan»
// belgisi). Eski va yangi Kassalar sahifasi uchun bitta oyna; CashboxesPage.tsx
// dan AYNAN ko'chirildi (18.10.2026).

function fmtNum(n: number): string {
  return Math.round(n)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}

// Miqdor tahrirlanish tarixini ko'rsatuvchi modal — jadvaldagi "Tahrirlangan"
// belgisi bosilganda ochiladi.
export default function EditHistoryModal({
  entry,
  onClose,
}: {
  entry: TransactionEntry;
  onClose: () => void;
}) {
  const { t } = useT();
  const modal = useModalClose(onClose);
  const items = Array.isArray(entry.editHistory) ? entry.editHistory : [];
  function fmtAt(iso: string): string {
    const raw = new Date(iso);
    if (Number.isNaN(raw.getTime())) return iso;
    // Har doim O'zbekiston vaqti — brauzer boshqa zonada bo'lsa ham.
    const d = toUz(raw);
    const p = (n: number) => String(n).padStart(2, "0");
    return `${p(d.getDate())}.${p(d.getMonth() + 1)}.${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}`;
  }
  return (
    <Modal onClose={onClose} controller={modal} bare zIndex={140}>
        <div className="px-5 py-3 border-b border-border flex items-center justify-between">
          <div className="text-[15px] font-semibold">{t("Tahrirlar tarixi")}</div>
          <button
            onClick={modal.close}
            className="h-7 w-7 rounded-md hover:bg-secondary inline-flex items-center justify-center text-muted-foreground"
          >
            ×
          </button>
        </div>
        <div className="max-h-[60vh] overflow-y-auto px-5 py-4 space-y-3">
          {items.length === 0 && (
            <div className="text-[13px] text-muted-foreground text-center py-6">
              {t("Hozircha tahrir kiritilmagan.")}
            </div>
          )}
          {items.map((h, i) => (
            <div key={i} className="rounded-lg border border-border bg-secondary/30 px-3 py-2.5">
              <div className="flex items-center justify-between text-[12px] text-muted-foreground">
                <span>{fmtAt(h.at)}</span>
                <span className="tabular-nums">
                  {fmtNum(Math.abs(h.from))} → <span className="text-foreground font-medium">{fmtNum(Math.abs(h.to))}</span>{" "}{t("so'm")}
                </span>
              </div>
              <div className="text-[13px] mt-1 whitespace-pre-wrap break-words">{h.reason || "—"}</div>
            </div>
          ))}
        </div>
      </Modal>
  );
}
