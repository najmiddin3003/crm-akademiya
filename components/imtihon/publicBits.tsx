"use client";

import type { ReactNode } from "react";
import { examBand } from "@/components/v2/imtihon/examBits";

// OCHIQ NATIJALAR SAHIFALARI (/natijalar/<kalit> — guruh, /natijalar/markaz/<kalit> — markaz
// reytingi) uchun umumiy kichik bo'laklar (01.11.2026): bo'sh holat kartasi va foiz.

/** Foiz: past natija — ogohlantirish rangida (yangi versiyadagi `examBand`). */
export function Pct({ pct, className = "" }: { pct: number; className?: string }) {
  return <span className={`font-semibold tabular-nums ${examBand(pct) === "low" ? "text-v2-warning" : "text-v2-text"} ${className}`}>{pct}%</span>;
}

export function EmptyCard({ icon, title, text, children }: { icon: ReactNode; title: string; text?: string; children?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-v2-lg border border-v2-border bg-v2-surface px-6 py-10 text-center shadow-v2-sm">
      <span className="flex size-10 items-center justify-center rounded-v2-md bg-v2-surface-2 text-v2-text-3">{icon}</span>
      <div className="text-v2-section text-v2-text">{title}</div>
      {text && <p className="max-w-sm text-v2-small text-v2-text-2">{text}</p>}
      {children}
    </div>
  );
}
