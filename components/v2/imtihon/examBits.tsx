"use client";

import type { ReactNode } from "react";
import { ChevronRight } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useT } from "@/components/shared/Language";

// YANGI VERSIYA — IMTIHON BO'LAKLARI (rasm «Sarhisob · Natija kiritish», 23.10.2026):
// sarlavha (yo'l «Sarhisob › Natija kiritish», «Imtihon», o'ngda amallar) va ostida
// «Sarhisob | UzBMB» tablari (faol — qalin yozuv + brend chiziq); o'zlashtirish
// chizig'i va uch daraja.

/**
 * O'zlashtirish darajasi — rasmdagi «Guruh ichida» kataklari: ≥ 80%, 60–79%, < 60%.
 * < 60% — sariq chiziq va «past» yozuvi (rasmda 56% shunday), qolgani brend.
 * Eski sahifadagi to'rt rangli shkala (lib/imtihon.ts → imTier: <50/50–69/70–84/≥85)
 * yangi versiyada ishlatilmaydi — SAVOLLAR 140.
 */
export type ExamBand = "hi" | "mid" | "low";
export function examBand(pct: number): ExamBand {
  if (pct >= 80) return "hi";
  if (pct >= 60) return "mid";
  return "low";
}

/** Natija chizig'i: brend (yoki past natijada sariq) to'ldirish, o'z rangining och izi. */
export function ScoreBar({ pct, className = "w-[132px]" }: { pct: number; className?: string }) {
  const low = examBand(pct) === "low";
  return (
    <span className={`block h-1.5 shrink-0 overflow-hidden rounded-v2-full ${low ? "bg-v2-warning-bg" : "bg-v2-brand-bg"} ${className}`} aria-hidden>
      <span className={`block h-full rounded-v2-full ${low ? "bg-v2-warning" : "bg-v2-brand"}`} style={{ width: `${Math.min(100, Math.max(0, pct))}%` }} />
    </span>
  );
}

/** «Taqqoslash» qatori: nom + foiz, ostida chiziq (bu guruh — ko'k, markaz — kulrang). */
export function CompareRow({ label, value, strong = false }: { label: ReactNode; value: number | null; strong?: boolean }) {
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3 text-v2-small">
        <span className={`min-w-0 truncate ${strong ? "font-semibold text-v2-text" : "text-v2-text-2"}`}>{label}</span>
        <span className="shrink-0 font-semibold tabular-nums text-v2-text">{value === null ? "—" : `${value}%`}</span>
      </div>
      <span className="mt-1.5 block h-2 overflow-hidden rounded-v2-full bg-v2-hover" aria-hidden>
        {value !== null && <span className={`block h-full rounded-v2-full ${strong ? "bg-v2-series-1" : "bg-v2-track"}`} style={{ width: `${Math.min(100, Math.max(0, value))}%` }} />}
      </span>
    </div>
  );
}

export type ImtihonTab = "sarhisob" | "uzbmb";

/**
 * Sahifa sarlavhasi + tablar. Tab almashganda manzildagi boshqa parametrlar
 * (masalan `kiritish=1`) saqlanadi — kiritilayotgan natijalar UzBMB ga o'tib
 * qaytganda yo'qolmasin.
 */
export function ImtihonHeader({
  tab,
  crumbs,
  actions,
}: {
  tab: ImtihonTab;
  /** Yo'l: oxirgisi joriy sahifa; `onClick` berilgani — havola. */
  crumbs?: { label: string; onClick?: () => void }[];
  actions?: ReactNode;
}) {
  const { t } = useT();
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();

  function go(next: ImtihonTab) {
    if (next === tab) return;
    const q = new URLSearchParams(sp.toString());
    if (next === "uzbmb") q.set("tab", "uzbmb");
    else q.delete("tab");
    const s = q.toString();
    router.replace(s ? `${pathname}?${s}` : pathname, { scroll: false });
  }

  return (
    <div className="shrink-0">
      {crumbs && crumbs.length > 0 && (
        <nav aria-label={t("Sahifa yo'li")} className="mb-1 flex min-w-0 items-center gap-1 text-v2-small text-v2-text-2">
          {crumbs.map((c, i) => (
            <span key={c.label} className="flex min-w-0 items-center gap-1">
              {i > 0 && <ChevronRight className="size-3.5 shrink-0 text-v2-text-3" strokeWidth={1.75} aria-hidden />}
              {c.onClick ? (
                <button type="button" onClick={c.onClick} className="truncate underline-offset-2 hover:text-v2-text hover:underline">
                  {c.label}
                </button>
              ) : (
                <span className="truncate" aria-current={i === crumbs.length - 1 ? "page" : undefined}>
                  {c.label}
                </span>
              )}
            </span>
          ))}
        </nav>
      )}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <h1 className="text-v2-page text-v2-text">{t("Imtihon")}</h1>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
      <div role="tablist" aria-label={t("Imtihon")} className="mt-3 flex gap-1 border-b border-v2-border">
        {(
          [
            ["sarhisob", t("Sarhisob")],
            ["uzbmb", "UzBMB"],
          ] as const
        ).map(([key, label]) => {
          const on = tab === key;
          return (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={on}
              onClick={() => go(key)}
              className={`relative -mb-px h-10 px-4 text-v2-body transition-colors focus-visible:shadow-v2-focus focus-visible:outline-none ${
                on ? "font-semibold text-v2-text" : "text-v2-text-2 hover:text-v2-text"
              }`}
            >
              {label}
              {on && <span className="absolute inset-x-0 bottom-0 h-0.5 rounded-t-full bg-v2-brand" aria-hidden />}
            </button>
          );
        })}
      </div>
    </div>
  );
}
