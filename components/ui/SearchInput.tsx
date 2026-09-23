"use client";

import { forwardRef, type InputHTMLAttributes } from "react";
import { Search, X } from "lucide-react";
import { useT } from "@/components/shared/Language";

// QIDIRUV MAYDONI — ro'yxat sahifalaridagi qidiruv inputining YAGONA nusxasi.
//
// Ilgari har bir sahifa (Guruhlar, O'quvchilar, Xonalar ...) bir xil
// markup'ni o'zi yozardi: nisbiy o'ram + chapdagi lupa + `h-9 rounded-lg
// border bg-card pl-9` input. Ko'rinish aynan o'sha, lekin endi bitta joyda
// va ichida tozalash tugmasi bor (yozilgan matn bir bosishda o'chadi).
//
// `size`: sm — filtrlar qatori (h-9, ui/Select `size="sm"` bilan bir tekis);
// md — modal formalari (h-10). `onChange` qiymat oladi, hodisa emas —
// ui/Select bilan bir xil qolip.

export interface SearchInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "value" | "onChange" | "size"> {
  value: string;
  onChange: (value: string) => void;
  size?: "sm" | "md";
  /** Tashqi o'ramga (kenglik, flex) beriladi. */
  className?: string;
  /** Tozalash tugmasi (standart — yoqiq). */
  clearable?: boolean;
}

const SearchInput = forwardRef<HTMLInputElement, SearchInputProps>(function SearchInput(
  { value, onChange, size = "sm", className = "", clearable = true, placeholder = "Qidirish", onKeyDown, ...rest },
  ref,
) {
  const { t } = useT();
  const h = size === "md" ? "h-10" : "h-9";
  return (
    <div className={`relative ${className}`}>
      <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <input
        ref={ref}
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          // Esc — avval matnni tozalaydi (modal ichida bo'lsa oyna yopilmasin).
          if (e.key === "Escape" && value) {
            e.stopPropagation();
            onChange("");
          }
          onKeyDown?.(e);
        }}
        placeholder={t(placeholder)}
        className={`w-full ${h} rounded-lg border border-border bg-card pl-9 ${clearable && value ? "pr-8" : "pr-3"} text-sm transition-shadow focus:outline-none focus:ring-2 focus:ring-primary/40`}
        {...rest}
      />
      {clearable && value && (
        <button
          type="button"
          onClick={() => onChange("")}
          title={t("Tozalash")}
          className="absolute right-1.5 top-1/2 inline-flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
});

export default SearchInput;
