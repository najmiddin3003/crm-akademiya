"use client";

import { type KeyboardEvent } from "react";
import { useT } from "@/components/shared/Language";
import { FAN_DOT, fanOf } from "@/components/v2/ui/fan";
import { roomLabel, timeLabel } from "@/components/v2/ui/groupStatus";
import type { Group } from "@/lib/groups";
import { groupStudentCount } from "@/lib/groupsList";
import type { LeadHolat } from "@/lib/leadHolat";
import { HOLAT_V2 } from "./leadUtils";

// YANGI LIDLAR — oyna va panellarda takrorlanadigan bo'laklar (rasmlar «Lid
// paneli», «Guruhga qo'shish oynasi», 20.10.2026).

/** Holat belgisi: och fon + rangli nuqta + yozuv («• Birinchi dars»). */
export function HolatBadge({ holat }: { holat: LeadHolat }) {
  const { t } = useT();
  const tone = HOLAT_V2[holat];
  return (
    <span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-v2-full px-2 py-0.5 text-v2-caption ${tone.badge}`}>
      <span className={`size-1.5 rounded-full ${tone.dot}`} aria-hidden />
      {t(tone.label)}
    </span>
  );
}

/** «Kurs · liddan | Filial · liddan» — oyna tepasidagi ikki katakli blok. */
export function LeadFromBox({ course, branch }: { course: string; branch: string }) {
  const { t } = useT();
  const cell = (label: string, value: string) => (
    <div className="min-w-0 px-3.5 py-2.5">
      <div className="text-v2-caption text-v2-text-3">{label}</div>
      <div className="mt-0.5 truncate text-v2-body font-semibold text-v2-text">{value || "—"}</div>
    </div>
  );
  return (
    <div className="grid grid-cols-2 divide-x divide-v2-border rounded-v2-lg border border-v2-border bg-v2-surface-2">
      {cell(t("Kurs · liddan"), course ? t(course) : "")}
      {cell(t("Filial · liddan"), branch)}
    </div>
  );
}

/** Guruh qatorining ikkinchi qatori: «Madina Qosimjonova · Toq kunlar 14:00–16:00 · 205-xona». */
export function groupMeta(g: Group): string {
  return [g.teacher, [g.day, timeLabel(g.time)].filter(Boolean).join(" "), roomLabel(g.room)].filter(Boolean).join(" · ");
}

/**
 * Guruh tanlovi — radio kartalar (rasm «Guruhga qo'shish oynasi»): tanlangani
 * brend chegara + `brand-bg`; sarlavha — fan nuqtasi + kurs (qalin) + «Birinchi dars
 * shu guruhda» belgisi, o'ngda «6 o'quvchi»; ostida o'qituvchi · kunlar vaqt · xona.
 * Klaviatura: ↑ ↓ (radiogroup), qayta bosish tanlovni olib tashlaydi (`allowNone`).
 */
export function GroupRadioList({
  groups,
  value,
  onChange,
  trialId = null,
  allowNone = false,
  label,
  autoFocus = false,
}: {
  groups: Group[];
  value: number | null;
  onChange: (id: number | null) => void;
  trialId?: number | null;
  allowNone?: boolean;
  label: string;
  /** Oyna ochilganda fokus shu ro'yxatda (tanlangan yoki birinchi karta) — V2Dialog `data-autofocus`. */
  autoFocus?: boolean;
}) {
  const { t } = useT();
  const move = (e: KeyboardEvent, i: number) => {
    if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
    e.preventDefault();
    const next = groups[(i + (e.key === "ArrowDown" ? 1 : groups.length - 1)) % groups.length];
    if (!next) return;
    onChange(next.id);
    e.currentTarget.parentElement?.querySelectorAll<HTMLElement>("[role=radio]")[groups.indexOf(next)]?.focus();
  };
  return (
    <div role="radiogroup" aria-label={label} className="space-y-2">
      {groups.map((g, i) => {
        const on = g.id === value;
        const trial = trialId === g.id;
        const tabStop = on || (value === null && i === 0);
        return (
          <button
            key={g.id}
            type="button"
            role="radio"
            aria-checked={on}
            tabIndex={tabStop ? 0 : -1}
            data-autofocus={autoFocus && tabStop ? "" : undefined}
            title={g.name ? `${g.course || ""} · ${g.name}` : undefined}
            onClick={() => onChange(on && allowNone ? null : g.id)}
            onKeyDown={(e) => move(e, i)}
            className={`flex w-full items-start gap-3 rounded-v2-lg border px-3.5 py-3 text-left text-v2-body transition-colors focus-visible:shadow-v2-focus focus-visible:outline-none ${
              on ? "border-v2-brand bg-v2-brand-bg" : "border-v2-border bg-v2-surface hover:bg-v2-hover"
            }`}
          >
            <span
              className={`mt-0.5 flex size-[18px] shrink-0 items-center justify-center rounded-full border-2 bg-v2-surface ${on ? "border-v2-brand" : "border-v2-border-strong"}`}
              aria-hidden
            >
              {on && <span className="size-2 rounded-full bg-v2-brand" />}
            </span>
            <span className="min-w-0 flex-1">
              <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <span className={`size-2 shrink-0 rounded-full ${FAN_DOT[fanOf(g.course)]}`} aria-hidden />
                <span className="font-semibold text-v2-text">{g.course || g.name || `#${g.id}`}</span>
                {trial && <span className="rounded-v2-sm bg-v2-warning-bg px-1.5 py-px text-v2-caption text-v2-warning">{t("Birinchi dars shu guruhda")}</span>}
                <span className="ml-auto shrink-0 text-v2-caption text-v2-text-2">{t("{n} o'quvchi", { n: groupStudentCount(g) })}</span>
              </span>
              {groupMeta(g) && <span className="mt-1 block text-v2-small text-v2-text-2">{groupMeta(g)}</span>}
            </span>
          </button>
        );
      })}
    </div>
  );
}
