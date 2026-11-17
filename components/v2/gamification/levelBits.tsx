"use client";

import { useT } from "@/components/shared/Language";

// Daraja belgisi (33-qism: Reyting, Hamyonlar, O'quvchi hamyoni): «② Izlanuvchi» — raqam doirada,
// nom yonida. 1-daraja — neytral, yuqorilari — rangli (rasmdagidek «Izlanuvchi» yashil).

const LEVEL_TONE: Record<number, string> = {
  1: "bg-v2-surface-2 text-v2-text-2",
  2: "bg-v2-success-bg text-v2-success",
  3: "bg-v2-info-bg text-v2-info",
  4: "bg-v2-violet-bg text-v2-violet",
  5: "bg-v2-warning-bg text-v2-warning",
};

export function LevelBadge({ position, name }: { position: number; name: string }) {
  const { t } = useT();
  const tone = LEVEL_TONE[position] ?? LEVEL_TONE[1];
  return (
    <span className={`inline-flex h-6 max-w-full items-center gap-1.5 whitespace-nowrap rounded-full pl-1 pr-2.5 text-v2-small font-semibold ${tone}`}>
      <span className="grid size-[18px] shrink-0 place-items-center rounded-full bg-v2-surface text-[11px] font-semibold text-v2-text-2">{position}</span>
      <span className="truncate">{t(name)}</span>
    </span>
  );
}

/** Tanga belgisi — sariq nuqta (rasmlardagi «● 412»). */
export function CoinDot({ n, strong = false, className = "" }: { n: number | string; strong?: boolean; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-1.5 tabular-nums ${className}`}>
      <span className="size-2.5 shrink-0 rounded-full bg-v2-warning" aria-hidden />
      <span className={strong ? "font-semibold text-v2-text" : ""}>{n}</span>
    </span>
  );
}
