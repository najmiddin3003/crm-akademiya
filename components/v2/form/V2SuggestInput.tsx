"use client";

import { useId, useMemo, useRef, useState } from "react";
import { History } from "lucide-react";
import FloatingPanel from "@/components/v2/ui/FloatingPanel";
import { fieldCls, type FieldState } from "./fields";

// YANGI VERSIYA: TAVSIYALI MATN MAYDONI — izoh. Ustiga bosilganda shu kassada
// ILGARI yozilgan izohlar chiqadi va yozgan sari filtrlanadi (eski Kirim
// oynasidagi SuggestInput bilan bir xil vazifa). Ro'yxat MAJBURLAMAYDI: yangi
// matn ham bemalol yoziladi.
//
// Klaviatura: ↓↑ — tavsiyalar bo'ylab, Enter — belgilangan tavsiya (belgilanmagan
// bo'lsa — forma odatdagidek saqlanadi), Esc — ro'yxatni yopadi.

const MAX = 8;

export default function V2SuggestInput({
  value,
  onChange,
  options,
  placeholder,
  maxLength,
  state = "default",
  id,
  ariaLabel,
}: {
  value: string;
  onChange: (v: string) => void;
  options: string[];
  placeholder?: string;
  maxLength?: number;
  state?: FieldState;
  id?: string;
  ariaLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const listId = useId();

  const shown = useMemo(() => {
    const q = value.trim().toLowerCase();
    return options.filter((o) => o.trim() && o !== value && (!q || o.toLowerCase().includes(q))).slice(0, MAX);
  }, [options, value]);
  const visible = open && shown.length > 0;

  const pick = (v: string) => {
    onChange(v);
    setOpen(false);
    setActive(-1);
    inputRef.current?.focus();
  };

  return (
    <>
      <input
        ref={inputRef}
        id={id}
        value={value}
        maxLength={maxLength}
        autoComplete="off"
        placeholder={placeholder}
        aria-label={ariaLabel}
        role="combobox"
        aria-expanded={visible}
        aria-controls={listId}
        aria-autocomplete="list"
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
          setActive(-1);
        }}
        onFocus={() => setOpen(true)}
        onClick={() => setOpen(true)}
        onKeyDown={(e) => {
          if (!visible) return;
          if (e.key === "ArrowDown" || e.key === "ArrowUp") {
            e.preventDefault();
            setActive((a) => (e.key === "ArrowDown" ? (a + 1) % shown.length : a <= 0 ? shown.length - 1 : a - 1));
          } else if (e.key === "Enter" && active >= 0 && shown[active]) {
            // Tavsiya tanlandi — forma saqlanmasin (V2Dialog `defaultPrevented` ni ko'radi).
            e.preventDefault();
            pick(shown[active]);
          } else if (e.key === "Tab") {
            setOpen(false);
          }
        }}
        className={fieldCls(state)}
      />
      <FloatingPanel open={visible} anchorRef={inputRef} onClose={() => setOpen(false)} maxHeight={280} role="listbox" id={listId}>
        <div className="min-h-0 flex-1 overflow-y-auto p-1">
          {shown.map((o, i) => (
            <button
              key={o}
              type="button"
              role="option"
              aria-selected={i === active}
              tabIndex={-1}
              onMouseEnter={() => setActive(i)}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => pick(o)}
              className={`flex w-full items-center gap-2 rounded-v2-md px-2.5 py-2 text-left text-v2-small text-v2-text ${i === active ? "bg-v2-surface-2" : ""}`}
            >
              <History className="size-3.5 shrink-0 text-v2-text-3" strokeWidth={1.75} aria-hidden />
              <span className="min-w-0 flex-1 truncate">{o}</span>
            </button>
          ))}
        </div>
      </FloatingPanel>
    </>
  );
}
