"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Clock, X } from "lucide-react";
import { useT } from "@/components/shared/Language";

// VAQT MAYDONI — brauzerning <input type="time"> o'rniga, DateField kabi
// to'liq o'zimiz yasagan: "HH:MM" niqobi bilan qo'lda yozish ham, yonidagi
// soat tugmasidan (soat/daqiqa ustunlari) tanlash ham mumkin.
//
// Nega o'zimiz? Nativ vaqt inputi brauzer va tilga qarab har xil ko'rinadi
// (AM/PM, "--:--"), tungi rejimda oq popup ochadi va uni CRM'ning qolgan
// maydonlariga moslab bo'lmaydi.
//
// Qiymat "HH:MM" (24 soatlik) yoki "" — bazada va API'da shu format
// (orders/PanelTimeField.normalizeTime bilan mos).
//
// Popup <body> ga portal qilinadi — DateField izohidagi sabab (`.st-drawer`
// transform'i va modal tanasining overflow'i).

export interface TimeFieldProps {
  /** "HH:MM" yoki "". */
  value: string;
  onChange: (value: string) => void;
  label?: string;
  required?: boolean;
  placeholder?: string;
  error?: boolean;
  disabled?: boolean;
  className?: string;
  /** compact — h-9 (filtrlar/Topshiriq); form — h-10 (modal formalari);
   * panel — h-11 (Yangi buyurtma paneli). */
  variant?: "compact" | "form" | "panel";
  /** Daqiqa ustunidagi qadam (standart 5: 00, 05, …, 55). Qo'lda istalgan
   * daqiqa yozish mumkin. */
  minuteStep?: number;
}

const VARIANT_CLS: Record<NonNullable<TimeFieldProps["variant"]>, string> = {
  compact: "h-9 bg-background focus:ring-blue-500",
  form: "h-10 bg-card focus:ring-primary/40",
  panel: "h-11 bg-secondary/30 focus:ring-primary/40",
};

const p2 = (n: number) => String(n).padStart(2, "0");

/** Ixtiyoriy matnni "HH:MM" ga keltiradi; bo'lmasa "". */
export function normalizeTime(raw: string | null | undefined): string {
  const s = String(raw ?? "").trim();
  if (!s) return "";
  const m = s.match(/^(\d{1,2})\s*[:.]\s*(\d{1,2})$/) ?? s.match(/^(\d{1,2})(\d{2})$/);
  if (!m) return "";
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 23 || min > 59) return "";
  return `${p2(h)}:${p2(min)}`;
}

/** Yozilayotgan matnga "HH:MM" niqobi: faqat raqamlar, 2 tadan keyin ":" */
function mask(text: string): string {
  const d = text.replace(/\D/g, "").slice(0, 4);
  if (d.length <= 2) return d;
  return `${d.slice(0, 2)}:${d.slice(2)}`;
}

export default function TimeField({
  value,
  onChange,
  label,
  required,
  placeholder = "--:--",
  error,
  disabled,
  className = "",
  variant = "compact",
  minuteStep = 5,
}: TimeFieldProps) {
  const { t } = useT();
  const [text, setText] = useState(() => normalizeTime(value));
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const rootRef = useRef<HTMLDivElement>(null);
  const popRef = useRef<HTMLDivElement>(null);
  const hoursRef = useRef<HTMLDivElement>(null);
  const minutesRef = useRef<HTMLDivElement>(null);
  // Popup ichida tanlangan soat/daqiqa — ota komponent `value`ni qachon
  // yangilashiga bog'liq bo'lmaslik uchun (soat bosilib, daqiqa bosilguncha
  // re-render bo'lmasa ham soat yo'qolmasin).
  const draftRef = useRef<{ h: number; m: number } | null>(null);

  // Tashqaridan kelgan qiymat o'zgarsa matn moslanadi — render paytida
  // (DateField bilan bir xil naqsh).
  const [lastValue, setLastValue] = useState(value);
  if (value !== lastValue) {
    setLastValue(value);
    if (normalizeTime(text) !== normalizeTime(value)) setText(normalizeTime(value));
  }

  const reposition = useCallback(() => {
    if (!rootRef.current) return;
    const r = rootRef.current.getBoundingClientRect();
    const w = popRef.current?.offsetWidth || 168;
    const h = popRef.current?.offsetHeight || 232;
    const gap = 6;
    const edge = 8;
    const left = Math.max(edge, Math.min(r.left, window.innerWidth - w - edge));
    const below = r.bottom + gap;
    const top = below + h + edge <= window.innerHeight ? below : Math.max(edge, r.top - h - gap);
    setPos({ top, left });
  }, []);

  useEffect(() => {
    if (!open) return;
    reposition();
    // Tanlangan soat/daqiqa ko'rinib tursin.
    for (const col of [hoursRef.current, minutesRef.current]) {
      col?.querySelector<HTMLElement>('[data-selected="true"]')?.scrollIntoView({ block: "center" });
    }
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (rootRef.current?.contains(t) || popRef.current?.contains(t)) return;
      setOpen(false);
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

  const current = normalizeTime(value);
  const curH = current ? Number(current.slice(0, 2)) : -1;
  const curM = current ? Number(current.slice(3)) : -1;

  function commit(h: number, m: number) {
    draftRef.current = { h, m };
    const v = `${p2(h)}:${p2(m)}`;
    setText(v);
    if (v !== value) onChange(v);
  }

  function clear() {
    setText("");
    if (value !== "") onChange("");
    setOpen(false);
  }

  const openPopup = () => {
    if (disabled || open) return;
    draftRef.current = null;
    setOpen(true);
    reposition();
  };

  const hours = Array.from({ length: 24 }, (_, i) => i);
  const minutes = Array.from({ length: Math.ceil(60 / minuteStep) }, (_, i) => i * minuteStep);
  // Qo'lda yozilgan daqiqa qadamga tushmasa (masalan 08:47) ham ustunda
  // ko'rinsin — yo'qsa tanlangani ajratilmaydi.
  if (curM >= 0 && !minutes.includes(curM)) {
    minutes.push(curM);
    minutes.sort((a, b) => a - b);
  }

  const field = (
    <div className="relative" ref={rootRef}>
      <input
        value={text}
        disabled={disabled}
        onChange={(e) => {
          const masked = mask(e.target.value);
          setText(masked);
          const norm = masked.length === 5 ? normalizeTime(masked) : "";
          // To'liq va to'g'ri yozilgandagina qiymat beriladi; chala yozuvda
          // maydon "bo'sh" hisoblanadi.
          if (norm !== value) onChange(norm);
        }}
        onClick={openPopup}
        onKeyDown={(e) => {
          if (e.key === "Escape" && open) {
            e.stopPropagation();
            setOpen(false);
          }
          if (e.key === "Enter" && open) setOpen(false);
        }}
        inputMode="numeric"
        placeholder={placeholder}
        // Eslatma (DateField'dagi kabi): eski Tailwind dump'idagi
        // `input{padding:0}` reset'i tufayli inputda faqat o'sha dumpda
        // mavjud padding klasslari ishlaydi — pr-9 / pr-16.
        className={`w-full rounded-lg border pl-3 text-sm tabular-nums focus:outline-none focus:ring-2 disabled:opacity-60 ${
          text ? "pr-16" : "pr-9"
        } ${VARIANT_CLS[variant]} ${error ? "border-red-400 ring-2 ring-red-400" : "border-border"} ${label ? "" : className}`}
      />
      {text && !disabled && (
        <button
          type="button"
          title="Vaqtni tozalash"
          onClick={clear}
          className="absolute right-8 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
        >
          <X className="w-4 h-4" />
        </button>
      )}
      <button
        type="button"
        title="Vaqtni tanlash"
        disabled={disabled}
        onClick={() => (open ? setOpen(false) : openPopup())}
        className="absolute right-2 top-1/2 -translate-y-1/2 text-primary hover:opacity-80 disabled:opacity-40"
      >
        <Clock className="w-4 h-4" />
      </button>

      {open &&
        createPortal(
          <div
            ref={popRef}
            style={{ position: "fixed", top: pos.top, left: pos.left, zIndex: 1200 }}
            className="ui-pop-in rounded-xl border border-border bg-card shadow-xl overflow-hidden flex text-[13px] tabular-nums"
          >
            <div ref={hoursRef} className="max-h-56 overflow-y-auto py-1 border-r border-border">
              <div className="px-3 pb-1 text-[11px] uppercase tracking-wide text-muted-foreground">{t("Soat")}</div>
              {hours.map((h) => (
                <button
                  key={h}
                  type="button"
                  data-selected={h === curH}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => commit(h, draftRef.current?.m ?? (curM >= 0 ? curM : 0))}
                  className={`block w-full px-4 py-1.5 text-left hover:bg-secondary ${h === curH ? "bg-primary/10 text-primary font-medium" : ""}`}
                >
                  {p2(h)}
                </button>
              ))}
            </div>
            <div ref={minutesRef} className="max-h-56 overflow-y-auto py-1">
              <div className="px-3 pb-1 text-[11px] uppercase tracking-wide text-muted-foreground">{t("Daqiqa")}</div>
              {minutes.map((m) => (
                <button
                  key={m}
                  type="button"
                  data-selected={m === curM}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    commit(draftRef.current?.h ?? (curH >= 0 ? curH : 0), m);
                    setOpen(false);
                  }}
                  className={`block w-full px-4 py-1.5 text-left hover:bg-secondary ${m === curM ? "bg-primary/10 text-primary font-medium" : ""}`}
                >
                  {p2(m)}
                </button>
              ))}
            </div>
          </div>,
          document.body,
        )}
    </div>
  );

  if (!label) return field;
  return (
    <div className={className}>
      <label className="block text-[13px] font-medium mb-1.5">
        {label}
        {required && <span className="text-red-500"> *</span>}
      </label>
      {field}
    </div>
  );
}
