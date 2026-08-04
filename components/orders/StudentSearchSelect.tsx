"use client";

import { useEffect, useRef, useState } from "react";

export interface StudentSearchSelectProps {
  label: string;
  required?: boolean;
  value: string;
  onChange: (value: string) => void;
  options: string[];
  placeholder?: string;
  error?: boolean;
  /** "boxed" (default) = AddOrderModal drawer style (stacked label + bordered
   * field). "row" = the compact /orders-list/add page style (inline label
   * left, value+chevron right, bottom border only). */
  variant?: "boxed" | "row";
}

export default function StudentSearchSelect({
  label,
  required,
  value,
  onChange,
  options,
  placeholder = "O'quvchini qidirish",
  error,
  variant = "boxed",
}: StudentSearchSelectProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("click", onDocClick);
    return () => document.removeEventListener("click", onDocClick);
  }, [open]);

  const filtered = options.filter((o) => o.toLowerCase().includes(query.trim().toLowerCase()));

  const dropdown = open && (
    <div className="absolute z-30 mt-1 w-full rounded-lg border border-border bg-card shadow-xl overflow-hidden">
      <div className="relative border-b border-border">
        <svg className="icon icon-sm absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none">
          <use href="#i-search" />
        </svg>
        <input
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={placeholder}
          className="w-full h-9 pl-9 pr-3 text-sm bg-transparent focus:outline-none"
        />
      </div>
      <div className="max-h-56 overflow-y-auto">
        {value && (
          <button
            type="button"
            onClick={() => {
              onChange("");
              setQuery("");
              setOpen(false);
            }}
            className="block w-full px-3 py-2 text-left text-sm text-muted-foreground hover:bg-secondary"
          >
            Tozalash
          </button>
        )}
        {filtered.length === 0 ? (
          <div className="px-3 py-3 text-sm text-muted-foreground">Topilmadi</div>
        ) : (
          filtered.map((name, i) => (
            <button
              key={`${name}-${i}`}
              type="button"
              onClick={() => {
                onChange(name);
                setQuery("");
                setOpen(false);
              }}
              className={`block w-full px-3 py-2 text-left text-sm hover:bg-secondary ${value === name ? "bg-primary/10 font-medium text-primary" : ""}`}
            >
              {name}
            </button>
          ))
        )}
      </div>
    </div>
  );

  if (variant === "row") {
    return (
      <div ref={ref} className="relative">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="w-full flex items-center justify-between py-3 border-none border-b border-border bg-transparent text-left"
        >
          <span className="text-sm font-medium">
            {label}
            {required && <span className="text-red-500">*</span>}:
          </span>
          <span className="flex items-center gap-1 text-sm text-muted-foreground">
            <span className="truncate" style={{ maxWidth: 160 }}>
              {value || placeholder}
            </span>
            <svg className="icon icon-xs shrink-0">
              <use href="#i-chevron-down" />
            </svg>
          </span>
        </button>
        {dropdown}
      </div>
    );
  }

  return (
    <div ref={ref} className="relative">
      <label className="block text-[13px] font-medium mb-1.5">
        {label}
        {required && <span className="text-red-500"> *</span>}
      </label>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={`w-full h-11 px-3 rounded-lg border bg-secondary/30 text-sm flex items-center justify-between text-left focus:outline-none focus:ring-2 focus:ring-primary/40 ${error ? "border-red-400 ring-2 ring-red-400" : "border-border"}`}
      >
        <span className={value ? "" : "text-muted-foreground"}>{value || placeholder}</span>
        <svg className="icon icon-sm text-muted-foreground shrink-0">
          <use href="#i-chevron-down" />
        </svg>
      </button>
      {dropdown}
    </div>
  );
}
