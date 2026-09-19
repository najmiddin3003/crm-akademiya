"use client";

import Modal, { useModalClose } from "@/components/ui/Modal";
import { useT } from "@/components/shared/Language";

// Umumiy o'chirishni tasdiqlash oynasi — kurs va daraja o'chirishda bir xil.
// crm-akademiya/index-dev.html dagi #oc-delete-modal dizayni asosida.
export interface DeleteConfirmModalProps {
  title: string;
  message: string;
  name: string;
  onCancel: () => void;
  onConfirm: () => void;
  /** Qatlam — drawer (z-index 1001) ustidan ochilishi kerak bo'lsa oshiriladi. */
  zIndex?: number;
}

export default function DeleteConfirmModal({ title, message, name, onCancel, onConfirm, zIndex = 120 }: DeleteConfirmModalProps) {
  const { t } = useT();
  const modal = useModalClose(onCancel);

  return (
    <Modal onClose={onCancel} controller={modal} bare size="sm" zIndex={zIndex}>
        <div className="p-6">
          <div className="flex items-center gap-3 mb-3">
            <div className="h-10 w-10 rounded-full bg-rose-100 flex items-center justify-center">
              <svg className="icon icon-sm text-rose-600"><use href="#i-trash" /></svg>
            </div>
            <h3 className="text-lg font-semibold tracking-tight">{title}</h3>
          </div>
          <p className="text-[13px] text-muted-foreground">
            {message} <span className="font-semibold text-foreground">{name}</span>?
          </p>
        </div>
        <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-border">
          <button onClick={modal.close} className="h-9 px-4 rounded-lg border border-border bg-card hover:bg-secondary text-sm">
            {t("Orqaga")}
          </button>
          <button onClick={onConfirm} className="h-9 px-5 rounded-lg bg-rose-600 text-white text-sm font-medium hover:bg-rose-700">
            {t("O'chirish")}
          </button>
        </div>
    </Modal>
  );
}
