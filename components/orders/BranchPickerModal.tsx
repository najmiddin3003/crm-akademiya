"use client";

import { useState } from "react";
import { SpinnerBlock } from "@/components/ui/Spinner";
import { useEscapeClose } from "@/hooks/useEscapeClose";
import { useBranches } from "@/hooks/useBranches";

// "Transfer" tugmasi bosilganda ochiladigan modal (OrderDetailPage.tsx) —
// akademiya.edutizim.uz referensiga mos: "Filialni tanlang" sarlavha,
// "Tanlang" placeholder qidiruv maydoni + filiallar ro'yxati (GroupPickerModal/
// RejectReasonModal bilan bir xil andoza). Filiallar HAQIQIY — /api/branches
// (Boshqaruv → Filiallar sahifasi bilan bir xil manba), shuning uchun u yerda
// qo'shilgan filial shu yerda ham darhol tanlanadigan bo'ladi.

export interface BranchPickerModalProps {
  onClose: () => void;
  onSelect: (branch: string) => void;
}

export default function BranchPickerModal({ onClose, onSelect }: BranchPickerModalProps) {
  const [query, setQuery] = useState("");
  const { branches, loading } = useBranches();
  useEscapeClose(onClose);

  const filtered = branches.filter((b) => b.name.toLowerCase().includes(query.trim().toLowerCase()));

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div
        className="w-full max-w-md rounded-2xl border border-border bg-card shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-5 pb-4 text-center border-b border-border">
          <h3 className="text-xl font-semibold">Filialni tanlang</h3>
        </div>

        <div className="p-5 space-y-2">
          <div className="relative">
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Tanlang"
              className="w-full h-11 rounded-lg border border-border bg-secondary/20 px-3 pr-9 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
            />
            <svg className="icon icon-sm pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
              <use href="#i-chevron-down" />
            </svg>
          </div>

          <div className="max-h-72 overflow-y-auto divide-y divide-border">
            {filtered.length === 0 ? (
              <div className="px-2 py-4 text-sm text-muted-foreground text-center">
                {loading ? <SpinnerBlock size={22} /> : "Topilmadi"}
              </div>
            ) : (
              filtered.map((branch) => (
                <button
                  key={branch.id}
                  type="button"
                  onClick={() => onSelect(branch.name)}
                  className="w-full text-left px-2 py-3 text-sm font-medium text-primary hover:bg-secondary/50"
                >
                  {branch.name}
                </button>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
