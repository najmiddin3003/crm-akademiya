"use client";

import { useRef } from "react";
import { Calendar } from "lucide-react";
import { fieldCls, type FieldState } from "./fields";

// YANGI VERSIYA: TUG'ILGAN SANA — «kk.oo.yyyy» niqobli matn maydoni (rasm «Yangi
// o'quvchi»). Tug'ilgan yilga taqvimni oyma-oy varaqlab yetib bo'lmaydi, shu bois
// yoziladi; ikonka — faqat belgi (bosilsa maydonga fokus). Qiymat — yozilgan
// MATN; ISO («YYYY-MM-DD») va to'g'riligi `parseBirth` bilan olinadi.

/** Raqamlar → «kk.oo.yyyy» (ortiqchasi kesiladi). */
export function maskBirth(raw: string): string {
  const d = raw.replace(/\D/g, "").slice(0, 8);
  return [d.slice(0, 2), d.slice(2, 4), d.slice(4, 8)].filter(Boolean).join(".");
}

export type BirthState = "empty" | "partial" | "invalid" | "ok";

/** «kk.oo.yyyy» → ISO va holat (kelajak sana va 1940 dan oldingisi — noto'g'ri). */
export function parseBirth(text: string): { iso: string; state: BirthState } {
  const d = text.replace(/\D/g, "");
  if (!d) return { iso: "", state: "empty" };
  if (d.length < 8) return { iso: "", state: "partial" };
  const day = Number(d.slice(0, 2));
  const month = Number(d.slice(2, 4));
  const year = Number(d.slice(4, 8));
  const dt = new Date(year, month - 1, day);
  const ok =
    month >= 1 && month <= 12 && dt.getFullYear() === year && dt.getMonth() === month - 1 && dt.getDate() === day && year >= 1940 && dt.getTime() <= Date.now();
  return ok ? { iso: `${d.slice(4, 8)}-${d.slice(2, 4)}-${d.slice(0, 2)}`, state: "ok" } : { iso: "", state: "invalid" };
}

/** ISO → «kk.oo.yyyy». */
export function birthText(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || "");
  return m ? `${m[3]}.${m[2]}.${m[1]}` : "";
}

export default function BirthDateField({
  value,
  onChange,
  onBlur,
  state = "default",
  id,
}: {
  value: string;
  onChange: (text: string) => void;
  onBlur?: () => void;
  state?: FieldState;
  id?: string;
}) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <div className="relative">
      <input
        ref={ref}
        id={id}
        type="text"
        inputMode="numeric"
        autoComplete="off"
        value={value}
        onChange={(e) => onChange(maskBirth(e.target.value))}
        onBlur={onBlur}
        placeholder="kk.oo.yyyy"
        className={fieldCls(state, "pr-10 tabular-nums")}
      />
      <button
        type="button"
        tabIndex={-1}
        aria-hidden
        onClick={() => ref.current?.focus()}
        className="absolute right-1.5 top-1/2 inline-flex size-7 -translate-y-1/2 items-center justify-center rounded-v2-sm text-v2-text-3 hover:text-v2-text-2"
      >
        <Calendar className="size-4" strokeWidth={1.75} />
      </button>
    </div>
  );
}
