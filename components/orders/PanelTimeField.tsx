"use client";

/**
 * Vaqt qiymatini "HH:mm" ko'rinishiga keltiradi; keltirib bo'lmasa "".
 *
 * Bu maydon ilgari oddiy matn inputi edi va unga xohlagan narsani yozish
 * mumkin edi — bazada "2000" kabi yaroqsiz qiymatlar bor. Endi haqiqiy
 * <input type="time"> ishlatiladi (u faqat "HH:mm" qabul qiladi), shuning
 * uchun eski yozuvlar ochilganda ular ham to'g'ri ko'rinishga keltiriladi.
 */
export function normalizeTime(raw: string | undefined | null): string {
  const s = String(raw ?? "").trim();
  if (!s) return "";
  const m = s.match(/^(\d{1,2})\s*[:.]\s*(\d{1,2})$/) ?? s.match(/^(\d{1,2})(\d{2})$/);
  if (!m) return "";
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (!Number.isInteger(h) || !Number.isInteger(min) || h > 23 || min > 59) return "";
  return `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
}

export interface PanelTimeFieldProps {
  label: string;
  required?: boolean;
  value: string;
  onChange: (value: string) => void;
}

export default function PanelTimeField({ label, required, value, onChange }: PanelTimeFieldProps) {
  const time = normalizeTime(value);
  return (
    <div>
      <label className="block text-[13px] font-medium mb-1.5">
        {label}
        {required && <span className="text-red-500"> *</span>}
      </label>
      <div className="relative">
        {/* Faqat vaqt kiritiladi: brauzerning o'z soat tanlagichi, HH:mm
            niqobi va daqiqa qadami (step=60 — soniyasiz). */}
        <input
          type="time"
          step={60}
          value={time}
          onChange={(e) => onChange(e.target.value)}
          className="w-full h-11 px-3 pr-11 rounded-lg border border-border bg-secondary/30 text-sm tabular-nums focus:outline-none focus:ring-2 focus:ring-primary/40"
        />
        {time && (
          <button
            type="button"
            onClick={() => onChange("")}
            title="Tozalash"
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            <svg className="icon icon-xs">
              <use href="#i-x-circle" />
            </svg>
          </button>
        )}
      </div>
    </div>
  );
}
