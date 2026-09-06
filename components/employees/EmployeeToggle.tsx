"use client";

import { useReducedMotion } from "@/hooks/useReducedMotion";

// Kichik qayta ishlatiladigan toggle (switch). Xodim qo'shish modalida
// ("Ish haqi chiqarish", "Ikki bosqichli tasdiqlash") va maxsus maydon
// drawer'ida ("Majburiy maydon", "So'rovnomada ko'rinishi") ishlatiladi.
//
// DIQQAT: tugmacha holati INLINE uslub bilan qo'yiladi, Tailwind'ning
// `translate-x-*` klasslari bilan EMAS. Sabab: bu loyihada CSS kompilyatsiya
// qilingan blobdan keladi va `.translate-x-1`, `.translate-x-5` umuman
// generatsiya bo'lmagan (brauzerda tekshirildi). Natijada `.transform`
// qoidasi `var(--tw-translate-x)` ni o'qirdi-yu, u hech qachon
// o'rnatilmagani uchun tugmacha JOYIDAN QIMIRLAMASDI — bosilganda faqat
// fon rangi o'zgarardi.

/** Trek 44x24, tugmacha 16x16 — chetlardan 4px. */
const OFF_X = 4;
const ON_X = 24;

export interface EmployeeToggleProps {
  checked: boolean;
  onChange: (v: boolean) => void;
  label?: string;
  /** O'chirilgan tugmacha bosilmaydi va xiralashadi (masalan arxivdagi xodim). */
  disabled?: boolean;
  /** Sichqoncha ostidagi izoh — nima uchun o'chirilganini aytadi. */
  title?: string;
}

export default function EmployeeToggle({ checked, onChange, label, disabled, title }: EmployeeToggleProps) {
  const reduceMotion = useReducedMotion();
  const dur = reduceMotion ? "0s" : ".2s";

  const btn = (
    <button
      type="button"
      onClick={() => !disabled && onChange(!checked)}
      disabled={disabled}
      title={title}
      className={`relative inline-flex h-6 w-11 items-center rounded-full ${checked ? "bg-primary" : "bg-border"} ${disabled ? "opacity-40 cursor-not-allowed" : ""}`}
      style={{ transition: `background-color ${dur} ease` }}
      role="switch"
      aria-checked={checked}
    >
      <span
        className="inline-block h-4 w-4 rounded-full bg-white shadow"
        style={{
          transform: `translateX(${checked ? ON_X : OFF_X}px)`,
          transition: `transform ${dur} cubic-bezier(.4,0,.2,1)`,
        }}
      />
    </button>
  );

  if (!label) return btn;
  return (
    <div className="flex items-center gap-2">
      {btn}
      <span className="text-[13px] font-medium">{label}</span>
    </div>
  );
}
