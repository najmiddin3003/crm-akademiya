"use client";

import { useState } from "react";
import { useT } from "@/components/shared/Language";

export interface PasswordFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  /** `<label htmlFor>` bog'lanishi uchun — Sozlamalar → Xavfsizlik ishlatadi. */
  id?: string;
  /** "current-password" / "new-password" — brauzer parol menejeri uchun. */
  autoComplete?: string;
  /** Maydon ostidagi kichik izoh (masalan "Kamida 8 belgi"). */
  hint?: string;
}

export default function PasswordField({
  label,
  value,
  onChange,
  placeholder = "••••••",
  id,
  autoComplete,
  hint,
}: PasswordFieldProps) {
  const { t } = useT();
  const [visible, setVisible] = useState(false);

  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-[13px] font-medium text-foreground/80">{label}</label>
      <div className="relative">
        <input
          id={id}
          type={visible ? "text" : "password"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          autoComplete={autoComplete}
          className="h-10 w-full rounded-lg border border-border bg-background px-3 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          className="absolute right-0 top-0 flex h-10 w-10 items-center justify-center text-muted-foreground hover:text-foreground"
          title={visible ? t("Parolni yashirish") : t("Parolni ko'rsatish")}
        >
          {visible ? (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
              <path d="M17.94 17.94A10.94 10.94 0 0 1 12 20c-7 0-11-8-11-8a21.6 21.6 0 0 1 5.06-6.06M9.9 4.24A10.4 10.4 0 0 1 12 4c7 0 11 8 11 8a21.6 21.6 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
              <line x1="1" y1="1" x2="23" y2="23" />
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
              <circle cx="12" cy="12" r="3" />
            </svg>
          )}
        </button>
      </div>
      {hint && <p className="mt-1.5 text-[12px] text-muted-foreground">{hint}</p>}
    </div>
  );
}
