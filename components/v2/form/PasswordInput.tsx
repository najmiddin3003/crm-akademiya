"use client";

import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { useT } from "@/components/shared/Language";
import { TextInput, type FieldState } from "@/components/v2/form/fields";

// Parol maydoni «ko'rsatish / yashirish» tugmasi bilan — kirish sahifasi va Mening hisobim → Xavfsizlik (37-qism).
export default function PasswordInput({
  id,
  value,
  onChange,
  autoComplete,
  state = "default",
  placeholder,
}: {
  id: string;
  value: string;
  onChange: (v: string) => void;
  autoComplete: string;
  state?: FieldState;
  placeholder?: string;
}) {
  const { t } = useT();
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <TextInput id={id} type={show ? "text" : "password"} value={value} onChange={(e) => onChange(e.target.value)} autoComplete={autoComplete} placeholder={placeholder} state={state} className="pr-11" />
      <button
        type="button"
        onClick={() => setShow((s) => !s)}
        aria-label={show ? t("Parolni yashirish") : t("Parolni ko'rsatish")}
        title={show ? t("Parolni yashirish") : t("Parolni ko'rsatish")}
        className="absolute right-1.5 top-1/2 inline-flex size-8 -translate-y-1/2 items-center justify-center rounded-v2-md text-v2-text-2 hover:bg-v2-surface-2 hover:text-v2-text focus-visible:outline-none focus-visible:shadow-v2-focus"
      >
        {show ? <EyeOff className="size-4" strokeWidth={1.75} /> : <Eye className="size-4" strokeWidth={1.75} />}
      </button>
    </div>
  );
}

