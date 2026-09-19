"use client";

import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from "react";
import { useT } from "@/components/shared/Language";

// Umumiy toast (bildirishnoma) tizimi — komponent bir marta yozilgan, butun
// ilova bo'ylab useToast() orqali props kabi chaqiriladi (showSuccess/showError).
// app/layout.tsx'ning ENG tepasida o'ralgan — login/register sahifalarida ham
// ishlashi kerak, shuning uchun Sidebar/Navbar'ning global SVG sprite'iga
// tayanmaydi, o'z ikonkalarini o'zi e'lon qiladi.
//
// TIL: xabar KO'RSATILAYOTGANDA `t()` dan o'tadi — chaqiruvchi o'rasa ham,
// o'ramasa ham (backend `data.error` ni to'g'ridan-to'g'ri bergan joylar).
// Lug'atda yo'q matn o'z holicha qoladi (lib/i18n.ts darvozasi), shuning
// uchun allaqachon o'girilgan matn ikkinchi marta o'tsa ham buzilmaydi.

export type ToastVariant = "success" | "error";

interface ToastItem {
  id: number;
  variant: ToastVariant;
  message: string;
}

interface ToastContextValue {
  showSuccess: (message: string) => void;
  showError: (message: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const AUTO_DISMISS_MS = 3500;

export function ToastProvider({ children }: { children: ReactNode }) {
  const { t: tr } = useT();
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const idRef = useRef(0);

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const push = useCallback(
    (variant: ToastVariant, message: string) => {
      const id = ++idRef.current;
      setToasts((prev) => [...prev, { id, variant, message }]);
      setTimeout(() => dismiss(id), AUTO_DISMISS_MS);
    },
    [dismiss],
  );

  const showSuccess = useCallback((message: string) => push("success", message), [push]);
  const showError = useCallback((message: string) => push("error", message), [push]);

  // Kontekst qiymati BARQAROR bo'lishi shart. Ilgari bu yerda obyekt
  // literali turardi, ya'ni ToastProvider har render bo'lganda yangi
  // qiymat tarqalardi — va u `toasts` holati o'zgarganda render bo'ladi:
  // bir marta toast chiqqanda, yana bir marta 3.5 s dan keyin o'chganda.
  // Natijada HAR BIR toast uchun 109 ta useToast() chaqiruvchisi (ular
  // orasida sahifalarning o'zi — StudentsListPage, ParentsPage,
  // CashboxesPage) ikki marta qayta render bo'lardi. showSuccess/showError
  // allaqachon barqaror useCallback edi, ya'ni ularni ushlab turgan yagona
  // narsa shu literal edi.
  const value = useMemo(() => ({ showSuccess, showError }), [showSuccess, showError]);

  return (
    <ToastContext.Provider value={value}>
      {children}

      <svg width="0" height="0" style={{ position: "absolute" }} aria-hidden="true">
        <defs>
          <symbol id="i-toast-check" viewBox="0 0 24 24">
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
            <polyline points="22 4 12 14.01 9 11.01" />
          </symbol>
          <symbol id="i-toast-x" viewBox="0 0 24 24">
            <circle cx="12" cy="12" r="10" />
            <line x1="15" y1="9" x2="9" y2="15" />
            <line x1="9" y1="9" x2="15" y2="15" />
          </symbol>
        </defs>
      </svg>

      {/* Toastlar O'NG YUQORIDA. Navbar taxminan 56px — uning ostidan
          boshlanadi, shunda sarlavhadagi tugmalarni to'smaydi. */}
      <div
        className="fixed flex flex-col gap-2"
        style={{ top: 72, right: 20, zIndex: 400, width: 340, maxWidth: "calc(100vw - 40px)" }}
      >
        {toasts.map((t) => {
          const accent = t.variant === "success" ? "#10b981" : "#f43f5e";
          return (
            <div
              key={t.id}
              role="alert"
              onClick={() => dismiss(t.id)}
              // Fon QAT'IY berilgan: loyihadagi bg-* klasslari bu yerda
              // yarim shaffof chiqib, orqadagi jadval ko'rinib qolardi.
              style={{
                backgroundColor: "hsl(var(--card))",
                borderColor: accent,
                borderLeftWidth: 4,
                backdropFilter: "none",
              }}
              className="flex cursor-pointer items-start gap-2.5 rounded-xl border text-sm shadow-2xl px-4 py-3"
            >
              <svg className="icon icon-sm shrink-0" style={{ marginTop: 1, color: accent }}>
                <use href={t.variant === "success" ? "#i-toast-check" : "#i-toast-x"} />
              </svg>
              <span className="flex-1 text-foreground">{tr(t.message)}</span>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}
