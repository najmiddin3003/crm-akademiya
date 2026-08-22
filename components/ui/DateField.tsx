"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Calendar } from "lucide-react";
import CalendarPanel, { startOfDay } from "@/components/ui/CalendarPanel";

// Forma ichidagi sana maydoni — brauzerning o'z <input type="date"> emas,
// to'liq o'zimiz yasagan: "DD/MM/YYYY" niqobi bilan qo'lda yozish ham,
// yonidagi kalendar tugmasidan tanlash ham mumkin (referens: akademiya.
// edutizim.uz dagi Topshiriq oynasi).
//
// Nega o'zimiz? Nativ input brauzer tiliga qarab formatini o'zgartiradi
// (masalan "дд.мм.гггг") va uni CRM'ning qolgan qismiga moslab bo'lmaydi.
//
// Qiymat ISO ("YYYY-MM-DD") ko'rinishida beriladi/qaytariladi — bazada va
// boshqa maydonlarda shu format ishlatiladi. Bo'sh bo'lsa "".

export interface DateFieldProps {
  /** "YYYY-MM-DD" yoki "". */
  value: string;
  onChange: (iso: string) => void;
  placeholder?: string;
  error?: boolean;
  className?: string;
}

function isoToText(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || "");
  return m ? `${m[3]}/${m[2]}/${m[1]}` : "";
}

/** "25/12/2026" → "2026-12-25"; noto'g'ri/chala bo'lsa "". */
function textToIso(text: string): string {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(text.trim());
  if (!m) return "";
  const day = Number(m[1]);
  const month = Number(m[2]);
  const year = Number(m[3]);
  if (month < 1 || month > 12 || day < 1) return "";
  const d = new Date(year, month - 1, day);
  // Oyda bunday kun bormi (31.02 kabi qiymatlarni rad etamiz).
  if (d.getFullYear() !== year || d.getMonth() !== month - 1 || d.getDate() !== day) return "";
  return `${m[3]}-${m[2]}-${m[1]}`;
}

/** Yozilayotgan raqamlarni "DD/MM/YYYY" ko'rinishiga soladi. */
function maskDigits(raw: string): string {
  const d = raw.replace(/\D/g, "").slice(0, 8);
  const parts = [d.slice(0, 2), d.slice(2, 4), d.slice(4, 8)].filter(Boolean);
  return parts.join("/");
}

function toDate(iso: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || "");
  return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : null;
}

export default function DateField({
  value,
  onChange,
  placeholder = "DD/MM/YYYY",
  error,
  className = "",
}: DateFieldProps) {
  const [text, setText] = useState(() => isoToText(value));
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const rootRef = useRef<HTMLDivElement>(null);

  // Tashqaridan kelgan qiymat o'zgarsa (masalan forma tozalanganda) — matnni
  // moslaymiz. Effekt emas, render paytida to'g'rilash: React tavsiya qilgan
  // "prop o'zgarganda state'ni yangilash" naqshi.
  const [lastValue, setLastValue] = useState(value);
  if (value !== lastValue) {
    setLastValue(value);
    if (textToIso(text) !== value) setText(isoToText(value));
  }

  const reposition = useCallback(() => {
    if (!rootRef.current) return;
    const r = rootRef.current.getBoundingClientRect();
    // Kalendar taxminan 280px — ekrandan chiqib ketmasin.
    const left = Math.min(r.left, Math.max(8, window.innerWidth - 296));
    setPos({ top: r.bottom + 6, left });
  }, []);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    window.addEventListener("scroll", reposition, true);
    window.addEventListener("resize", reposition);
    return () => {
      document.removeEventListener("mousedown", onDown);
      window.removeEventListener("scroll", reposition, true);
      window.removeEventListener("resize", reposition);
    };
  }, [open, reposition]);

  const selected = toDate(value);

  return (
    <div className={`relative ${className}`} ref={rootRef}>
      <input
        value={text}
        onChange={(e) => {
          const masked = maskDigits(e.target.value);
          setText(masked);
          const iso = textToIso(masked);
          // To'liq va to'g'ri yozilgandagina qiymat beriladi; chala yozuvda
          // maydon "bo'sh" hisoblanadi (saqlashda tekshiruvga tushadi).
          if (iso !== value) onChange(iso);
        }}
        inputMode="numeric"
        placeholder={placeholder}
        className={`h-9 w-full rounded-lg border bg-background pl-3 pr-9 text-sm tabular-nums focus:outline-none focus:ring-2 focus:ring-blue-500 ${
          error ? "border-red-400 ring-2 ring-red-400" : "border-border"
        }`}
      />
      <button
        type="button"
        title="Kalendardan tanlash"
        onClick={() => {
          const next = !open;
          setOpen(next);
          if (next) reposition();
        }}
        className="absolute right-2 top-1/2 -translate-y-1/2 text-primary hover:opacity-80"
      >
        <Calendar className="w-4 h-4" />
      </button>

      {open && (
        <div
          style={{ position: "fixed", top: pos.top, left: pos.left, zIndex: 300 }}
          className="rounded-xl border border-border bg-card shadow-xl overflow-hidden p-3"
        >
          <CalendarPanel
            value={selected}
            initialView={selected ?? startOfDay(new Date())}
            onPick={(d) => {
              const p = (n: number) => String(n).padStart(2, "0");
              const iso = `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
              setText(isoToText(iso));
              onChange(iso);
              setOpen(false);
            }}
          />
        </div>
      )}
    </div>
  );
}
