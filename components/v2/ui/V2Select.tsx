"use client";

import { useId, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { Check, ChevronDown, Search, X } from "lucide-react";
import { useT } from "@/components/shared/Language";
import FloatingPanel from "./FloatingPanel";

// YANGI VERSIYA: TANLOV RO'YXATI (design/v2/DESIGN.md → «Kiritish maydonlari»,
// «Sahifa qolipi — ro'yxat»). Native <select> ishlatilmaydi (UI qoidasi —
// eski components/ui/Select.tsx izohi). Ikki ko'rinish:
//
//   field — maydon: «Hammasi ⌄», chegara `border-field`, fokusda brend halqa
//           («Yana filtrlar» oynasidagi tanlovlar);
//   chip  — filtr qatoridagi tugma: bo'sh bo'lsa «Kurs ⌄», tanlansa
//           «Kurs: Ingliz tili ×» — `brand-bg` + `brand` chegara, × darhol
//           tozalaydi (alohida tugma — tugma ichida tugma bo'lmaydi);
//   value — doim qiymati bilan: «Filial: Barchasi ⌄», «Solishtirish: o'tgan oy ⌄»
//           (rasm «Moliya analitikasi», 20.10.2026) — betaraf tugma, × yo'q;
//           bo'sh qiymatda `emptyLabel`.
//
// Klaviatura: ↑↓ yurish, Enter tanlash, Esc yopish, Home/End; harf bosilsa
// qidiruvga tushadi. Qidiruv variant SEARCH_AT dan ko'p bo'lsa chiqadi.
// Variant yorliqlari t() orqali (holatlar EN/kiril rejimida tarjima bo'lsin).

export interface V2SelectOption {
  value: string;
  label: string;
  /** O'ng chekkadagi kulrang izoh (masalan soni). */
  hint?: string;
}

export interface V2SelectProps {
  value: string;
  options: V2SelectOption[];
  onChange: (value: string) => void;
  variant?: "field" | "chip" | "value";
  /** chip — tugmadagi nom («Kurs»); field — ekran o'quvchisi uchun nom. */
  label: string;
  /** field — bo'sh holat matni (sukut «Hammasi»). */
  placeholder?: string;
  searchable?: boolean | "auto";
  /** Ro'yxat boshida «Tozalash» qatori (chip'da × doim bor). */
  clearable?: boolean;
  /** value — bo'sh qiymat yozuvi («Barchasi»). */
  emptyLabel?: string;
  id?: string;
  className?: string;
}

const SEARCH_AT = 8;
/** Bir vaqtda chiziladigan qator — qolgani qidiruv orqali (6 000 talik ro'yxat qotmasin). */
const LIMIT = 80;

export default function V2Select({
  value,
  options,
  onChange,
  variant = "field",
  label,
  placeholder = "Hammasi",
  searchable = "auto",
  clearable = true,
  emptyLabel = "Barchasi",
  id,
  className = "",
}: V2SelectProps) {
  const { t } = useT();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(-1);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const listId = useId();

  const selected = options.find((o) => o.value === value) ?? null;
  const hasSearch = searchable === true || (searchable === "auto" && options.length > SEARCH_AT);

  const q = query.trim().toLowerCase();
  const filtered = useMemo(() => {
    if (!open) return [];
    if (!q) return options;
    return options.filter((o) => `${o.label} ${t(o.label)} ${o.hint ?? ""}`.toLowerCase().includes(q));
  }, [open, options, q, t]);
  const shown = filtered.length > LIMIT ? filtered.slice(0, LIMIT) : filtered;
  const hidden = filtered.length - shown.length;

  function openList(initial = "") {
    setQuery(initial);
    setActive(initial ? 0 : Math.max(0, options.findIndex((o) => o.value === value)));
    setOpen(true);
  }
  function close(refocus = true) {
    setOpen(false);
    setQuery("");
    if (refocus) triggerRef.current?.focus();
  }
  function pick(i: number) {
    const o = shown[i];
    if (!o) return;
    onChange(o.value);
    close();
  }
  function scrollActive(i: number) {
    listRef.current?.querySelector<HTMLElement>(`[data-index="${i}"]`)?.scrollIntoView({ block: "nearest" });
  }
  function move(next: number) {
    if (shown.length === 0) return;
    const i = (next + shown.length) % shown.length;
    setActive(i);
    scrollActive(i);
  }

  function onKeyDown(e: KeyboardEvent) {
    if (!open) {
      if (e.key === "ArrowDown" || e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        openList();
      } else if (hasSearch && e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
        openList(e.key);
      } else if ((e.key === "Backspace" || e.key === "Delete") && value) {
        e.preventDefault();
        onChange("");
      }
      return;
    }
    if (e.key === "ArrowDown") { e.preventDefault(); move(active + 1); }
    else if (e.key === "ArrowUp") { e.preventDefault(); move(active - 1); }
    else if (e.key === "Home") { e.preventDefault(); move(0); }
    else if (e.key === "End") { e.preventDefault(); move(shown.length - 1); }
    else if (e.key === "Enter") { e.preventDefault(); pick(active); }
    else if (e.key === "Tab") close(false);
  }

  const chipOn = variant === "chip" && selected !== null;
  const triggerCls =
    variant === "value"
      ? `inline-flex h-9 max-w-[300px] items-center gap-1.5 rounded-v2-md border bg-v2-surface px-3 text-v2-body text-v2-text transition-[background-color,border-color,box-shadow] hover:bg-v2-surface-2 ${
          open ? "border-v2-brand shadow-v2-focus" : "border-v2-border-strong"
        }`
      : variant === "chip"
      ? `inline-flex h-9 max-w-[260px] items-center gap-1.5 rounded-v2-md border px-3 text-v2-body font-medium transition-colors ${
          chipOn
            ? `border-v2-brand bg-v2-brand-bg text-v2-brand-text ${value ? "pr-8" : ""}`
            : `border-v2-border-strong bg-v2-surface text-v2-text hover:bg-v2-surface-2 ${open ? "border-v2-brand" : ""}`
        }`
      : `flex h-9 w-full items-center gap-2 rounded-v2-md border bg-v2-surface pl-3 pr-8 text-left text-v2-body transition-[border-color,box-shadow] ${
          open ? "border-v2-brand shadow-v2-focus" : "border-v2-border-field hover:border-v2-text-3"
        }`;

  return (
    <div className={`relative ${variant === "field" ? "w-full" : "inline-flex"} ${className}`}>
      <button
        ref={triggerRef}
        id={id}
        type="button"
        onClick={() => (open ? close() : openList())}
        onKeyDown={onKeyDown}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-label={
          variant === "field"
            ? `${label}: ${selected ? t(selected.label) : t(placeholder)}`
            : variant === "value"
              ? `${t(label)}: ${selected ? t(selected.label) : t(emptyLabel)}`
              : undefined
        }
        className={`${triggerCls} focus-visible:outline-none focus-visible:shadow-v2-focus`}
      >
        {variant === "value" ? (
          <>
            <span className="shrink-0 text-v2-text-2">{t(label)}:</span>
            <span className="truncate font-semibold">{selected ? t(selected.label) : t(emptyLabel)}</span>
            <ChevronDown className={`size-4 shrink-0 text-v2-text-3 transition-transform ${open ? "rotate-180" : ""}`} strokeWidth={1.75} aria-hidden />
          </>
        ) : variant === "chip" ? (
          <>
            <span className="truncate">
              {t(label)}
              {selected && <>: <span className="font-semibold">{t(selected.label)}</span></>}
            </span>
            {!chipOn && <ChevronDown className={`size-4 shrink-0 text-v2-text-3 transition-transform ${open ? "rotate-180" : ""}`} strokeWidth={1.75} aria-hidden />}
          </>
        ) : (
          <>
            <span className={`truncate ${selected ? "text-v2-text" : "text-v2-text-3"}`}>{selected ? t(selected.label) : t(placeholder)}</span>
            <ChevronDown
              className={`pointer-events-none absolute right-2.5 top-1/2 size-4 -translate-y-1/2 text-v2-text-3 transition-transform ${open ? "rotate-180" : ""}`}
              strokeWidth={1.75}
              aria-hidden
            />
          </>
        )}
      </button>
      {/* Tanlangan chip'ni bir bosishda tozalash — ro'yxatni ochmasdan. */}
      {chipOn && (
        <button
          type="button"
          onClick={() => onChange("")}
          title={t("Tozalash")}
          aria-label={`${t(label)} — ${t("Tozalash")}`}
          className="absolute right-1.5 top-1/2 inline-flex size-6 -translate-y-1/2 items-center justify-center rounded-v2-sm text-v2-brand-text hover:bg-v2-surface/60"
        >
          <X className="size-3.5" strokeWidth={2} />
        </button>
      )}

      <FloatingPanel
        open={open}
        anchorRef={triggerRef}
        onClose={() => close(false)}
        width={variant === "field" ? "anchor" : 260}
        maxHeight={340}
        role="listbox"
        id={listId}
        ariaLabel={t(label)}
      >
        {hasSearch && (
          <div className="flex h-10 shrink-0 items-center gap-2 border-b border-v2-border px-3">
            <Search className="size-4 shrink-0 text-v2-text-3" strokeWidth={1.75} aria-hidden />
            <input
              autoFocus
              value={query}
              onChange={(e) => { setQuery(e.target.value); setActive(0); }}
              onKeyDown={onKeyDown}
              placeholder={t("Qidirish")}
              aria-label={t("Qidirish")}
              className="min-w-0 flex-1 bg-transparent! text-v2-body text-v2-text placeholder:text-v2-text-3 focus:outline-none"
            />
          </div>
        )}
        <div ref={listRef} className="min-h-0 flex-1 overflow-y-auto p-1">
          {clearable && value && (
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => { onChange(""); close(); }}
              className="flex w-full items-center rounded-v2-md px-2.5 py-2 text-left text-v2-small text-v2-text-2 hover:bg-v2-hover"
            >
              {t("Tozalash")}
            </button>
          )}
          {shown.length === 0 ? (
            <div className="px-2.5 py-3 text-v2-small text-v2-text-3">{options.length === 0 ? t("Ro'yxat bo'sh") : t("Topilmadi")}</div>
          ) : (
            shown.map((o, i) => {
              const on = o.value === value;
              return (
                <div
                  key={o.value}
                  role="option"
                  aria-selected={on}
                  data-index={i}
                  onMouseEnter={() => setActive(i)}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => pick(i)}
                  className={`flex cursor-pointer items-center gap-2 rounded-v2-md px-2.5 py-2 text-v2-body ${i === active ? "bg-v2-hover" : ""} ${on ? "font-medium text-v2-brand-text" : "text-v2-text"}`}
                >
                  <Check className={`size-4 shrink-0 ${on ? "text-v2-brand" : "opacity-0"}`} strokeWidth={2} aria-hidden />
                  <span className="min-w-0 flex-1 truncate">{t(o.label)}</span>
                  {o.hint && <span className="shrink-0 text-v2-caption tabular-nums text-v2-text-3">{o.hint}</span>}
                </div>
              );
            })
          )}
          {hidden > 0 && (
            <div className="mt-1 border-t border-v2-border px-2.5 py-2 text-v2-caption text-v2-text-3">
              {t("Yana {n} ta — qidiruvdan foydalaning", { n: hidden })}
            </div>
          )}
        </div>
      </FloatingPanel>
    </div>
  );
}
