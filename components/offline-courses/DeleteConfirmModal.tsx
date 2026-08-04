"use client";

import { useEscapeClose } from "@/hooks/useEscapeClose";

// Umumiy o'chirishni tasdiqlash oynasi — kurs va daraja o'chirishda bir xil.
// crm-akademiya/index-dev.html dagi #oc-delete-modal dizayni asosida.
export interface DeleteConfirmModalProps {
  title: string;
  message: string;
  name: string;
  onCancel: () => void;
  onConfirm: () => void;
}

export default function DeleteConfirmModal({ title, message, name, onCancel, onConfirm }: DeleteConfirmModalProps) {
  useEscapeClose(onCancel);

  return (
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center p-4"
      style={{ background: "rgba(15,23,42,.55)", backdropFilter: "blur(4px)" }}
      onClick={onCancel}
    >
      <div className="w-full max-w-sm rounded-2xl bg-card border border-border shadow-2xl" onClick={(e) => e.stopPropagation()}>
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
          <button onClick={onCancel} className="h-9 px-4 rounded-lg border border-border bg-card hover:bg-secondary text-sm">
            Orqaga
          </button>
          <button onClick={onConfirm} className="h-9 px-5 rounded-lg bg-rose-600 text-white text-sm font-medium hover:bg-rose-700">
            O&apos;chirish
          </button>
        </div>
      </div>
    </div>
  );
}
