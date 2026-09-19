"use client";

import type { LucideIcon } from "lucide-react";
import { useT } from "@/components/shared/Language";

// SEGMENT TUGMALAR — 2–4 variantli tanlov uchun select O'RNIGA.
//
// Nega: "Guruh holati" kabi maydonda variant uchta (Aktiv / Muzlatilgan /
// Arxiv) va deyarli har doim birinchisi tanlanadi. Select buni ikki
// bosishga aylantiradi (och, tanla) va hozirgi qiymatni yashiradi; bu
// yerda hamma variant ko'rinib turadi, tanlangani bitta bosish, standart
// qiymat esa oldindan belgilangan bo'ladi — moderator hech narsa bosmaydi.
//
// Klaviatura: radio-guruh kabi — ← → o'tadi, Home/End chetlariga.

export interface SegmentedOption {
  value: string;
  label: string;
  icon?: LucideIcon;
  /** Tugma ustidagi qisqa izoh (title). */
  hint?: string;
}

export default function Segmented({
  value,
  options,
  onChange,
  size = "md",
  disabled = false,
  className = "",
}: {
  value: string;
  options: SegmentedOption[];
  onChange: (value: string) => void;
  /** sm — filtrlar qatori (h-8 ichida); md — forma maydoni (h-10 ichida). */
  size?: "sm" | "md";
  disabled?: boolean;
  className?: string;
}) {
  const { t } = useT();
  const index = Math.max(0, options.findIndex((o) => o.value === value));

  function onKeyDown(e: React.KeyboardEvent) {
    if (disabled) return;
    let next = -1;
    if (e.key === "ArrowRight" || e.key === "ArrowDown") next = (index + 1) % options.length;
    else if (e.key === "ArrowLeft" || e.key === "ArrowUp") next = (index - 1 + options.length) % options.length;
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = options.length - 1;
    if (next < 0) return;
    e.preventDefault();
    onChange(options[next].value);
    (e.currentTarget.querySelectorAll<HTMLButtonElement>('[role="radio"]')[next])?.focus();
  }

  return (
    <div
      role="radiogroup"
      onKeyDown={onKeyDown}
      className={`grid gap-1 rounded-lg border border-border bg-secondary/60 p-1 ${disabled ? "opacity-60" : ""} ${className}`}
      style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}
    >
      {options.map((o) => {
        const active = o.value === value;
        const Icon = o.icon;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={active}
            tabIndex={active ? 0 : -1}
            disabled={disabled}
            title={t(o.hint)}
            onClick={() => onChange(o.value)}
            className={`inline-flex items-center justify-center gap-1.5 rounded-md font-medium transition-[background-color,color,box-shadow] duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 ${
              size === "sm" ? "h-7 px-2 text-[12px]" : "h-8 px-3 text-[13px]"
            } ${active ? "bg-card text-primary shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
          >
            {Icon && <Icon className="w-3.5 h-3.5 shrink-0" />}
            <span className="truncate">{t(o.label)}</span>
          </button>
        );
      })}
    </div>
  );
}
