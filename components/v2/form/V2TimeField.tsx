"use client";

import { Clock } from "lucide-react";
import { fieldCls, type FieldState } from "./fields";

// YANGI VERSIYA: VAQT MAYDONI — «16:00» (Birinchi darsga yozish oynasi,
// 20.10.2026). Native `type="time"` ishlatilmaydi (UI qoidasi — OS oynasi,
// tungi rejimda oq): raqam yoziladi, «:» o'zi qo'yiladi («1600» → «16:00»).
// Qiymat — "HH:MM" yoki yozilayotgan qismi; to'liqligini chaqiruvchi tekshiradi
// (`isTime`).

export const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

export function isTime(v: string): boolean {
  return TIME_RE.test(v);
}

/** Yozilgan raqamlar → "HH:MM" niqobi («9» → «9», «930» → «09:30», «1600» → «16:00»). */
export function maskTime(raw: string): string {
  const d = raw.replace(/\D/g, "").slice(0, 4);
  if (d.length <= 2) return d;
  // «930» — bir xonali soat: 09:30.
  if (d.length === 3 && Number(d.slice(0, 2)) > 23) return `0${d[0]}:${d.slice(1)}`;
  return `${d.slice(0, 2)}:${d.slice(2)}`;
}

/** Maydondan chiqqanda: «9» → «09:00», «930» → «09:30», «16:0» → «16:00». */
export function finishTime(v: string): string {
  const d = v.replace(/\D/g, "");
  if (d.length === 1 || d.length === 2) return `${d.padStart(2, "0")}:00`;
  if (d.length === 3) return Number(d.slice(0, 2)) > 23 ? `0${d[0]}:${d.slice(1)}` : `${d.slice(0, 2)}:${d[2]}0`;
  return v;
}

export default function V2TimeField({
  value,
  onChange,
  onBlur,
  state = "default",
  id,
  disabled = false,
  icon = true,
  ariaLabel,
}: {
  value: string;
  onChange: (v: string) => void;
  onBlur?: () => void;
  state?: FieldState;
  id?: string;
  disabled?: boolean;
  /** Chapdagi soat ikonkasi («Yangi topshiriq» oynasida yo'q — sana yonida, 23.10.2026). */
  icon?: boolean;
  ariaLabel?: string;
}) {
  return (
    <div className="relative">
      {icon && <Clock className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-v2-text-2" strokeWidth={1.75} aria-hidden />}
      <input
        id={id}
        type="text"
        inputMode="numeric"
        autoComplete="off"
        placeholder="16:00"
        maxLength={5}
        disabled={disabled}
        aria-label={ariaLabel}
        value={value}
        onChange={(e) => onChange(maskTime(e.target.value))}
        onBlur={() => {
          const done = finishTime(value);
          if (done !== value) onChange(done);
          onBlur?.();
        }}
        className={fieldCls(state, `${icon ? "pl-9" : ""} tabular-nums`)}
      />
    </div>
  );
}
