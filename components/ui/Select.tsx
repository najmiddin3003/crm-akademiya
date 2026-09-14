"use client";

import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown, Search } from "lucide-react";
import { SpinnerBlock } from "@/components/ui/Spinner";
import { LOADING_TEXT } from "@/lib/selectPlaceholder";

// QO'LDA YASALGAN TANLOV RO'YXATI — loyihadagi YAGONA select.
//
// NIMA UCHUN native `<select>` EMAS: brauzerning ochiladigan ro'yxati
// operatsion tizimning oynasi — uni stillab bo'lmaydi (tungi rejimda oq,
// ko'k ajratmali), qatorga izoh qo'yib bo'lmaydi, qidiruv yo'q. Dizayn
// kassadagi o'quvchi tanlash (orders/StudentSearchSelect) bilan bir xil:
// yuqorida qidiruv, pastda ro'yxat, tanlangani ko'k, "Tozalash" qatori.
//
// RO'YXAT <body> GA PORTAL QILINADI. Ikki sabab:
//   1. Modal tanasi `overflow-y-auto` — ichida absolute ochilgan ro'yxat
//      pastki maydonlarda kesilib qolardi (Yangi guruh > Ta'lim turi).
//   2. `.st-drawer` transform ishlatadi — `position: fixed` unga nisbatan
//      hisoblanib, ro'yxat ekrandan tashqariga chiqardi (DateField izohi).
// Joy yetmasa ro'yxat maydonning USTIGA ochiladi.
//
// QIDIRUV: `searchable="auto"` (standart) — variant SEARCH_THRESHOLD dan
// ko'p bo'lsa chiqadi. Holat/ta'lim turi kabi 2–5 talik ro'yxatda qidiruv
// ortiqcha, kurslar/o'qituvchilar/xonalarda esa kerak.
//
// KLAVIATURA: ↑↓ yurish, Enter/Space tanlash, Esc yopish (modalga
// yetkazilmaydi — avval ro'yxat yopilsin), Backspace/Delete — tozalash
// (`clearable` bo'lsa), harf bosilsa qidiruvga tushadi.
//
// KO'P TANLOV (`multiple`): `values` + `onChangeMany`. Qator bosilganda
// ro'yxat YOPILMAYDI — belgi almashadi (imtihonda qatnashgan o'quvchilar
// kabi 20–30 talik ro'yxatni birma-bir belgilash uchun). Ro'yxat boshida
// "Hammasini tanlash" / "Tozalash" qatorlari; tugmada — tanlanganlar soni
// (`summary` bilan o'zgartiriladi). Bitta komponent — ko'rinish, joylashuv
// va klaviatura oddiy tanlov bilan aynan bir xil bo'lsin.

export interface SelectOption {
  value: string;
  label: string;
  /** Yorliqning o'ng chekkasidagi kulrang izoh — masalan "500 000 so'm". */
  hint?: string;
  /** Yorliq ostidagi kichik satr — masalan telefon yoki lavozim. */
  sub?: string;
  /** Guruh sarlavhasi (native <optgroup> o'rnida) — ketma-ket bir xil
   * guruhli qatorlar ustida bir marta chiziladi. */
  group?: string;
  disabled?: boolean;
}

export interface SelectProps {
  /** Tanlangan qiymat (oddiy tanlov). `multiple` da o'qilmaydi. */
  value?: string;
  options: SelectOption[];
  /** Oddiy tanlovda chaqiriladi. `multiple` da o'rniga `onChangeMany`. */
  onChange?: (value: string) => void;
  /** Ko'p tanlov rejimi — yuqoridagi izohga qarang. */
  multiple?: boolean;
  /** Ko'p tanlovda tanlanganlar. */
  values?: string[];
  onChangeMany?: (values: string[]) => void;
  /** Ko'p tanlovda tugma matni: (tanlanganlar soni, jami) → satr.
   * Berilmasa "N ta tanlandi". */
  summary?: (count: number, total: number) => string;
  placeholder?: string;
  disabled?: boolean;
  /**
   * Ro'yxat hali BACKENDDAN kelayotgan bo'lsa `true` — "Ro'yxat bo'sh"
   * o'rniga spinner. Bo'sh ro'yxat "hali kelmadi" degani emas.
   */
  loading?: boolean;
  /** Tashqi o'ramga (yorliq bo'lsa) yoki tugmaning o'ziga beriladi. */
  className?: string;
  /** Maydon ustidagi yorliq. Berilmasa chizilmaydi (filtrlar qatori). */
  label?: string;
  required?: boolean;
  error?: boolean;
  /** sm — filtrlar qatori (h-9); md — modal formalari (h-10); lg — drawer (h-11);
   * row — /orders-list/add qatorlari (h-8, chegarasiz, bg-secondary). */
  size?: "sm" | "md" | "lg" | "row";
  /** true/false — majburan; "auto" — SEARCH_THRESHOLD dan ko'p bo'lsa. */
  searchable?: boolean | "auto";
  searchPlaceholder?: string;
  /** Tanlanganini bo'shatish mumkin — ro'yxat boshida "Tozalash" qatori. */
  clearable?: boolean;
  /** Ro'yxat UMUMAN bo'sh bo'lganda "Ro'yxat bo'sh" o'rniga matn. */
  emptyText?: string;
  /** Bir vaqtda chiziladigan maksimal qator; qolgani qidiruv orqali. */
  limit?: number;
  id?: string;
  /** Tugma ustidagi izoh (title). */
  title?: string;
  /** Ro'yxat ochilganda — masalan keshni oldindan isitish uchun. */
  onOpen?: () => void;
  style?: CSSProperties;
  /**
   * Tugma bosilganda fokusni O'ZIGA OLMAYDI — matn muharriri asboblari
   * uchun: aks holda contentEditable'dagi tanlov yo'qolib, format
   * buyrug'i hech narsaga qo'llanmasdi. Klaviatura bilan boshqarish
   * bu rejimda ishlamaydi (fokus yo'q).
   */
  preserveFocus?: boolean;
}

const SEARCH_THRESHOLD = 8;
/** Ro'yxatning eng katta balandligi (px) — joy hisobida ishlatiladi. */
const MENU_MAX_H = 300;
const MENU_MIN_W = 180;
/** DateField kalendari bilan bir xil — drawer (1001) va modal (100) ustida. */
const MENU_Z = 1200;

const SIZE_CLS: Record<NonNullable<SelectProps["size"]>, string> = {
  sm: "h-9 text-[13px] bg-card rounded-lg border",
  md: "h-10 text-sm bg-card rounded-lg border",
  lg: "h-11 text-sm bg-secondary/30 rounded-lg border",
  row: "h-8 text-sm bg-secondary rounded-md border-0",
};

const NO_VALUES: string[] = [];

export default function Select({
  value = "",
  options,
  onChange,
  multiple = false,
  values = NO_VALUES,
  onChangeMany,
  summary,
  placeholder = "Tanlang",
  disabled = false,
  loading = false,
  className = "",
  label,
  required,
  error,
  size = "md",
  searchable = "auto",
  searchPlaceholder = "Qidirish",
  clearable = false,
  emptyText,
  limit = 50,
  id,
  title,
  onOpen,
  style,
  preserveFocus = false,
}: SelectProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  // Klaviatura bilan yurilayotgan qator (sichqoncha ustiga kelganda ham shu).
  const [activeIndex, setActiveIndex] = useState(-1);
  // Pastga ochilsa `top`, ustiga ochilsa `bottom` (ekran pastidan) beriladi —
  // transform ishlatilmaydi, chunki kirish animatsiyasi o'zi transform'ni
  // boshqaradi va inline qiymatni ustidan yozib yuborardi.
  const [pos, setPos] = useState<{ top?: number; bottom?: number; left: number; width: number; up: boolean }>({ left: 0, width: 0, up: false });
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const listboxId = useId();

  const selected = multiple ? null : (options.find((o) => o.value === value) ?? null);
  // Ko'p tanlovda "belgilanganmi" tekshiruvi har qator uchun — to'plam.
  const valueSet = useMemo(() => new Set(multiple ? values : []), [multiple, values]);
  const hasValue = multiple ? values.length > 0 : Boolean(value);
  const hasSearch = searchable === true || (searchable === "auto" && options.length > SEARCH_THRESHOLD);

  // Qidiruv yorliq, izoh va kichik satr bo'yicha; raqam yozilsa faqat
  // raqamlar solishtiriladi ("+998 90 469 51 20" ni "904695120" deb topadi).
  // Yopiq ro'yxat filtrlanmaydi — ota forma har o'zgarganda 6 000 qatorni
  // qayta skanerlamasin.
  const q = query.trim().toLowerCase();
  const qDigits = query.replace(/\D/g, "");
  const filtered = useMemo(() => {
    if (!open) return [];
    if (!q) return options;
    return options.filter((o) => {
      const hay = `${o.label} ${o.sub ?? ""} ${o.hint ?? ""}`.toLowerCase();
      if (hay.includes(q)) return true;
      return qDigits.length >= 3 && hay.replace(/\D/g, "").includes(qDigits);
    });
  }, [open, options, q, qDigits]);
  const shown = filtered.length > limit ? filtered.slice(0, limit) : filtered;
  const hidden = filtered.length - shown.length;

  // Ochilganda maydonga nisbatan o'lchanadi, keyin skroll/resize'da qayta.
  // Joy yetmasa ro'yxat maydonning ustiga ochiladi.
  useLayoutEffect(() => {
    if (!open) return;
    const rows = Math.min(shown.length || 1, 6);
    function reposition() {
      const el = triggerRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const need = Math.min(MENU_MAX_H, rows * 36 + (hasSearch ? 41 : 0) + 8);
      const below = window.innerHeight - r.bottom - 8;
      const above = r.top - 8;
      const up = below < need && above > below;
      const width = Math.max(r.width, MENU_MIN_W);
      const left = Math.min(r.left, Math.max(8, window.innerWidth - width - 8));
      setPos(up
        ? { bottom: window.innerHeight - r.top + 4, left, width, up }
        : { top: r.bottom + 4, left, width, up });
    }
    reposition();
    window.addEventListener("scroll", reposition, true);
    window.addEventListener("resize", reposition);
    return () => {
      window.removeEventListener("scroll", reposition, true);
      window.removeEventListener("resize", reposition);
    };
  }, [open, shown.length, hasSearch]);

  // Tashqariga bosilsa yopiladi. Ro'yxat portalda — ikkala ildiz tekshiriladi.
  // Tinglovchi faqat ochiq holatda ulanadi.
  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: MouseEvent) {
      const t = e.target as Node;
      if (rootRef.current?.contains(t) || menuRef.current?.contains(t)) return;
      setOpen(false);
      setQuery("");
    }
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [open]);

  // Faol qator ko'rinib tursin.
  useEffect(() => {
    if (!open || !listRef.current) return;
    const el = listRef.current.querySelector<HTMLElement>('[data-active="true"]');
    el?.scrollIntoView({ block: "nearest" });
  }, [open, activeIndex]);

  function openList(initialQuery = "") {
    if (disabled || loading) return;
    onOpen?.();
    setQuery(initialQuery);
    setActiveIndex(initialQuery || multiple ? 0 : options.findIndex((o) => o.value === value));
    setOpen(true);
  }

  function close() {
    setOpen(false);
    setQuery("");
    if (!preserveFocus) triggerRef.current?.focus();
  }

  function clear() {
    if (multiple) onChangeMany?.([]);
    else onChange?.("");
  }

  /** Ko'p tanlov: hozir KO'RINIB turgan (qidiruvdan o'tgan) qatorlarning hammasini belgilaydi. */
  function selectAllShown() {
    const next = new Set(values);
    for (const o of shown) if (!o.disabled) next.add(o.value);
    onChangeMany?.([...next]);
  }

  function pick(index: number) {
    const opt = shown[index];
    if (!opt || opt.disabled) return;
    if (multiple) {
      // Belgi almashadi, ro'yxat ochiq qoladi — keyingisini ham belgilash uchun.
      onChangeMany?.(valueSet.has(opt.value) ? values.filter((v) => v !== opt.value) : [...values, opt.value]);
      return;
    }
    onChange?.(opt.value);
    close();
  }

  /** Keyingi TANLASA BO'LADIGAN qator — o'chirilganlari sakrab o'tiladi. */
  function step(from: number, dir: 1 | -1) {
    const n = shown.length;
    if (!n) return -1;
    for (let i = 1; i <= n; i++) {
      const next = (from + dir * i + n * i) % n;
      if (!shown[next]?.disabled) return next;
    }
    return from;
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (disabled) return;
    if (!open) {
      if (e.key === "ArrowDown" || e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        openList();
        return;
      }
      if (clearable && hasValue && (e.key === "Backspace" || e.key === "Delete")) {
        e.preventDefault();
        clear();
        return;
      }
      // Harf bosilsa darhol qidiruv bilan ochiladi.
      if (hasSearch && e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
        openList(e.key);
      }
      return;
    }
    if (e.key === "Escape") {
      // Ro'yxat modal ichida bo'lishi mumkin — Escape avval SHUNI yopsin.
      e.stopPropagation();
      e.preventDefault();
      close();
      return;
    }
    if (e.key === "ArrowDown") { e.preventDefault(); setActiveIndex((i) => step(i < 0 ? -1 : i, 1)); return; }
    if (e.key === "ArrowUp") { e.preventDefault(); setActiveIndex((i) => step(i < 0 ? 0 : i, -1)); return; }
    if (e.key === "Home") { e.preventDefault(); setActiveIndex(step(-1, 1)); return; }
    if (e.key === "End") { e.preventDefault(); setActiveIndex(step(0, -1)); return; }
    if (e.key === "Enter") { e.preventDefault(); pick(activeIndex); return; }
    if (e.key === " " && !hasSearch) { e.preventDefault(); pick(activeIndex); return; }
    if (e.key === "Tab") { setOpen(false); setQuery(""); }
  }

  // `className` yorliq bo'lsa o'ramga (kenglik butun maydonga tegishli),
  // bo'lmasa tugmaning o'ziga beriladi (filtrlar qatoridagi `w-36`).
  const triggerCls = [
    "w-full text-left flex items-center gap-2 pl-3 pr-8 relative",
    "focus:outline-none focus:ring-2 disabled:opacity-60 disabled:cursor-not-allowed transition-[box-shadow,border-color]",
    SIZE_CLS[size],
    error
      ? "border-red-400 ring-2 ring-red-400/60"
      : open
        ? "border-primary/50 ring-2 ring-primary/30"
        : "border-border focus:ring-primary/30",
    label ? "" : className,
  ].join(" ");

  const menu = open && (
    <div
      ref={menuRef}
      role="listbox"
      id={listboxId}
      style={{ position: "fixed", top: pos.top, bottom: pos.bottom, left: pos.left, width: pos.width, zIndex: MENU_Z }}
      className={`ui-pop-in ${pos.up ? "ui-pop-up" : ""} rounded-xl border border-border bg-card shadow-xl overflow-hidden`}
    >
      {hasSearch && (
        <div className="flex items-center gap-2 px-3 h-10 border-b border-border">
          <Search className="w-4 h-4 text-muted-foreground shrink-0" />
          <input
            autoFocus
            value={query}
            onChange={(e) => { setQuery(e.target.value); setActiveIndex(0); }}
            onKeyDown={onKeyDown}
            placeholder={searchPlaceholder}
            className="flex-1 min-w-0 bg-transparent text-sm focus:outline-none"
          />
        </div>
      )}
      <div ref={listRef} className="max-h-56 overflow-y-auto py-1">
        {/* Ko'p tanlov: hammasini belgilash (ko'rinib turganlarni) — tozalash
            qatori bilan bir qatorda; ikkalasi ham ro'yxatni yopmaydi. */}
        {multiple && !loading && shown.some((o) => !o.disabled && !valueSet.has(o.value)) && (
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={selectAllShown}
            className="block w-full px-3 py-2 text-left text-[13px] text-primary font-medium hover:bg-secondary"
          >
            Hammasini tanlash
          </button>
        )}
        {clearable && hasValue && (
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => { clear(); if (!multiple) close(); }}
            className="block w-full px-3 py-2 text-left text-[13px] text-muted-foreground hover:bg-secondary"
          >
            Tozalash
          </button>
        )}
        {loading ? (
          <SpinnerBlock size={20} />
        ) : shown.length === 0 ? (
          <div className="px-3 py-3 text-[13px] text-muted-foreground">
            {options.length === 0 ? (emptyText ?? "Ro'yxat bo'sh") : "Topilmadi"}
          </div>
        ) : (
          shown.map((o, i) => {
            const isSelected = multiple ? valueSet.has(o.value) : o.value === value;
            const isActive = i === activeIndex;
            const groupHead = o.group && o.group !== shown[i - 1]?.group ? o.group : null;
            return (
              <div key={o.value}>
              {groupHead && (
                <div className="px-3 pt-2 pb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{groupHead}</div>
              )}
              <div
                role="option"
                aria-selected={isSelected}
                aria-disabled={o.disabled || undefined}
                data-active={isActive}
                onMouseEnter={() => setActiveIndex(i)}
                onMouseDown={(e) => e.preventDefault()} // fokus maydonda qolsin
                onClick={() => pick(i)}
                className={`flex items-center gap-2 mx-1 px-2.5 py-2 rounded-md text-[13px] ${
                  o.disabled
                    ? "opacity-40 cursor-not-allowed"
                    : `cursor-pointer ${isActive ? "bg-secondary" : ""} ${isSelected ? "text-primary font-medium" : ""}`
                }`}
              >
                <Check className={`w-3.5 h-3.5 shrink-0 ${isSelected ? "text-primary" : "opacity-0"}`} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate">{o.label}</span>
                  {o.sub && <span className="block truncate text-[11.5px] text-muted-foreground font-normal">{o.sub}</span>}
                </span>
                {o.hint && <span className="text-[12px] text-muted-foreground tabular-nums shrink-0">{o.hint}</span>}
              </div>
              </div>
            );
          })
        )}
        {hidden > 0 && (
          <div className="border-t border-border mt-1 px-3 py-2 text-[11.5px] text-muted-foreground">
            Yana {hidden} ta — qidiruvdan foydalaning
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div ref={rootRef} className={label ? className : undefined}>
      {label && (
        <label htmlFor={id} className="block text-[13px] font-medium mb-1.5">
          {label}
          {required && <span className="text-red-500">*</span>}
        </label>
      )}
      <button
        ref={triggerRef}
        id={id}
        title={title}
        style={style}
        type="button"
        disabled={disabled}
        onMouseDown={preserveFocus ? (e) => e.preventDefault() : undefined}
        onClick={() => (open ? close() : openList())}
        onKeyDown={onKeyDown}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listboxId : undefined}
        className={triggerCls}
      >
        {multiple && values.length > 0 ? (
          <span className="truncate">{summary ? summary(values.length, options.length) : `${values.length} ta tanlandi`}</span>
        ) : selected ? (
          <span className="truncate">
            {selected.label}
            {selected.hint && <span className="text-muted-foreground"> ({selected.hint})</span>}
          </span>
        ) : (
          <span className="text-muted-foreground truncate">{loading ? LOADING_TEXT : placeholder}</span>
        )}
        <ChevronDown
          className={`w-4 h-4 pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground transition-transform duration-150 ${open ? "rotate-180" : ""}`}
        />
      </button>
      {menu && createPortal(menu, document.body)}
    </div>
  );
}
