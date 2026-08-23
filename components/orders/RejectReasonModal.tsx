"use client";

import { useState } from "react";
import Button from "@/components/ui/Button";
import { useEscapeClose } from "@/hooks/useEscapeClose";

// "✗ Rad etish" tugmasi bosilganda ochiladigan modal (OrderDetailPage.tsx) —
// akademiya.edutizim.uz referensiga mos: "Izoh qoldiring" sarlavha, "Sabab"
// yorlig'i + qidiruv maydoni + har doim ko'rinib turadigan sabablar ro'yxati
// (GroupPickerModal bilan bir xil andoza). Sabablar hozircha qattiq yozilgan
// (backend yo'q) — "Boshqa" tanlansa erkin matn maydoni ochiladi.

/** Erkin matn yozish uchun ochiladigan variant. */
const OTHER = "Boshqa";

const REJECT_REASONS = [
  "Uyidagilar ruxsat bermabdi",
  "Boshqa o'quv markaziga boradigan bo'libdi",
  "Telefoni noto'g'ri ekan",
  OTHER,
];

export interface RejectReasonModalProps {
  onClose: () => void;
  onConfirm: (reason: string) => void;
}

export default function RejectReasonModal({ onClose, onConfirm }: RejectReasonModalProps) {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const [customReason, setCustomReason] = useState("");
  useEscapeClose(onClose);

  const filtered = REJECT_REASONS.filter((r) => r.toLowerCase().includes(query.trim().toLowerCase()));

  const handlePick = (reason: string) => {
    if (reason === OTHER) {
      setSelected(OTHER);
      return;
    }
    onConfirm(reason);
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div
        className="w-full max-w-md rounded-2xl border border-border bg-card shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-5 pb-4 text-center border-b border-border">
          <h3 className="text-xl font-semibold">Izoh qoldiring</h3>
        </div>

        <div className="p-5 space-y-2">
          <label className="block text-sm font-medium">Sabab</label>
          <div className="relative">
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Sababni qidirish"
              className="w-full h-11 rounded-lg border border-border bg-secondary/20 px-3 pr-9 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
            />
            <svg className="icon icon-sm pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
              <use href="#i-chevron-down" />
            </svg>
          </div>

          <div className="max-h-72 overflow-y-auto divide-y divide-border">
            {filtered.length === 0 ? (
              <div className="px-2 py-4 text-sm text-muted-foreground text-center">Topilmadi</div>
            ) : (
              filtered.map((reason) => (
                <button
                  key={reason}
                  type="button"
                  onClick={() => handlePick(reason)}
                  className={`w-full text-left px-2 py-3 text-sm hover:bg-secondary/50 ${selected === reason ? "text-primary font-medium" : ""}`}
                >
                  {reason}
                </button>
              ))
            )}
          </div>

          {selected === OTHER && (
            <div className="pt-2 space-y-2">
              <textarea
                autoFocus
                value={customReason}
                onChange={(e) => setCustomReason(e.target.value)}
                placeholder="Sababni yozing"
                rows={3}
                className="w-full rounded-lg border border-border bg-secondary/20 p-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
              />
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={onClose}>
                  Orqaga
                </Button>
                <Button variant="primary" onClick={() => onConfirm(customReason.trim() || OTHER)}>
                  Saqlash
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
