"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type CSSProperties,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

// MODAL / DRAWER O'RAMI — kirish va CHIQISH animatsiyasi bilan.
//
// Ilgari 55 ta modalning har biri o'z overlay'ini chizar va bir zumda paydo
// bo'lib, bir zumda yo'qolardi. Bu yerda bitta qobiq: overlay (xira fon),
// panel (o'rtada yoki o'ngdan chiqadigan drawer), ixtiyoriy sarlavha,
// tana, footer.
//
// CHIQISH ANIMATSIYASI qanday ishlaydi: ota komponent modalni odatdagidek
// `{open && <XModal onClose=…>}` bilan chizadi. `close()` chaqirilganda
// panel darhol o'chirilmaydi — `closing` holatiga o'tib chiqish
// animatsiyasini o'ynaydi, EXIT_MS dan keyin `onClose` chaqiriladi va ota
// uni unmount qiladi.
//
// IKKI USUL:
//   1. `useModalClose(onClose)` — modal KOMPONENTINING tanasida:
//        const modal = useModalClose(onClose);
//        … save() { …; modal.close(); }
//        return <Modal controller={modal} …>…<button onClick={modal.close}>
//      `close` komponent tanasida bo'lgani uchun saqlash funksiyasi ham,
//      tugmalar ham bitta narsani chaqiradi. Loyihadagi modallar shu usulda.
//   2. `useModal().close` — Modal FARZANDI bo'lgan komponent ichida
//      (controller berilmasa Modal o'zi boshqaradi).
//
// Esc, overlay va X — `dismiss()` orqali: `locked` (saqlash ketayotganda)
// bo'lsa e'tiborsiz — yarim yozilgan forma tasodifan yopilmasin. Dasturiy
// `close()` esa doim ishlaydi.
//
// `bare` — sarlavha/tana/footer o'ramlarisiz: farzandlar to'g'ridan-to'g'ri
// panelning (flex-col) ichida. Eski modallar o'z sarlavha va footer
// markup'ini saqlagan holda faqat qobiqni almashtirishi uchun.
//
// Portal <body> ga: modal transform qo'llangan ota ichida qolib ketmasin
// (DateField izohidagi `.st-drawer` holati) va z-index tartibi bitta bo'lsin.

export interface ModalController {
  /** Chiqish animatsiyasi ketyapti (panel `ui-modal-out` oladi). */
  closing: boolean;
  /** Animatsiya bilan yopadi; oxirida `onClose` chaqiriladi. */
  close: () => void;
}

const ModalContext = createContext<ModalController | null>(null);

export function useModal(): ModalController {
  const v = useContext(ModalContext);
  if (!v) throw new Error("useModal() faqat <Modal> ichida ishlaydi");
  return v;
}

const EXIT_MS: Record<NonNullable<ModalProps["variant"]>, number> = { center: 150, drawer: 180 };

/**
 * Modal yopilishini boshqaruvchi holat. Modal komponentining tanasida
 * chaqiriladi va `<Modal controller={…}>` ga beriladi.
 */
export function useModalClose(onClose: () => void, variant: "center" | "drawer" = "center"): ModalController {
  const [closing, setClosing] = useState(false);
  const timerRef = useRef<number | null>(null);
  // Eng so'nggi `onClose` — taymer eskirgan yopilish funksiyasini chaqirmasin.
  // (Ref render paytida emas, effektda yangilanadi — react-hooks/refs qoidasi.)
  const onCloseRef = useRef(onClose);
  useEffect(() => { onCloseRef.current = onClose; }, [onClose]);

  // Animatsiya tugagach `onClose` chaqiriladi va holat O'ZI TIKLANADI —
  // hook sahifa komponentida (inline modal) tursa, keyingi ochilishda modal
  // `closing` holatida qolib ko'rinmay qolmasin. Ota modalni unmount qilsa
  // (odatiy holat) tiklash bekor ketadi, xolos.
  const close = useCallback(() => {
    if (timerRef.current !== null) return;
    setClosing(true);
    const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    timerRef.current = window.setTimeout(() => {
      timerRef.current = null;
      onCloseRef.current();
      setClosing(false);
    }, reduced ? 0 : EXIT_MS[variant]);
  }, [variant]);

  useEffect(() => () => { if (timerRef.current !== null) window.clearTimeout(timerRef.current); }, []);

  return { closing, close };
}

const SIZE_CLS: Record<NonNullable<ModalProps["size"]>, string> = {
  xs: "max-w-xs",
  sm: "max-w-sm",
  md: "max-w-md",
  lg: "max-w-lg",
  xl: "max-w-xl",
  "2xl": "max-w-2xl",
  "3xl": "max-w-3xl",
  "4xl": "max-w-4xl",
  "5xl": "max-w-5xl",
  "6xl": "max-w-6xl",
  "7xl": "max-w-7xl",
};

export interface ModalProps {
  onClose: () => void;
  /** `useModalClose(onClose)` natijasi — berilmasa Modal o'zi boshqaradi. */
  controller?: ModalController;
  title?: ReactNode;
  /** Sarlavha ostidagi kichik matn (masalan "* Zarurligini bildiradi"). */
  subtitle?: ReactNode;
  /** Oddiy JSX yoki funksiya — sahifa ichidagi inline modallar uchun:
   * `{(modal) => <button onClick={modal.close}>…}` (hook chaqirib bo'lmaydigan joyda). */
  children: ReactNode | ((modal: ModalController) => ReactNode);
  footer?: ReactNode;
  /** Panel kengligi (max-w-*). Drawer'da ham ishlaydi (standart md). */
  size?: "xs" | "sm" | "md" | "lg" | "xl" | "2xl" | "3xl" | "4xl" | "5xl" | "6xl" | "7xl";
  variant?: "center" | "drawer";
  /** Tana klasslari; standart — formalar uchun `p-5 space-y-3.5`. */
  bodyClassName?: string;
  /** Panelga qo'shimcha klasslar (masalan drawer kengligi `max-w-lg`). */
  panelClassName?: string;
  /** Panelga inline uslub (masalan `{ width: "92%", maxWidth: 360 }`). */
  panelStyle?: CSSProperties;
  hideClose?: boolean;
  /** Esc va overlay bilan yopilmasin (masalan saqlash ketayotganda). */
  locked?: boolean;
  /** Sarlavha/tana/footer o'ramlarisiz — farzandlar panelning o'zida. */
  bare?: boolean;
  /** Overlay bosilganda yopilmasin (faqat Esc/X/tugmalar). */
  disableOverlayClose?: boolean;
  /** Konteyner z-index'i (standart 100). Boshqa modal ustida ochiladigan
   * drawer/oynalar uchun (masalan kassa oynasi ustidagi tasdiq). */
  zIndex?: number;
}

// SSR'da portal chizib bo'lmaydi; gidratatsiya tugaguncha ham hech narsa
// chizilmaydi (server HTML'ida yo'q edi — nomuvofiqlik bo'lmasin).
const subscribeNoop = () => () => {};
const useMounted = () => useSyncExternalStore(subscribeNoop, () => true, () => false);

// OCHIQ MODALLAR STEKI. Esc faqat ENG USTKI modalni yopadi: ichma-ich
// oynalarda (Yangi o'quvchi → "Manbani yozing") ikkala oyna ham `window`
// ni tinglaydi va bitta Esc ikkalasini birdan yopib yuborardi — moderator
// manbani yozayotib butun formani yo'qotardi.
const openStack: symbol[] = [];

export default function Modal({
  onClose,
  controller,
  title,
  subtitle,
  children,
  footer,
  size = "md",
  variant = "center",
  bodyClassName = "p-5 space-y-3.5",
  panelClassName = "",
  panelStyle,
  hideClose = false,
  locked = false,
  bare = false,
  disableOverlayClose = false,
  zIndex,
}: ModalProps) {
  const mounted = useMounted();
  const own = useModalClose(onClose, variant);
  const { closing, close } = controller ?? own;
  const panelRef = useRef<HTMLDivElement>(null);
  const idRef = useRef<symbol | null>(null);
  if (idRef.current === null) idRef.current = Symbol("modal");

  useEffect(() => {
    const id = idRef.current!;
    openStack.push(id);
    return () => { const i = openStack.indexOf(id); if (i >= 0) openStack.splice(i, 1); };
  }, []);

  // Foydalanuvchi yopishi (Esc, overlay, X) — `locked` bo'lsa e'tiborsiz.
  const dismiss = useCallback(() => {
    if (locked) return;
    close();
  }, [locked, close]);

  // Esc — yopish. Ichkaridagi Select/DateField Esc'ni o'zi ushlab
  // (stopPropagation) avval o'z ro'yxatini yopadi, bu yerga yetib kelmaydi.
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && openStack[openStack.length - 1] === idRef.current) dismiss();
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
  // Eski modal o'z panelida overflow boshqarsa (`overflow-y-auto`), bizning
  // `overflow-hidden` u bilan to'qnashmasin.
  const overflowCls = /overflow-/.test(panelClassName) ? "" : "overflow-hidden";
  const panelCls = isDrawer
    ? `relative h-full w-full ${SIZE_CLS[size]} bg-card border-l border-border shadow-2xl flex flex-col outline-none ${overflowCls} ${closing ? "ui-drawer-out" : "ui-drawer-in"} ${panelClassName}`
    : `relative w-full ${SIZE_CLS[size]} rounded-2xl bg-card border border-border shadow-2xl max-h-[90vh] flex flex-col outline-none ${overflowCls} ${closing ? "ui-modal-out" : "ui-modal-in"} ${panelClassName}`;
  const content = typeof children === "function" ? children({ closing, close }) : children;

  const node = (
    <ModalContext.Provider value={{ closing, close }}>
      <div className={`fixed inset-0 z-[100] flex ${isDrawer ? "justify-end" : "items-center justify-center p-4"}`} style={zIndex !== undefined ? { zIndex } : undefined}>
        <div
          className={`absolute inset-0 bg-black/40 backdrop-blur-sm ${closing ? "ui-overlay-out" : "ui-overlay-in"}`}
          onMouseDown={disableOverlayClose ? undefined : dismiss}
        />
        <div ref={panelRef} tabIndex={-1} role="dialog" aria-modal="true" className={panelCls} style={panelStyle}>
          {bare ? (
            content
          ) : (
            <>
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
              <div className={`overflow-y-auto flex-1 ${bodyClassName}`}>{content}</div>
              {footer && <div className="flex items-center justify-end gap-2 p-4 border-t border-border flex-shrink-0">{footer}</div>}
            </>
          )}
        </div>
      </div>
    </ModalContext.Provider>
  );

  return createPortal(node, document.body);
}
