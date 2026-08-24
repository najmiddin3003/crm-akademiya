"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { useEscapeClose } from "@/hooks/useEscapeClose";
import { useBranches } from "@/hooks/useBranches";
import {
  FEEDBACK_FROM_OPTIONS,
  FEEDBACK_TYPES,
  type FeedbackRecord,
  type FeedbackType,
} from "./feedbackTypes";

// "Fikr qo'shish" oynasi. NEGA kerak: fikr-mulohaza sahifasi ilgari faqat
// qattiq yozilgan ro'yxatni ko'rsatardi va yangi fikr kelib tushadigan yo'l
// yo'q edi. Endi yozuv /api/feedback ga POST qilinadi.
//
// Filial ro'yxati qattiq yozilmagan — useBranches() orqali /api/branches dan
// keladi (loyihadagi boshqa formalar bilan bir xil qoida).

const inputCls =
  "h-10 w-full rounded-lg border border-border bg-card px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40";
const selectCls =
  "h-10 w-full appearance-none rounded-lg border border-border bg-card pl-3 pr-9 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-[13px] font-medium mb-1.5">{label}</label>
      {children}
    </div>
  );
}

function SelectWrap({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative">
      {children}
      <svg className="icon icon-xs pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
        <use href="#i-chevron-down" />
      </svg>
    </div>
  );
}

export default function FeedbackFormModal({
  onClose,
  onSaved,
}: {
  onClose: () => void;
  onSaved: (fb: FeedbackRecord) => void;
}) {
  const { branches } = useBranches();
  const [filial, setFilial] = useState("");
  const [from, setFrom] = useState<string>(FEEDBACK_FROM_OPTIONS[0]);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [type, setType] = useState<FeedbackType>(FEEDBACK_TYPES[0]);
  const [izoh, setIzoh] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEscapeClose(onClose);

  async function save() {
    if (!izoh.trim()) {
      setError("Izohni kiriting");
      return;
    }
    setBusy(true);
    setError("");
    const res = await fetch("/api/feedback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ filial, from, name: name.trim(), phone: phone.trim(), type, izoh }),
    })
      .then((r) => r.json())
      .catch(() => null);
    setBusy(false);
    if (!res?.ok) {
      setError(res?.error || "Saqlashda xatolik yuz berdi");
      return;
    }
    onSaved(res.feedback as FeedbackRecord);
  }

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div
        className="w-full max-w-lg rounded-2xl border border-border bg-card shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-3 border-b border-border">
          <h3 className="text-[15px] font-semibold">Fikr-mulohaza qo&apos;shish</h3>
          <button
            type="button"
            onClick={onClose}
            className="h-8 w-8 rounded-md hover:bg-secondary inline-flex items-center justify-center"
          >
            <X className="icon icon-sm" />
          </button>
        </div>

        <div className="p-5 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Filial">
              <SelectWrap>
                <select value={filial} onChange={(e) => setFilial(e.target.value)} className={selectCls}>
                  <option value="">Tanlang</option>
                  {branches.map((b) => (
                    <option key={b.id} value={b.name}>{b.name}</option>
                  ))}
                </select>
              </SelectWrap>
            </Field>
            <Field label="Kimdan">
              <SelectWrap>
                <select value={from} onChange={(e) => setFrom(e.target.value)} className={selectCls}>
                  {FEEDBACK_FROM_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
                </select>
              </SelectWrap>
            </Field>
            <Field label="Ism">
              <input value={name} onChange={(e) => setName(e.target.value)} className={inputCls} placeholder="Ism familiya" />
            </Field>
            <Field label="Telefon raqam">
              <input value={phone} onChange={(e) => setPhone(e.target.value)} className={inputCls} placeholder="+998 __ ___ __ __" />
            </Field>
          </div>

          <Field label="Turi">
            <SelectWrap>
              <select
                value={type}
                onChange={(e) => setType(e.target.value as FeedbackType)}
                className={selectCls}
              >
                {FEEDBACK_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </SelectWrap>
          </Field>

          <Field label="Izoh">
            <textarea
              value={izoh}
              onChange={(e) => setIzoh(e.target.value)}
              rows={4}
              placeholder="Fikr-mulohaza matni"
              className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm resize-y focus:outline-none focus:ring-2 focus:ring-primary/40"
            />
          </Field>

          {error && <p className="text-[13px] text-rose-600">{error}</p>}
        </div>

        <div className="flex justify-end gap-2 px-5 py-3 border-t border-border">
          <button
            type="button"
            onClick={onClose}
            className="h-9 rounded-lg border border-border bg-card px-4 text-sm hover:bg-secondary"
          >
            Bekor qilish
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={save}
            className="h-9 rounded-lg bg-primary px-4 text-sm font-medium text-white hover:opacity-90 disabled:opacity-60"
          >
            {busy ? "Saqlanmoqda..." : "Saqlash"}
          </button>
        </div>
      </div>
    </div>
  );
}
