"use client";

import type { ComponentType, ReactNode } from "react";
import { AlertTriangle } from "lucide-react";
import Modal, { useModalClose } from "@/components/ui/Modal";
import { useT } from "@/components/shared/Language";
import { secondaryBtn } from "@/components/v2/ui/buttons";

// YANGI VERSIYA: TASDIQ OYNASI (rasm «Xavfli amal tasdig'i», 19.10.2026).
// Faqat qaytarib bo'lmaydigan yoki pulga ta'sir qiladigan amallarda so'raladi;
// tugma nomi AMALNI aytadi («Arxivlash», «Yopish»), «Ha / Yo'q» emas.
// Chapda och fonli kvadratda ikonka, sarlavha (qalin) + izoh (`text-2`), pastki
// qator chegarali: «Bekor qilish» va amal tugmasi (xavfli — `danger`).

type IconType = ComponentType<{ className?: string; strokeWidth?: number }>;

export default function V2Confirm({
  title,
  body,
  confirmLabel,
  cancelLabel,
  tone = "danger",
  icon: Icon = AlertTriangle,
  onConfirm,
  onCancel,
  zIndex = 1300,
}: {
  title: string;
  body?: ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
  tone?: "danger" | "brand";
  icon?: IconType;
  onConfirm: () => void;
  onCancel: () => void;
  zIndex?: number;
}) {
  const { t } = useT();
  const modal = useModalClose(onCancel);
  const danger = tone === "danger";
  return (
    <Modal
      onClose={onCancel}
      controller={modal}
      bare
      size="md"
      zIndex={zIndex}
      panelClassName="bg-transparent! border-0! shadow-none! rounded-none! overflow-hidden max-w-[420px]!"
    >
      <div data-ui="v2" role="alertdialog" aria-label={title} className="overflow-hidden rounded-v2-lg border border-v2-border bg-v2-surface font-v2 text-v2-text shadow-v2-md">
        <div className="flex gap-3 p-5">
          <span className={`flex size-10 shrink-0 items-center justify-center rounded-v2-md ${danger ? "bg-v2-danger-bg text-v2-danger" : "bg-v2-brand-bg text-v2-brand-text"}`} aria-hidden>
            <Icon className="size-5" strokeWidth={1.75} />
          </span>
          <div className="min-w-0">
            <h2 className="text-v2-section text-v2-text">{title}</h2>
            {body && <div className="mt-1 text-v2-small text-v2-text-2">{body}</div>}
          </div>
        </div>
        <div className="flex justify-end gap-2 border-t border-v2-border bg-v2-surface-2 px-5 py-3">
          <button type="button" onClick={modal.close} className={secondaryBtn}>
            {cancelLabel ?? t("Bekor qilish")}
          </button>
          <button
            type="button"
            autoFocus
            onClick={() => {
              onConfirm();
            }}
            className={`inline-flex h-9 shrink-0 items-center gap-2 rounded-v2-md px-4 text-v2-body font-semibold transition-[filter] hover:brightness-95 focus-visible:shadow-v2-focus focus-visible:outline-none ${
              danger ? "bg-v2-danger text-v2-on-danger" : "bg-v2-brand text-v2-on-brand"
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </Modal>
  );
}
