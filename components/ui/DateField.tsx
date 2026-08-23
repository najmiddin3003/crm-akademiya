"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Calendar, X } from "lucide-react";
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
  /** "compact" (default) — Topshiriq oynasidagi h-9 o'lcham. "panel" —
   * Yangi buyurtma panelidagi qolgan maydonlar bilan bir xil h-11 o'lcham. */
  variant?: "compact" | "panel";
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
  variant = "compact",
}: DateFieldProps) {
  const [text, setText] = useState(() => isoToText(value));
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const rootRef = useRef<HTMLDivElement>(null);
  const popRef = useRef<HTMLDivElement>(null);

  // Tashqaridan kelgan qiymat o'zgarsa (masalan forma tozalanganda) — matnni
  // moslaymiz. Effekt emas, render paytida to'g'rilash: React tavsiya qilgan
  // "prop o'zgarganda state'ni yangilash" naqshi.
  const [lastValue, setLastValue] = useState(value);
  if (value !== lastValue) {
    setLastValue(value);
    if (textToIso(text) !== value) setText(isoToText(value));
  }

  // Kalendarning taxminiy o'lchami — birinchi ochilishda u hali chizilmagan
  // bo'ladi, shu bois joyni shu raqamlar bo'yicha mo'ljallaymiz; chizilgach
  // quyidagi effekt haqiqiy o'lcham bilan qayta hisoblaydi.
  const reposition = useCallback(() => {
    if (!rootRef.current) return;
    const r = rootRef.current.getBoundingClientRect();
    const w = popRef.current?.offsetWidth || 302;
    const h = popRef.current?.offsetHeight || 334;
    const gap = 6;
    const edge = 8; // ekran chetidan qoldiriladigan bo'shliq
    // Gorizontal: maydonning chap cheti bo'yicha, o'ngdan chiqsa — suriladi.
    const left = Math.max(edge, Math.min(r.left, window.innerWidth - w - edge));
    // Vertikal: odatda maydon TAGIDA. Pastda joy yetmasa (masalan maydon
    // panelning quyi qismida bo'lsa) — maydon USTIGA chiqariladi.
    const below = r.bottom + gap;
    const top = below + h + edge <= window.innerHeight ? below : Math.max(edge, r.top - h - gap);
    setPos({ top, left });
  }, []);

  useEffect(() => {
    if (!open) return;
    // Endi kalendar DOM'da bor — haqiqiy o'lchami bo'yicha aniq joylashamiz.
    reposition();
    const onDown = (e: MouseEvent) => {
      // Kalendar portal orqali <body> ichida turadi, ya'ni maydonning DOM
      // farzandi emas — uni ham "ichkarida" deb hisoblaymiz, aks holda kun
      // bosilishi bilan panel yopilib, tanlov yo'qoladi.
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

  const selected = toDate(value);

  // "Tozalash" tugmasi faqat maydonda sana turganda ko'rinadi — bo'sh
  // maydonda tozalaydigan narsa yo'q.
  const clearable = text !== "";

  // Kalendar faqat yonidagi tugmadan emas, maydonning istalgan yeriga
  // bosilganda ham ochiladi. Ochiq turganda qayta bosish uni yopmaydi —
  // aks holda kursorni joyiga qo'yish uchun bosish kalendarni yo'qotardi.
  const openCalendar = () => {
    if (open) return;
    setOpen(true);
    reposition();
  };

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
        onClick={openCalendar}
        inputMode="numeric"
        placeholder={placeholder}
        // Eslatma: globals.css ichida eski Tailwind v3 dump'i bor va uning
        // "input{padding:0}" reset'i @layer'dan TASHQARIDA — shu bois
        // Tailwind v4 yangi generatsiya qiladigan padding klasslari (pr-14
        // kabi) inputda ishlamaydi. Faqat o'sha dumpda mavjud bo'lgan
        // pr-9 / pr-16 ishlatiladi.
        className={`w-full rounded-lg border pl-3 text-sm tabular-nums focus:outline-none focus:ring-2 ${
          clearable ? "pr-16" : "pr-9"
        } ${
          variant === "panel" ? "h-11 bg-secondary/30 focus:ring-primary/40" : "h-9 bg-background focus:ring-blue-500"
        } ${error ? "border-red-400 ring-2 ring-red-400" : "border-border"}`}
      />
      {clearable && (
        <button
          type="button"
          title="Sanani tozalash"
          onClick={() => {
            setText("");
            if (value !== "") onChange("");
            setOpen(false);
          }}
          className="absolute right-8 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
        >
          <X className="w-4 h-4" />
        </button>
      )}
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

      {/* Kalendar <body>ga portal qilinadi. Sababi: "position: fixed"
          o'zidan yuqorida "transform" qo'llangan element bo'lsa, ekranga
          emas, o'sha elementga nisbatan joylashadi (CSS containing block
          qoidasi). Yangi buyurtma paneli — .st-drawer — aynan shunday
          (transform: translateX(0)), shu bois portalsiz kalendar ekrandan
          tashqarida chizilardi. zIndex drawer'dan (1001) balandroq. */}
      {open &&
        createPortal(
          <div
            ref={popRef}
            style={{ position: "fixed", top: pos.top, left: pos.left, zIndex: 1200 }}
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
          </div>,
          document.body,
        )}
    </div>
  );
}
