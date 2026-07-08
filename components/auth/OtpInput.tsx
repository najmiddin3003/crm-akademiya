"use client";

import { useRef, type KeyboardEvent } from "react";

export interface OtpInputProps {
  length?: number;
  value: string;
  onChange: (value: string) => void;
}

// 6 xonali kod kiritish uchun "pill" ko'rinishidagi katakchalar (skrinshotdagi
// dizayn). Desktop va mobile'da bir xil ishlaydi: raqam kiritilganda avtomatik
// keyingi katakchaga o'tadi, Backspace bilan orqaga qaytadi, joyni almashtirib
// (paste) kod qo'yish ham qo'llab-quvvatlanadi.
export default function OtpInput({ length = 6, value, onChange }: OtpInputProps) {
  const inputsRef = useRef<(HTMLInputElement | null)[]>([]);
  const digits = Array.from({ length }, (_, i) => value[i] ?? "");

  const setDigitAt = (index: number, digit: string) => {
    const next = digits.slice();
    next[index] = digit;
    onChange(next.join("").slice(0, length));
  };

  const handleChange = (index: number, raw: string) => {
    const clean = raw.replace(/\D/g, "");
    if (!clean) {
      setDigitAt(index, "");
      return;
    }
    if (clean.length > 1) {
      const next = value.split("");
      for (let i = 0; i < clean.length && index + i < length; i++) next[index + i] = clean[i];
      onChange(next.join("").slice(0, length));
      const lastFilled = Math.min(index + clean.length, length - 1);
      inputsRef.current[lastFilled]?.focus();
      return;
    }
    setDigitAt(index, clean);
    if (index < length - 1) inputsRef.current[index + 1]?.focus();
  };

  const handleKeyDown = (index: number, e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace" && !digits[index] && index > 0) {
      inputsRef.current[index - 1]?.focus();
    }
  };

  return (
    <div className="otp-group">
      {digits.map((d, i) => (
        <input
          key={i}
          ref={(el) => { inputsRef.current[i] = el; }}
          type="text"
          inputMode="numeric"
          maxLength={1}
          value={d}
          onChange={(e) => handleChange(i, e.target.value)}
          onKeyDown={(e) => handleKeyDown(i, e)}
          className="otp-cell"
        />
      ))}
    </div>
  );
}
