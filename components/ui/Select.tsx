"use client";

import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown } from "lucide-react";

// Qo'lda yozilgan tanlov ro'yxati (native `<select>` o'rniga).
//
// NIMA UCHUN KERAK: brauzerning o'z ochiladigan ro'yxatini stillab
// BO'LMAYDI — u operatsion tizimning oynasi, shuning uchun CRM tungi
// rejimda ham oq fonli, ko'k ajratmali ro'yxat chiqarardi va qatorga
// qo'shimcha izoh (masalan kassadagi qoldiq) qo'yib bo'lmasdi.
//
// Bu yerda ro'yxat oddiy DOM elementlari bilan chiziladi, ya'ni loyihaning
// ranglari, o'lchamlari va har bir qatorga qo'shimcha `hint` matni ishlaydi.

export interface SelectOption {
  value: string;
  label: string;
  /** Yorliq yonidagi kulrang izoh — masalan "500 000 so'm". */
  hint?: string;
  disabled?: boolean;
}

export default function Select({
  value,
  options,
  onChange,
  placeholder = "Tanlang",
  disabled = false,
  className = "",
}: {
  value: string;
  options: SelectOption[];
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  // Klaviatura bilan yurilayotgan qator (sichqoncha ustiga kelganda ham
  // shu o'zgaradi — ikkalasi bitta ko'rsatkichni boshqaradi).
  const [activeIndex, setActiveIndex] = useState(-1);
  const rootRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const selected = options.find((o) => o.value === value) ?? null;

  // Tashqariga bosilsa yopiladi. Tinglovchi faqat ochiq holatda ulanadi —
  // yopiq ro'yxatlar sahifadagi har bosishni kuzatib turmasin.
  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [open]);

  // Tanlangan qator ko'rinib tursin (ro'yxat uzun bo'lsa aylantiriladi).
  useEffect(() => {
    if (!open || !listRef.current) return;
    const el = listRef.current.querySelector<HTMLElement>('[data-active="true"]');
    el?.scrollIntoView({ block: "nearest" });
  }, [open, activeIndex]);

  function openList() {
    if (disabled) return;
    setActiveIndex(options.findIndex((o) => o.value === value));
    setOpen(true);
  }

  function pick(index: number) {
    const opt = options[index];
    if (!opt || opt.disabled) return;
    onChange(opt.value);
    setOpen(false);
  }

  /** Keyingi TANLASA BO'LADIGAN qator — o'chirilganlari sakrab o'tiladi. */
  function step(from: number, dir: 1 | -1) {
    for (let i = 1; i <= options.length; i++) {
      const next = (from + dir * i + options.length * i) % options.length;
      if (!options[next]?.disabled) return next;
    }
    return from;
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (disabled) return;
    if (!open) {
      if (e.key === "ArrowDown" || e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        openList();
      }
      return;
    }
    if (e.key === "Escape") {
      // Ro'yxat modal ichida bo'lishi mumkin — Escape avval SHUNI yopsin,
      // modal yopilib ketmasin.
      e.stopPropagation();
      setOpen(false);
      return;
    }
    if (e.key === "ArrowDown") { e.preventDefault(); setActiveIndex((i) => step(i < 0 ? -1 : i, 1)); return; }
    if (e.key === "ArrowUp") { e.preventDefault(); setActiveIndex((i) => step(i < 0 ? 0 : i, -1)); return; }
    if (e.key === "Enter" || e.key === " ") { e.preventDefault(); pick(activeIndex); return; }
    if (e.key === "Tab") setOpen(false);
  }

  return (
    <div ref={rootRef} className={`relative ${className}`}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => (open ? setOpen(false) : openList())}
        onKeyDown={onKeyDown}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="w-full h-10 pl-3 pr-9 rounded-lg border border-border bg-card text-sm text-left focus:outline-none focus:ring-2 focus:ring-primary/30 disabled:opacity-60 disabled:cursor-not-allowed flex items-center"
      >
        {selected ? (
          <span className="truncate">
            {selected.label}
            {selected.hint && <span className="text-muted-foreground"> ({selected.hint})</span>}
          </span>
        ) : (
          <span className="text-muted-foreground truncate">{placeholder}</span>
        )}
        <ChevronDown
          className={`w-4 h-4 pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        <div
          ref={listRef}
          role="listbox"
          className="absolute z-30 mt-1 w-full max-h-60 overflow-y-auto rounded-lg border border-border bg-card shadow-lg py-1"
        >
          {options.length === 0 && (
            <div className="px-3 py-2 text-[13px] text-muted-foreground">Ro&apos;yxat bo&apos;sh</div>
          )}
          {options.map((o, i) => {
            const isSelected = o.value === value;
            const isActive = i === activeIndex;
            return (
              <div
                key={o.value}
                role="option"
                aria-selected={isSelected}
                data-active={isActive}
                onMouseEnter={() => setActiveIndex(i)}
                onMouseDown={(e) => e.preventDefault()} // fokus tugmada qolsin
                onClick={() => pick(i)}
                className={`flex items-center gap-2 px-3 py-2 text-[13px] cursor-pointer ${
                  o.disabled ? "opacity-40 cursor-not-allowed" : isActive ? "bg-secondary" : ""
                }`}
              >
                <Check className={`w-3.5 h-3.5 shrink-0 ${isSelected ? "text-primary" : "opacity-0"}`} />
                <span className="truncate">{o.label}</span>
                {o.hint && <span className="ml-auto text-[12px] text-muted-foreground tabular-nums shrink-0">{o.hint}</span>}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
