"use client";

import { useRef, type InputHTMLAttributes } from "react";

// Pul kiritish maydoni: yozilayotganda raqamlar avtomatik uch xonadan
// ajratiladi — 5000000 → "5 000 000".
//
// `type="number"` ISHLATIB BO'LMAYDI: brauzer unda probelga yo'l qo'ymaydi.
// Shuning uchun `type="text"` + `inputMode="numeric"` (mobilda raqam
// klaviaturasi ochiladi).
//
// Ota-komponent qiymatni FAQAT RAQAMLARDAN iborat satr sifatida saqlaydi
// ("5000000"), ya'ni mavjud `Number(value)` hisob-kitoblari o'zgarmaydi.
// Probel faqat ko'rinishda.

/** "5000000" → "5 000 000" */
export function groupDigits(digits: string): string {
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}

/** Har qanday kiritilgan matndan faqat raqamlarni oladi. */
export function onlyDigits(s: string): string {
  return s.replace(/\D/g, "");
}

/** Sonni ko'rinish uchun ajratadi (readOnly maydonlar uchun qulay). */
export function groupNumber(n: number): string {
  const sign = n < 0 ? "-" : "";
  return sign + groupDigits(String(Math.abs(Math.trunc(n))));
}

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, "value" | "onChange" | "type"> & {
  /** Faqat raqamlardan iborat satr. */
  value: string;
  /** Faqat raqamlardan iborat satr qaytaradi. */
  onChange: (digits: string) => void;
};

export default function MoneyInput({ value, onChange, ...rest }: Props) {
  const ref = useRef<HTMLInputElement>(null);

  function handle(e: React.ChangeEvent<HTMLInputElement>) {
    const el = e.target;
    const caret = el.selectionStart ?? el.value.length;
    // Kursordan oldin nechta RAQAM borligini sanaymiz — probellar qayta
    // joylashgandan keyin kursorni o'sha raqamdan keyinga qaytaramiz.
    const digitsBefore = onlyDigits(el.value.slice(0, caret)).length;

    const digits = onlyDigits(el.value);
    const shown = groupDigits(digits);

    // DOM'ni o'zimiz yangilaymiz: agar foydalanuvchi harf kiritsa, `digits`
    // o'zgarmaydi va React qayta render qilmaydi — u holda o'sha harf
    // maydonda qolib ketardi.
    el.value = shown;

    let seen = 0;
    let pos = 0;
    if (digitsBefore > 0) {
      pos = shown.length;
      for (let i = 0; i < shown.length; i++) {
        if (shown[i] !== " ") {
          seen++;
          if (seen === digitsBefore) {
            pos = i + 1;
            break;
          }
        }
      }
    }
    el.setSelectionRange(pos, pos);

    onChange(digits);
  }

  return (
    <input
      {...rest}
      ref={ref}
      type="text"
      inputMode="numeric"
      // `onlyDigits` himoya uchun: ota-komponent bazadan kelgan "1200.50"
      // kabi qiymat bersa ham ko'rinish buzilmasin.
      value={groupDigits(onlyDigits(value))}
      onChange={handle}
    />
  );
}
