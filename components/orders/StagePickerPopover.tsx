"use client";

import { ORDER_STAGES, type OrderStageKey } from "@/lib/ordersData";

// Reuses the same 4 stages/colors already used by OrdersKanban's columns
// (see .ok-stage-* in globals.css) as a quick-set popover triggered from the
// orders-list table's phone-number cell.

export const STAGE_COLORS: Record<OrderStageKey, string> = {
  bir_oylay: "#f59e0b",
  jaylang_e: "#3b82f6",
  rahmaaaat: "#22c55e",
  ketdim: "#ef4444",
};

export default function StagePickerPopover({
  value,
  onChange,
  onClose,
}: {
  /** Hali tanlanmagan bo'lishi mumkin — u holda hech biri ajratilmaydi. */
  value?: OrderStageKey;
  onChange: (stage: OrderStageKey) => void;
  onClose: () => void;
}) {
  return (
    <>
      {/* Bu popover boshqa elementlar CSS bilan fixed/absolute joylashtirilgan
          bo'lsa ham, DOM jihatidan hali ham jadval qatori (<tr>) ichida —
          shuning uchun bosishlar stopPropagation qilinmasa, orders-list
          qatorining o'ziga bosilgandek "buyurtma detail" sahifasiga
          o'tkazib yuboradi. */}
      <div className="fixed inset-0 z-10" onClick={(e) => { e.stopPropagation(); onClose(); }} />
      <div className="absolute left-0 top-full mt-1 z-20 w-48 rounded-xl border border-border bg-card shadow-lg overflow-hidden py-1.5">
        {ORDER_STAGES.map((st) => (
          <button
            key={st.key}
            type="button"
            onClick={(e) => { e.stopPropagation(); onChange(st.key); }}
            className={`w-full flex items-center gap-2.5 px-3 py-2 text-sm text-left hover:bg-secondary/50 ${
              value === st.key ? "bg-secondary/40 font-medium" : ""
            }`}
          >
            <span className="h-2.5 w-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: STAGE_COLORS[st.key] }} />
            <span>{st.emoji} {st.label}</span>
          </button>
        ))}
      </div>
    </>
  );
}
