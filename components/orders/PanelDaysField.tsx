"use client";

import { useEffect, useRef, useState } from "react";
import { LESSON_DAYS, LESSON_DAY_PRESETS, formatLessonDays, parseLessonDays } from "@/lib/ordersData";

// "Dars kunini tanlang" — BIR NECHTA kun tanlanadi (Dushanba + Chorshanba +
// Juma ...). Ilgari bu bitta tanlovli select edi va tayyor naqshlar ro'yxatidan
// ("Du,Ch,Ju,Ya", "Toq kunlar" ...) faqat bittasini tanlash mumkin edi.
//
// Qiymat buyurtmada avvalgi ko'rinishda saqlanadi — qisqartmalar vergul bilan
// ("Du,Ch,Ju"), shu sabab eski yozuvlar va jadvaldagi "Kun" ustuni
// o'zgarishsiz ishlayveradi (lib/ordersData.ts → parseLessonDays).

export interface PanelDaysFieldProps {
  label: string;
  required?: boolean;
  /** "Du,Ch,Ju" ko'rinishidagi qiymat. */
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  error?: boolean;
}

export default function PanelDaysField({
  label,
  required,
  value,
  onChange,
  placeholder = "Kunlarni tanlang",
  error,
}: PanelDaysFieldProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const selected = parseLessonDays(value);

  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("click", onDocClick);
    return () => document.removeEventListener("click", onDocClick);
  }, [open]);

  const toggle = (code: string) => {
    const next = selected.includes(code) ? selected.filter((c) => c !== code) : [...selected, code];
    onChange(formatLessonDays(next));
  };

  return (
    <div ref={ref} className="relative">
      <label className="block text-[13px] font-medium mb-1.5">
        {label}
        {required && <span className="text-red-500"> *</span>}
      </label>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={`w-full min-h-11 px-3 py-2 rounded-lg border bg-secondary/30 text-sm flex items-center justify-between gap-2 text-left focus:outline-none focus:ring-2 focus:ring-primary/40 ${error ? "border-red-400 ring-2 ring-red-400" : "border-border"}`}
      >
        {selected.length === 0 ? (
          <span className="text-muted-foreground">{placeholder}</span>
        ) : (
          <span className="flex flex-wrap gap-1">
            {selected.map((code) => (
              <span
                key={code}
                className="inline-flex items-center h-6 px-2 rounded-md bg-primary/10 text-primary text-[12px] font-medium"
              >
                {LESSON_DAYS.find((d) => d.code === code)?.label ?? code}
              </span>
            ))}
          </span>
        )}
        <svg className="icon icon-sm text-muted-foreground shrink-0">
          <use href="#i-chevron-down" />
        </svg>
      </button>

      {open && (
        <div className="absolute z-30 mt-1 w-full rounded-lg border border-border bg-card shadow-xl overflow-hidden">
          {/* Tez tanlash — odatiy jadvallar */}
          <div className="flex flex-wrap gap-1.5 border-b border-border p-2">
            {LESSON_DAY_PRESETS.map((p) => (
              <button
                key={p.label}
                type="button"
                onClick={() => onChange(formatLessonDays(p.codes))}
                className="inline-flex items-center h-7 px-2.5 rounded-md border border-border bg-secondary/40 text-[12px] font-medium hover:bg-secondary"
              >
                {p.label}
              </button>
            ))}
            {selected.length > 0 && (
              <button
                type="button"
                onClick={() => onChange("")}
                className="inline-flex items-center h-7 px-2.5 rounded-md text-[12px] text-muted-foreground hover:bg-secondary"
              >
                Tozalash
              </button>
            )}
          </div>

          <div className="max-h-60 overflow-y-auto py-1">
            {LESSON_DAYS.map((d) => {
              const checked = selected.includes(d.code);
              return (
                <label
                  key={d.code}
                  className={`flex items-center gap-2.5 px-3 py-2 text-sm cursor-pointer hover:bg-secondary ${checked ? "text-primary font-medium" : ""}`}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggle(d.code)}
                    className="h-4 w-4 rounded border-border accent-primary cursor-pointer"
                  />
                  <span>{d.label}</span>
                  <span className="ml-auto text-[11.5px] text-muted-foreground tabular-nums">{d.code}</span>
                </label>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
