"use client";

import { useState } from "react";
import { useT } from "@/components/shared/Language";
import { switchUiVersion, type UiVersion } from "@/lib/uiVersion";

// «Eski versiya | Yangi versiya» almashtirgichi (lib/uiVersion.ts izohi).
// Eski versiyada — yuqori panelda (navbar), yangisida — yon menyuning pastida
// (yuqori panel dizayndagidek to'la, qidiruvga joy qolsin). Ko'rinishi bir
// xil, faqat ranglari o'z qobig'ining uslubida. Faqat almashtirgich yoqilgan
// serverda chiziladi (lib/uiVersionServer.ts → uiSwitchEnabled).

const OPTIONS: { value: UiVersion; short: string; long: string }[] = [
  { value: "v1", short: "Eski", long: "Eski versiya" },
  { value: "v2", short: "Yangi", long: "Yangi versiya" },
];

const TONES = {
  // Eski navbar: tugmalar 32 px, eski tokenlar (app/globals.css).
  v1: {
    box: "h-8 rounded-lg border border-border bg-card p-0.5 text-[12px] font-medium",
    item: "rounded-md px-2.5",
    on: "bg-primary text-white",
    off: "text-muted-foreground hover:text-foreground",
  },
  // Yangi qobiq: «Segment» komponenti (design/v2/DESIGN.md → Tablar va almashtirgichlar).
  v2: {
    box: "h-8 rounded-v2-md border border-v2-border bg-v2-surface-2 p-0.5 text-v2-caption",
    item: "rounded-[6px] px-2.5",
    on: "bg-v2-surface text-v2-text shadow-v2-sm font-semibold",
    off: "text-v2-text-2 hover:text-v2-text",
  },
} as const;

export default function UiVersionSwitch({ current, tone, fill = false }: {
  current: UiVersion;
  /** Qaysi qobiq ichida chiziladi — ranglar shunga qarab. */
  tone: UiVersion;
  /**
   * Butun kenglikni egallaydi va doim to'liq yozuv bilan (yon menyuda).
   * Aks holda — ixcham: tor ekranda «Eski | Yangi», kengda «… versiya».
   */
  fill?: boolean;
}) {
  const { t } = useT();
  const [busy, setBusy] = useState(false);
  const s = TONES[tone];

  const choose = (next: UiVersion) => {
    if (next === current || busy) return;
    setBusy(true);
    switchUiVersion(next);
  };

  return (
    <div
      role="radiogroup"
      aria-label={t("Interfeys versiyasi")}
      title={t("Yangi versiya hozircha sinovda")}
      className={`${fill ? "flex w-full" : "inline-flex"} shrink-0 items-stretch ${s.box} ${busy ? "pointer-events-none opacity-60" : ""}`}
    >
      {OPTIONS.map((o) => {
        const on = o.value === current;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => choose(o.value)}
            className={`inline-flex items-center whitespace-nowrap transition-colors ${fill ? "flex-1 justify-center" : ""} ${s.item} ${on ? s.on : s.off}`}
          >
            {fill ? (
              t(o.long)
            ) : (
              <>
                <span className="xl:hidden">{t(o.short)}</span>
                <span className="hidden xl:inline">{t(o.long)}</span>
              </>
            )}
          </button>
        );
      })}
    </div>
  );
}
