"use client";

import { useState } from "react";

// Nazorat > Davomat jadvalidagi "Sharh" ikonkasi ochadigan oyna.
// Sharh o'quvchining davomati bo'yicha eslatma — `settings` kolleksiyasida
// `nazorat.davomat` kaliti ostida saqlanadi (sahifa o'zi statik demo
// ma'lumotda ishlaydi, shuning uchun alohida kolleksiya ochilmadi).

export default function DavomatCommentModal({
  studentName,
  initialValue,
  busy,
  onClose,
  onSave,
}: {
  studentName: string;
  initialValue: string;
  busy: boolean;
  onClose: () => void;
  onSave: (text: string) => void;
}) {
  const [text, setText] = useState(initialValue);

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-5 space-y-4 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div>
          <h3 className="text-lg font-semibold">Sharh</h3>
          <p className="text-[13px] text-muted-foreground">{studentName}</p>
        </div>

        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={4}
          autoFocus
          placeholder="Davomat bo'yicha eslatma yozing"
          className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm resize-y focus:outline-none focus:ring-2 focus:ring-primary/40"
        />

        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="h-9 rounded-lg border border-border bg-card px-4 text-sm hover:bg-secondary">
            Bekor qilish
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => onSave(text)}
            className="h-9 rounded-lg bg-primary px-4 text-sm font-medium text-white hover:opacity-90 disabled:opacity-60"
          >
            {busy ? "Saqlanmoqda..." : "Saqlash"}
          </button>
        </div>
      </div>
    </div>
  );
}
