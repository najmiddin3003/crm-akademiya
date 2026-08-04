"use client";

import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from "react";

// Umumiy toast (bildirishnoma) tizimi — komponent bir marta yozilgan, butun
// ilova bo'ylab useToast() orqali props kabi chaqiriladi (showSuccess/showError).
// app/layout.tsx'ning ENG tepasida o'ralgan — login/register sahifalarida ham
// ishlashi kerak, shuning uchun Sidebar/Navbar'ning global SVG sprite'iga
// tayanmaydi, o'z ikonkalarini o'zi e'lon qiladi.

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

  return (
    <ToastContext.Provider value={{ showSuccess, showError }}>
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

      <div
        className="fixed flex flex-col gap-2"
        style={{ bottom: 20, right: 20, zIndex: 400, width: 340, maxWidth: "calc(100vw - 40px)" }}
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            role="alert"
            onClick={() => dismiss(t.id)}
            className={`flex items-start gap-2.5 rounded-xl border px-4 py-3 text-sm shadow-xl cursor-pointer ${
              t.variant === "success"
                ? "bg-emerald-50 border-emerald-300 text-emerald-700"
                : "bg-rose-50 border-rose-300 text-rose-700"
            }`}
          >
            <svg className="icon icon-sm shrink-0" style={{ marginTop: 1 }}>
              <use href={t.variant === "success" ? "#i-toast-check" : "#i-toast-x"} />
            </svg>
            <span className="flex-1">{t.message}</span>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}
