"use client";

import { useCallback, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { X } from "lucide-react";
import Modal, { useModalClose, type ModalController } from "@/components/ui/Modal";
import { useT } from "@/components/shared/Language";
import V2Confirm from "./V2Confirm";

// YANGI VERSIYA: FORMA OYNASI (rasmlar «Formalar — qoidalar», 19.10.2026).
//
//   • «center» — qisqa forma (~7 maydongacha): To'lov qabul qilish, Kassa amali,
//     Oylik chiqarish; orqadagi sahifa xiralashadi;
//   • «right»  — uzun forma o'ngdan: Yangi o'quvchi, Yangi lid, Xodim qo'shish —
//     chapda ro'yxat ko'rinib turadi;
//   • TELEFONDA ikkalasi ham PASTDAN chiqadi (bottom sheet), asosiy tugma pastda.
//
// Tuzilishi: sarlavha (amalni aytadi) + izoh + × ; tana (yorliq maydon tepasida,
// ochilganda birinchi maydon fokusda); pastki qator — chapda «Enter saqlash · Esc
// yopish» (yoki `footerStart`), o'ngda «Bekor qilish» + amal nomli asosiy tugma.
// Enter — saqlash (`onSubmit`; ko'p qatorli izohda va ochiq ro'yxatda emas).
// O'zgarish kiritilgan (`dirty`) forma yopilmoqchi bo'lsa — «Saqlanmagan
// o'zgarishlar bor». Qobiq — ui/Modal (portal, Esc steki, animatsiya); ichki blok
// `data-ui="v2"` (tokenlar shu yerda).

export interface V2DialogApi {
  /** Animatsiya bilan yopadi (dirty so'rovisiz — saqlangandan keyin). */
  close: () => void;
  /** «Bekor qilish» / × — dirty bo'lsa avval so'raydi. */
  requestClose: () => void;
}

export default function V2Dialog({
  variant = "center",
  title,
  subtitle,
  onClose,
  dirty = false,
  saving = false,
  onSubmit,
  width,
  footerStart,
  footer,
  children,
  zIndex = 110,
  controller,
}: {
  variant?: "center" | "right";
  title: ReactNode;
  subtitle?: ReactNode;
  onClose: () => void;
  dirty?: boolean;
  saving?: boolean;
  onSubmit?: () => void;
  /** Eng katta eni, px (sukut: center 560, right 520). */
  width?: number;
  footerStart?: ReactNode;
  footer: (api: V2DialogApi) => ReactNode;
  children: ReactNode | ((api: V2DialogApi) => ReactNode);
  zIndex?: number;
  /** Tashqi boshqaruvchi (`useModalClose(onClose, variant)`) — forma saqlangach o'zi yopishi uchun. */
  controller?: ModalController;
}) {
  const { t } = useT();
  const isRight = variant === "right";
  const own = useModalClose(onClose, isRight ? "drawer" : "center");
  const modal = controller ?? own;
  const [askClose, setAskClose] = useState(false);
  // Ochilganda BIRINCHI maydon fokusda (`data-autofocus` bo'lsa — o'sha). Tana
  // DOM'ga tushgan payt (callback ref) — Modal portalni kechroq chizsa ham
  // (gidratatsiya) ishlaydi; kadr oxirida — Modal panelga bergan fokusdan keyin.
  const focusedRef = useRef(false);
  const bodyRef = useCallback((root: HTMLDivElement | null) => {
    if (!root || focusedRef.current) return;
    focusedRef.current = true;
    requestAnimationFrame(() => {
      if (root.contains(document.activeElement)) return;
      const el =
        root.querySelector<HTMLElement>("[data-autofocus]") ??
        root.querySelector<HTMLElement>("input:not([type=checkbox]):not([type=radio]):not([disabled]), textarea:not([disabled]), button[aria-haspopup]:not([disabled])");
      el?.focus({ preventScroll: true });
    });
  }, []);

  const guard = () => {
    if (saving) return false;
    if (dirty) {
      setAskClose(true);
      return false;
    }
    return true;
  };
  const api: V2DialogApi = {
    close: modal.close,
    requestClose: () => {
      if (guard()) modal.close();
    },
  };

  function onKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    // `defaultPrevented` — Enter'ni maydonning o'zi ishlatdi (ro'yxatdan tanlash:
    // V2Picker, tavsiyali izoh); `data-enter-ignore` — Enter umuman saqlamaydigan
    // maydon (o'quvchi qidiruvi).
    if (e.key !== "Enter" || e.defaultPrevented || e.shiftKey || e.altKey || e.nativeEvent.isComposing || !onSubmit) return;
    const el = e.target as HTMLElement;
    const tag = el.tagName;
    if (tag === "TEXTAREA" || tag === "BUTTON" || tag === "A") return;
    if (el.closest("[data-enter-ignore]")) return;
    e.preventDefault();
    if (!saving) onSubmit();
  }

  const maxW = width ?? (isRight ? 520 : 560);
  return (
    <>
      <Modal
        onClose={onClose}
        controller={modal}
        bare
        variant={isRight ? "drawer" : "center"}
        size="7xl"
        zIndex={zIndex}
        locked={saving}
        beforeDismiss={guard}
        // Telefonda (640 px dan tor) — PASTDAN chiqadigan oyna.
        containerClassName={isRight ? "max-sm:items-end" : "max-sm:items-end max-sm:p-0"}
        panelStyle={{ maxWidth: maxW }}
        panelClassName={`bg-transparent! border-0! shadow-none! rounded-none! overflow-hidden ${isRight ? "max-sm:h-auto! max-sm:max-w-none!" : "max-sm:max-w-none! max-sm:max-h-[92dvh]!"}`}
      >
        <div
          data-ui="v2"
          role="document"
          onKeyDown={onKeyDown}
          className={`flex min-h-0 flex-col overflow-hidden border-v2-border bg-v2-surface font-v2 text-v2-text shadow-v2-md ${
            isRight
              ? "h-full border-l max-sm:h-auto max-sm:max-h-[92dvh] max-sm:rounded-t-v2-lg max-sm:border-t"
              : "max-h-[90vh] rounded-v2-lg border max-sm:max-h-[92dvh] max-sm:rounded-b-none"
          }`}
        >
          {/* Sarlavha */}
          <div className={`flex shrink-0 items-start justify-between gap-3 px-5 pt-4 ${isRight ? "border-b border-v2-border pb-3" : "pb-3"}`}>
            <div className="min-w-0">
              <h2 className="text-v2-section text-v2-text">{title}</h2>
              {subtitle && <p className="mt-0.5 text-v2-small text-v2-text-2">{subtitle}</p>}
            </div>
            <button
              type="button"
              onClick={api.requestClose}
              disabled={saving}
              aria-label={t("Yopish")}
              title={t("Yopish")}
              className="-mr-1.5 inline-flex size-8 shrink-0 items-center justify-center rounded-v2-md text-v2-text-2 transition-colors hover:bg-v2-surface-2 hover:text-v2-text disabled:opacity-50"
            >
              <X className="size-4" strokeWidth={1.75} />
            </button>
          </div>

          {/* Tana */}
          <div ref={bodyRef} className={`min-h-0 flex-1 overflow-y-auto px-5 pb-5 ${isRight ? "pt-4" : ""}`}>
            {typeof children === "function" ? children(api) : children}
          </div>

          {/* Pastki qator */}
          <div className="flex shrink-0 flex-col-reverse gap-2 border-t border-v2-border bg-v2-surface-2 px-5 py-3 sm:flex-row sm:items-center">
            <div className="min-w-0 sm:mr-auto">
              {footerStart ?? (
                <span className="hidden items-center gap-3 text-v2-caption font-normal text-v2-text-3 sm:inline-flex">
                  <span className="inline-flex items-center gap-1.5">
                    <kbd className="rounded-v2-sm border border-v2-border bg-v2-surface px-1.5 py-px font-sans text-[11px] text-v2-text-2">Enter</kbd>
                    {t("saqlash")}
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <kbd className="rounded-v2-sm border border-v2-border bg-v2-surface px-1.5 py-px font-sans text-[11px] text-v2-text-2">Esc</kbd>
                    {t("yopish")}
                  </span>
                </span>
              )}
            </div>
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center">{footer(api)}</div>
          </div>
        </div>
      </Modal>
      {askClose && (
        <V2Confirm
          title={t("Saqlanmagan o'zgarishlar bor")}
          body={t("Kiritilgan ma'lumotlar saqlanmaydi. Oynani yopasizmi?")}
          confirmLabel={t("Yopish")}
          cancelLabel={t("Davom etish")}
          onCancel={() => setAskClose(false)}
          onConfirm={() => {
            setAskClose(false);
            modal.close();
          }}
        />
      )}
    </>
  );
}
