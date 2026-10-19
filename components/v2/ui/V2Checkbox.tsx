"use client";

import { useEffect, useRef } from "react";
import { Check, Minus } from "lucide-react";

// YANGI VERSIYA: BELGILASH KATAKCHASI (design/v2/DESIGN.md → «Kiritish
// maydonlari»: belgilangan — `brand` + oq belgi, chegara `border-field`).
// Brauzer katakchasi stillanmaydi (tungi rejimda oq qoladi) — o'rniga
// `appearance-none` + ikonka. `indeterminate` — «sahifadagilarning bir qismi
// belgilangan» (jadval sarlavhasi).

export default function V2Checkbox({
  checked,
  indeterminate = false,
  onChange,
  label,
  disabled = false,
  title,
  className = "",
}: {
  checked: boolean;
  indeterminate?: boolean;
  onChange: (checked: boolean) => void;
  /** Ekran o'quvchisi uchun nom (ko'rinmaydi). */
  label: string;
  /** O'chiq (masalan oyligi sozlanmagan xodim) — `title` da sababi. */
  disabled?: boolean;
  title?: string;
  className?: string;
}) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.indeterminate = indeterminate;
  }, [indeterminate]);

  return (
    <span className={`relative inline-flex size-4 shrink-0 align-middle ${className}`} title={title}>
      <input
        ref={ref}
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
        aria-label={label}
        // Fonlar `!` bilan: globals.css dagi eski `input:focus { background … !important }`
        // bosilgan (fokusdagi) katakchani oqartirib, belgini ko'rinmas qilardi —
        // qatlamli `!important` qatlamsiz `!important` dan kuchli (19.10.2026, o'lchandi).
        className="peer absolute inset-0 m-0 cursor-pointer appearance-none rounded-[4px] border border-v2-border-field bg-v2-surface! transition-colors checked:border-v2-brand checked:bg-v2-brand! indeterminate:border-v2-brand indeterminate:bg-v2-brand! focus-visible:shadow-v2-focus focus-visible:outline-none disabled:cursor-not-allowed disabled:border-v2-border-strong disabled:bg-v2-surface-2!"
      />
      <Check className="pointer-events-none absolute inset-0 m-auto size-3 text-v2-on-brand opacity-0 peer-checked:opacity-100 peer-indeterminate:opacity-0" strokeWidth={3} aria-hidden />
      <Minus className="pointer-events-none absolute inset-0 m-auto size-3 text-v2-on-brand opacity-0 peer-indeterminate:opacity-100" strokeWidth={3} aria-hidden />
    </span>
  );
}
