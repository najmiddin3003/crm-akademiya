"use client";

import { useId, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { Check, ChevronDown, Search } from "lucide-react";
import { useT } from "@/components/shared/Language";
import FloatingPanel from "@/components/v2/ui/FloatingPanel";
import { fieldCls, type FieldState } from "./fields";

// YANGI VERSIYA: BOY TANLOV (forma maydoni) — rasmlardagi «Guruh» (fan nuqtasi +
// qalin nom + «ustoz · kunlar vaqt»), «Kassa» (toj ikonka + «· Bosh kassa»),
// «Guruh (ixtiyoriy)» ro'yxati (qidiruv «Guruh yoki o'qituvchi», bo'lim
// sarlavhasi «Chet tillari · 3 ta guruh», o'ngda «6 o'quvchi» va ✓, pastda izoh va
// «Hammasini ko'rsatish»). Oddiy V2Select'dan farqi — variant ikki qatorli va
// ikonkali, ro'yxat bo'limlarga bo'linadi.
//
// Klaviatura: ↑↓ yurish, Enter tanlash, Esc yopish (FloatingPanel); qidiruv
// maydoni ochilganda fokusda. Qidiruv `label`, `sublabel` va `keywords` bo'yicha.

export interface PickerOption {
  value: string;
  label: string;
  sublabel?: string;
  /** O'ngdagi kulrang izoh («6 o'quvchi», qoldiq). */
  hint?: ReactNode;
  /** Chapdagi belgi (nuqta, ikonka). */
  lead?: ReactNode;
  /** Bo'lim nomi — ketma-ket bir xillari bitta sarlavha ostida. */
  group?: string;
  keywords?: string;
  disabled?: boolean;
}

export default function V2Picker({
  value,
  onChange,
  options,
  label,
  placeholder,
  renderValue,
  searchable = "auto",
  searchPlaceholder,
  emptyText,
  footer,
  state = "default",
  disabled = false,
  loading = false,
  id,
  width = "anchor",
  onBlur,
  clearable = false,
}: {
  value: string;
  onChange: (value: string) => void;
  options: PickerOption[];
  /** Ekran o'quvchisi uchun nom. */
  label: string;
  placeholder?: string;
  /** Tugmadagi ko'rinish (sukut: lead + label + · sublabel). */
  renderValue?: (o: PickerOption) => ReactNode;
  searchable?: boolean | "auto";
  searchPlaceholder?: string;
  emptyText?: string;
  footer?: (close: () => void) => ReactNode;
  state?: FieldState;
  disabled?: boolean;
  loading?: boolean;
  id?: string;
  width?: number | "anchor";
  onBlur?: () => void;
  /** Ro'yxat boshida «Tanlanmagan» qatori. */
  clearable?: boolean;
}) {
  const { t } = useT();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(-1);
  const btnRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const listId = useId();
  const selected = options.find((o) => o.value === value) ?? null;
  const hasSearch = searchable === true || (searchable === "auto" && options.length > 7);

  const q = query.trim().toLowerCase();
  const shown = useMemo(() => {
    if (!q) return options;
    return options.filter((o) => `${o.label} ${o.sublabel ?? ""} ${o.keywords ?? ""}`.toLowerCase().includes(q));
  }, [options, q]);
  const items = clearable ? [{ value: "", label: t("Tanlanmagan") } as PickerOption, ...shown] : shown;

  const close = () => {
    setOpen(false);
    setQuery("");
    setActive(-1);
    onBlur?.();
  };
  const pick = (o: PickerOption) => {
    if (o.disabled) return;
    onChange(o.value);
    setOpen(false);
    setQuery("");
    setActive(-1);
    btnRef.current?.focus();
  };

  function onKey(e: KeyboardEvent) {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      if (!open) {
        setOpen(true);
        return;
      }
      const dir = e.key === "ArrowDown" ? 1 : -1;
      let i = active;
      for (let n = 0; n < items.length; n++) {
        i = (i + dir + items.length) % items.length;
        if (!items[i]?.disabled) break;
      }
      setActive(i);
      listRef.current?.querySelector<HTMLElement>(`[data-idx="${i}"]`)?.scrollIntoView({ block: "nearest" });
    } else if (e.key === "Enter" && open) {
      e.preventDefault();
      e.stopPropagation();
      const o = items[active];
      if (o) pick(o);
    }
  }

  const defaultValue = (o: PickerOption) => (
    <span className="flex min-w-0 items-center gap-2">
      {o.lead}
      <span className="min-w-0 truncate">
        <span className="font-semibold text-v2-text">{o.label}</span>
        {o.sublabel && <span className="text-v2-text-3"> · {o.sublabel}</span>}
      </span>
    </span>
  );

  // Bo'limlar: ketma-ket bir xil `group` bitta sarlavha ostida.
  const headings = items.map((o, i) => (o.group && o.group !== items[i - 1]?.group ? o.group : null));

  return (
    <>
      <button
        ref={btnRef}
        id={id}
        type="button"
        disabled={disabled || loading}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-label={label}
        onClick={() => setOpen((o) => !o)}
        onKeyDown={onKey}
        className={fieldCls(state, `flex items-center gap-2 text-left ${open ? "border-v2-brand shadow-v2-focus" : ""}`)}
      >
        <span className="min-w-0 flex-1 truncate text-v2-body">
          {loading ? (
            <span className="text-v2-text-3">{t("Yuklanmoqda…")}</span>
          ) : selected ? (
            (renderValue ?? defaultValue)(selected)
          ) : (
            <span className="text-v2-text-3">{placeholder ?? t("Tanlang")}</span>
          )}
        </span>
        <ChevronDown className={`size-4 shrink-0 text-v2-text-3 transition-transform ${open ? "rotate-180" : ""}`} strokeWidth={1.75} aria-hidden />
      </button>
      <FloatingPanel open={open} anchorRef={btnRef} onClose={close} width={width} maxHeight={360} role="dialog" ariaLabel={label}>
        {hasSearch && (
          <div className="shrink-0 p-2 pb-1">
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-v2-text-3" strokeWidth={1.75} aria-hidden />
              <input
                autoFocus
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setActive(-1);
                }}
                onKeyDown={onKey}
                placeholder={searchPlaceholder ?? t("Qidirish…")}
                aria-label={searchPlaceholder ?? t("Qidirish…")}
                className="h-9 w-full rounded-v2-md border border-v2-border bg-v2-surface-2! pl-8 pr-2 text-v2-small text-v2-text placeholder:text-v2-text-3 focus:border-v2-brand focus:outline-none"
              />
            </div>
          </div>
        )}
        <div ref={listRef} id={listId} role="listbox" aria-label={label} className="min-h-0 flex-1 overflow-y-auto p-1">
          {items.length === 0 && <div className="px-3 py-6 text-center text-v2-small text-v2-text-3">{emptyText ?? t("Topilmadi")}</div>}
          {items.map((o, i) => {
            const heading = headings[i];
            const on = o.value === value;
            return (
              <div key={o.value || `__none${i}`}>
                {heading && <div className="px-2.5 pb-1 pt-2 text-v2-caption text-v2-text-3">{heading}</div>}
                <button
                  type="button"
                  role="option"
                  aria-selected={on}
                  data-idx={i}
                  disabled={o.disabled}
                  onMouseEnter={() => setActive(i)}
                  onClick={() => pick(o)}
                  className={`flex w-full items-start gap-2.5 rounded-v2-md px-2.5 py-2 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
                    on ? "bg-v2-brand-bg" : i === active ? "bg-v2-surface-2" : "hover:bg-v2-surface-2"
                  }`}
                >
                  {o.lead && <span className="mt-0.5 flex shrink-0 items-center">{o.lead}</span>}
                  <span className="min-w-0 flex-1">
                    <span className={`block truncate text-v2-small ${o.value ? "font-semibold text-v2-text" : "text-v2-text-2"}`}>{o.label}</span>
                    {o.sublabel && <span className="mt-0.5 block truncate text-v2-caption font-normal text-v2-text-2">{o.sublabel}</span>}
                  </span>
                  {o.hint !== undefined && <span className="mt-px shrink-0 text-v2-caption font-normal tabular-nums text-v2-text-3">{o.hint}</span>}
                  {on && <Check className="mt-0.5 size-4 shrink-0 text-v2-brand-text" strokeWidth={2} aria-hidden />}
                </button>
              </div>
            );
          })}
        </div>
        {footer && <div className="flex shrink-0 items-center justify-between gap-3 border-t border-v2-border px-3 py-2 text-v2-caption">{footer(close)}</div>}
      </FloatingPanel>
    </>
  );
}
