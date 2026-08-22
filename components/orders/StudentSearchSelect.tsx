"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

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
   * left, value+chevron right, bottom border only). "compact" = boxed'ning
   * pastroq (h-9) varianti — Topshiriq oynasidagi maydonlarga mos. */
  variant?: "boxed" | "row" | "compact";
  /** Ro'yxatdagi qatorga qo'shimcha satr (masalan telefon / lavozim). */
  subtitleOf?: (name: string) => ReactNode;
  /** Qatorning o'ng chekkasi (masalan balans / oylik). */
  trailingOf?: (name: string) => ReactNode;
  /**
   * Bir vaqtda ko'rsatiladigan maksimal qator. Ro'yxat uzun bo'lsa (masalan
   * tizimdagi barcha odamlar) hammasini DOM'ga chizish shart emas — qolganini
   * qidiruv orqali topiladi. Berilmasa cheklov yo'q.
   */
  limit?: number;
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
  subtitleOf,
  trailingOf,
  limit,
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

  // Qidiruv nom bo'yicha ham, qatorning kichik satri bo'yicha ham ishlaydi
  // (u yerda odatda TELEFON raqam turadi). Raqam kiritilsa faqat raqamlar
  // solishtiriladi — "+998 90 469 51 20" ni "904695120" deb ham topsa bo'ladi.
  //
  // Qidiruv BUTUN ro'yxat bo'yicha ketadi; `limit` faqat ekranga chiziladigan
  // qatorlarga tegishli, shu bois qidirilgan yozuv doim topiladi.
  const haystackOf = (name: string): string => {
    const sub = subtitleOf?.(name);
    return typeof sub === "string" || typeof sub === "number" ? `${name} ${sub}` : name;
  };
  const q = query.trim().toLowerCase();
  const qDigits = query.replace(/\D/g, "");
  const filtered = options.filter((o) => {
    if (!q) return true;
    const hay = haystackOf(o);
    if (hay.toLowerCase().includes(q)) return true;
    return qDigits.length >= 3 && hay.replace(/\D/g, "").includes(qDigits);
  });
  const shown = limit && filtered.length > limit ? filtered.slice(0, limit) : filtered;
  const hidden = filtered.length - shown.length;

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
          shown.map((name, i) => (
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
              {subtitleOf || trailingOf ? (
                <span className="flex items-start justify-between gap-3">
                  <span className="min-w-0">
                    <span className="block truncate font-medium">{name}</span>
                    {subtitleOf && (
                      <span className="block text-[11.5px] text-muted-foreground truncate">{subtitleOf(name)}</span>
                    )}
                  </span>
                  {trailingOf && <span className="shrink-0 text-[12px] tabular-nums">{trailingOf(name)}</span>}
                </span>
              ) : (
                name
              )}
            </button>
          ))
        )}
        {hidden > 0 && (
          <div className="border-t border-border px-3 py-2 text-[11.5px] text-muted-foreground">
            Yana {hidden} ta — qidiruvdan foydalaning
          </div>
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

  const compact = variant === "compact";
  return (
    <div ref={ref} className="relative">
      <label className={compact ? "text-xs font-medium text-muted-foreground mb-1 block" : "block text-[13px] font-medium mb-1.5"}>
        {label}
        {required && <span className="text-red-500"> *</span>}
      </label>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={`w-full px-3 rounded-lg border text-sm flex items-center justify-between text-left focus:outline-none focus:ring-2 ${compact ? "h-9 bg-background focus:ring-blue-500" : "h-11 bg-secondary/30 focus:ring-primary/40"} ${error ? "border-red-400 ring-2 ring-red-400" : "border-border"}`}
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
