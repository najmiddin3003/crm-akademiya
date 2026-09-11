"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

// MODAL / DRAWER O'RAMI — kirish va CHIQISH animatsiyasi bilan.
//
// Ilgari 55 ta modalning har biri o'z overlay'ini chizar va bir zumda paydo
// bo'lib, bir zumda yo'qolardi. Bu yerda bitta qobiq: overlay (xira fon),
// panel (o'rtada yoki o'ngdan chiqadigan drawer), sarlavha, tana, footer.
//
// CHIQISH ANIMATSIYASI qanday ishlaydi: ota komponent modalni odatdagidek
// `{open && <Modal onClose=…>}` bilan chizadi. `close()` chaqirilganda
// panel darhol o'chirilmaydi — `closing` holatiga o'tib chiqish
// animatsiyasini o'ynaydi, EXIT_MS dan keyin `onClose` chaqiriladi va ota
// uni unmount qiladi. Ichkaridagi tugmalar `onClose` propini EMAS,
// `useModal().close` ni chaqirishi kerak — aks holda animatsiyasiz yopiladi.
//
// Esc, overlay va X — `dismiss()` orqali: `locked` (saqlash ketayotganda)
// bo'lsa e'tiborsiz — yarim yozilgan forma tasodifan yopilmasin. Dasturiy
// `close()` esa doim ishlaydi.
//
// Portal <body> ga: modal transform qo'llangan ota ichida qolib ketmasin
// (DateField izohidagi `.st-drawer` holati) va z-index tartibi bitta bo'lsin.

interface ModalContextValue {
  /** Animatsiya bilan yopadi. Ota `onClose` ni shu chaqiradi. */
  close: () => void;
}
const ModalContext = createContext<ModalContextValue | null>(null);

export function useModal(): ModalContextValue {
  const v = useContext(ModalContext);
  if (!v) throw new Error("useModal() faqat <Modal> ichida ishlaydi");
  return v;
}

const EXIT_MS: Record<NonNullable<ModalProps["variant"]>, number> = { center: 150, drawer: 180 };

const SIZE_CLS: Record<NonNullable<ModalProps["size"]>, string> = {
  sm: "max-w-sm",
  md: "max-w-md",
  lg: "max-w-lg",
  xl: "max-w-2xl",
  "2xl": "max-w-4xl",
};

export interface ModalProps {
  onClose: () => void;
  title?: ReactNode;
  /** Sarlavha ostidagi kichik matn (masalan "* Zarurligini bildiradi"). */
  subtitle?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  /** Panel kengligi (faqat "center"). Drawer doim max-w-md. */
  size?: "sm" | "md" | "lg" | "xl" | "2xl";
  variant?: "center" | "drawer";
  /** Tana klasslari; standart — formalar uchun `p-5 space-y-3.5`. */
  bodyClassName?: string;
  hideClose?: boolean;
  /** Esc va overlay bilan yopilmasin (masalan saqlash ketayotganda). */
  locked?: boolean;
}

// SSR'da portal chizib bo'lmaydi; gidratatsiya tugaguncha ham hech narsa
// chizilmaydi (server HTML'ida yo'q edi — nomuvofiqlik bo'lmasin).
const subscribeNoop = () => () => {};
const useMounted = () => useSyncExternalStore(subscribeNoop, () => true, () => false);

export default function Modal({
  onClose,
  title,
  subtitle,
  children,
  footer,
  size = "md",
  variant = "center",
  bodyClassName = "p-5 space-y-3.5",
  hideClose = false,
  locked = false,
}: ModalProps) {
  const mounted = useMounted();
  const [closing, setClosing] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<number | null>(null);
  // Eng so'nggi `onClose` — taymer eskirgan yopilish funksiyasini chaqirmasin.
  // (Ref render paytida emas, effektda yangilanadi — react-hooks/refs qoidasi.)
  const onCloseRef = useRef(onClose);
  useEffect(() => { onCloseRef.current = onClose; }, [onClose]);

  // Dasturiy yopish — DOIM ishlaydi (saqlash muvaffaqiyatli tugaganda ham
  // `locked` hali true bo'lishi mumkin: setState va close() bir tikda).
  const close = useCallback(() => {
    if (timerRef.current !== null) return;
    setClosing(true);
    const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    timerRef.current = window.setTimeout(() => onCloseRef.current(), reduced ? 0 : EXIT_MS[variant]);
  }, [variant]);

  // Foydalanuvchi yopishi (Esc, overlay) — `locked` bo'lsa e'tiborsiz.
  const dismiss = useCallback(() => {
    if (locked) return;
    close();
  }, [locked, close]);

  useEffect(() => () => { if (timerRef.current !== null) window.clearTimeout(timerRef.current); }, []);

  // Esc — yopish. Ichkaridagi Select/DateField Esc'ni o'zi ushlab
  // (stopPropagation) avval o'z ro'yxatini yopadi, bu yerga yetib kelmaydi.
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") dismiss();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [dismiss]);

  // Fokus panelga; yopilganda avvalgi elementga qaytadi (klaviatura
  // foydalanuvchisi qayerda edi — o'sha yerda qoladi).
  useEffect(() => {
    if (!mounted) return;
    const prev = document.activeElement as HTMLElement | null;
    // Ichkaridagi maydon `autoFocus` bilan allaqachon fokus olgan bo'lsa
    // (Yangi guruh > Guruh nomi) uni tortib olmaymiz.
    if (!panelRef.current?.contains(document.activeElement)) panelRef.current?.focus({ preventScroll: true });
    return () => prev?.focus?.({ preventScroll: true });
  }, [mounted]);

  if (!mounted) return null;

  const isDrawer = variant === "drawer";
  const panelCls = isDrawer
    ? `relative h-full w-full max-w-md bg-card border-l border-border shadow-2xl flex flex-col outline-none ${closing ? "ui-drawer-out" : "ui-drawer-in"}`
    : `relative w-full ${SIZE_CLS[size]} rounded-2xl bg-card border border-border shadow-2xl max-h-[90vh] overflow-hidden flex flex-col outline-none ${closing ? "ui-modal-out" : "ui-modal-in"}`;

  const node = (
    <ModalContext.Provider value={{ close }}>
      <div className={`fixed inset-0 z-[100] flex ${isDrawer ? "justify-end" : "items-center justify-center p-4"}`}>
        <div
          className={`absolute inset-0 bg-black/40 backdrop-blur-sm ${closing ? "ui-overlay-out" : "ui-overlay-in"}`}
          onMouseDown={dismiss}
        />
        <div ref={panelRef} tabIndex={-1} role="dialog" aria-modal="true" className={panelCls}>
          {(title || !hideClose) && (
            <div className="flex items-center justify-between p-4 border-b border-border flex-shrink-0">
              <div className="min-w-0">
                {title && <h3 className="text-base font-semibold truncate">{title}</h3>}
                {subtitle && <p className="text-[11px] text-muted-foreground mt-0.5">{subtitle}</p>}
              </div>
              {!hideClose && (
                <button
                  type="button"
                  onClick={dismiss}
                  className="h-8 w-8 shrink-0 rounded-full hover:bg-secondary flex items-center justify-center text-muted-foreground transition-colors"
                  title="Yopish"
                >
                  <X className="icon icon-sm" />
                </button>
              )}
            </div>
          )}
          <div className={`overflow-y-auto flex-1 ${bodyClassName}`}>{children}</div>
          {footer && <div className="flex items-center justify-end gap-2 p-4 border-t border-border flex-shrink-0">{footer}</div>}
        </div>
      </div>
    </ModalContext.Provider>
  );

  return createPortal(node, document.body);
}
