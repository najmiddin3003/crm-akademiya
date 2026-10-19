"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
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
//
// YANGI VERSIYA (cookie `tizimli_ui=v2`, 19.10.2026, rasm «Saqlangandan keyin —
// burchakda xabar»): kompyuterda PASTKI O'NG burchakda, telefonda pastda;
// sarlavha + tafsilot qatorlari + amal havolasi («Chekni ko'rish»); muvaffaqiyat
// 5 soniyada o'zi yo'qoladi (sichqoncha ustida turganda kutadi), XATO o'zi
// yo'qolmaydi — × yoki «Qayta urinish» bilan. `showToast` — boy xabar; eski
// `showSuccess` / `showError` ikkala versiyada ham ishlaydi. Eski versiyada
// ko'rinish va vaqt o'zgarmadi.

export type ToastVariant = "success" | "error";

export interface ToastOptions {
  tone: ToastVariant;
  /** Sarlavha («To'lov qabul qilindi»). */
  title: string;
  /** Tafsilot qatorlari («Akmaljon Turg'unpo'latov», «280 000 so'm · Naqd · Rahbar kassasi»). */
  detail?: string | string[];
  /** Amal havolasi (muvaffaqiyatda) — masalan «Chekni ko'rish». */
  action?: { label: string; onClick: () => void };
  /** Xatoda «Qayta urinish». */
  retry?: () => void;
}

interface ToastItem extends ToastOptions {
  id: number;
}

interface ToastContextValue {
  showSuccess: (message: string) => void;
  showError: (message: string) => void;
  showToast: (opts: ToastOptions) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const AUTO_DISMISS_MS = 3500;
const AUTO_DISMISS_V2_MS = 5000;

// Yangi versiya tanlanganmi — cookie (lib/uiVersion.ts → UI_COOKIE). Almashtirish
// sahifani to'liq qayta yuklaydi, ya'ni kuzatish shart emas.
const noSubscribe = () => () => {};
const readV2 = () => /(?:^|;\s*)tizimli_ui=v2(?:;|$)/.test(document.cookie);

export function ToastProvider({ children }: { children: ReactNode }) {
  const { t: tr } = useT();
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const idRef = useRef(0);
  const v2 = useSyncExternalStore(noSubscribe, readV2, () => false);

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const push = useCallback(
    (opts: ToastOptions) => {
      const id = ++idRef.current;
      setToasts((prev) => [...prev, { ...opts, id }]);
      // Yangi versiyada vaqtni kartaning o'zi boshqaradi (to'xtatish, xato turadi).
      if (!v2) setTimeout(() => dismiss(id), AUTO_DISMISS_MS);
    },
    [dismiss, v2],
  );

  const showSuccess = useCallback((message: string) => push({ tone: "success", title: message }), [push]);
  const showError = useCallback((message: string) => push({ tone: "error", title: message }), [push]);
  const showToast = useCallback((opts: ToastOptions) => push(opts), [push]);

  // Kontekst qiymati BARQAROR bo'lishi shart. Ilgari bu yerda obyekt
  // literali turardi, ya'ni ToastProvider har render bo'lganda yangi
  // qiymat tarqalardi — va u `toasts` holati o'zgarganda render bo'ladi:
  // bir marta toast chiqqanda, yana bir marta 3.5 s dan keyin o'chganda.
  // Natijada HAR BIR toast uchun 109 ta useToast() chaqiruvchisi (ular
  // orasida sahifalarning o'zi — StudentsListPage, ParentsPage,
  // CashboxesPage) ikki marta qayta render bo'lardi. showSuccess/showError
  // allaqachon barqaror useCallback edi, ya'ni ularni ushlab turgan yagona
  // narsa shu literal edi.
  const value = useMemo(() => ({ showSuccess, showError, showToast }), [showSuccess, showError, showToast]);

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

      {v2 ? (
        <div
          data-ui="v2"
          aria-live="polite"
          className="pointer-events-none fixed bottom-5 right-5 z-[1400] flex w-[360px] flex-col gap-2 font-v2 max-sm:bottom-20 max-sm:left-3 max-sm:right-3 max-sm:w-auto"
        >
          {toasts.map((item) => (
            <ToastCardV2 key={item.id} item={item} onDismiss={() => dismiss(item.id)} tr={tr} />
          ))}
        </div>
      ) : (
        /* Toastlar O'NG YUQORIDA. Navbar taxminan 56px — uning ostidan
           boshlanadi, shunda sarlavhadagi tugmalarni to'smaydi. */
        <div
          className="fixed flex flex-col gap-2"
          style={{ top: 72, right: 20, zIndex: 400, width: 340, maxWidth: "calc(100vw - 40px)" }}
        >
          {toasts.map((t) => {
            const accent = t.tone === "success" ? "#10b981" : "#f43f5e";
            const detail = Array.isArray(t.detail) ? t.detail.join(" · ") : t.detail;
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
                  <use href={t.tone === "success" ? "#i-toast-check" : "#i-toast-x"} />
                </svg>
                <span className="flex-1 text-foreground">
                  {tr(t.title)}
                  {detail ? ` — ${tr(detail)}` : ""}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </ToastContext.Provider>
  );
}

/** Yangi versiya kartasi: o'zi yopiladi (5 s, sichqoncha ustida kutadi); xato turadi. */
function ToastCardV2({ item, onDismiss, tr }: { item: ToastItem; onDismiss: () => void; tr: (s: string) => string }) {
  const ok = item.tone === "success";
  const [paused, setPaused] = useState(false);
  const remaining = useRef(AUTO_DISMISS_V2_MS);
  const startedAt = useRef(0);

  useEffect(() => {
    if (!ok || paused) return;
    startedAt.current = Date.now();
    const id = window.setTimeout(onDismiss, remaining.current);
    return () => {
      window.clearTimeout(id);
      remaining.current = Math.max(800, remaining.current - (Date.now() - startedAt.current));
    };
  }, [ok, paused, onDismiss]);

  const lines = item.detail === undefined ? [] : Array.isArray(item.detail) ? item.detail : [item.detail];
  return (
    <div
      role={ok ? "status" : "alert"}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      className="ui-pop-in pointer-events-auto flex items-start gap-3 rounded-v2-lg border border-v2-border bg-v2-surface py-3 pl-3 pr-2 text-v2-text shadow-v2-md"
    >
      <span className={`flex size-8 shrink-0 items-center justify-center rounded-v2-full ${ok ? "bg-v2-success-bg text-v2-success" : "bg-v2-danger-bg text-v2-danger"}`} aria-hidden>
        {ok ? (
          <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        ) : (
          <span className="text-[15px] font-bold leading-none">!</span>
        )}
      </span>
      <div className="min-w-0 flex-1 pt-0.5">
        <div className="text-v2-small font-semibold text-v2-text">{tr(item.title)}</div>
        {lines.map((l, i) => (
          <div key={i} className="mt-0.5 text-v2-caption font-normal text-v2-text-2">
            {tr(l)}
          </div>
        ))}
        {(item.action || item.retry) && (
          <div className="mt-1.5 flex flex-wrap items-center gap-3">
            {item.action && (
              <button
                type="button"
                onClick={() => {
                  item.action!.onClick();
                  onDismiss();
                }}
                className="text-v2-small font-semibold text-v2-brand-text hover:underline"
              >
                {tr(item.action.label)}
              </button>
            )}
            {item.retry && (
              <button
                type="button"
                onClick={() => {
                  onDismiss();
                  item.retry!();
                }}
                className="inline-flex h-8 items-center rounded-v2-md border border-v2-border-strong bg-v2-surface px-3 text-v2-small font-medium text-v2-text hover:bg-v2-surface-2"
              >
                {tr("Qayta urinish")}
              </button>
            )}
          </div>
        )}
      </div>
      <button
        type="button"
        onClick={onDismiss}
        aria-label={tr("Yopish")}
        className="inline-flex size-7 shrink-0 items-center justify-center rounded-v2-md text-v2-text-3 transition-colors hover:bg-v2-surface-2 hover:text-v2-text"
      >
        <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
          <line x1="18" y1="6" x2="6" y2="18" />
          <line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      </button>
    </div>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}
