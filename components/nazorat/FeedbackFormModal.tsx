"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { useBranches } from "@/hooks/useBranches";
import {
  FEEDBACK_FROM_OPTIONS,
  FEEDBACK_TYPES,
  type FeedbackRecord,
  type FeedbackType,
} from "./feedbackTypes";
import Select from "@/components/ui/Select";
import Modal, { useModalClose } from "@/components/ui/Modal";

// "Fikr qo'shish" oynasi. NEGA kerak: fikr-mulohaza sahifasi ilgari faqat
// qattiq yozilgan ro'yxatni ko'rsatardi va yangi fikr kelib tushadigan yo'l
// yo'q edi. Endi yozuv /api/feedback ga POST qilinadi.
//
// Filial ro'yxati qattiq yozilmagan — useBranches() orqali /api/branches dan
// keladi (loyihadagi boshqa formalar bilan bir xil qoida).

const inputCls =
  "h-10 w-full rounded-lg border border-border bg-card px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40";

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
  const modal = useModalClose(onClose);
  const { branches } = useBranches();
  const [filial, setFilial] = useState("");
  const [from, setFrom] = useState<string>(FEEDBACK_FROM_OPTIONS[0]);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [type, setType] = useState<FeedbackType>(FEEDBACK_TYPES[0]);
  const [izoh, setIzoh] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");


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
    <Modal onClose={onClose} controller={modal} bare size="lg" zIndex={300}>
        <div className="flex items-center justify-between px-5 py-3 border-b border-border">
          <h3 className="text-[15px] font-semibold">Fikr-mulohaza qo&apos;shish</h3>
          <button
            type="button"
            onClick={modal.close}
            className="h-8 w-8 rounded-md hover:bg-secondary inline-flex items-center justify-center"
          >
            <X className="icon icon-sm" />
          </button>
        </div>

        <div className="p-5 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Filial">
              <SelectWrap>
                <Select value={filial} onChange={(v) => setFilial(v)} options={branches.map((b) => ({ value: b.name, label: b.name }))} placeholder="Tanlang" clearable />
              </SelectWrap>
            </Field>
            <Field label="Kimdan">
              <SelectWrap>
                <Select value={from} onChange={(v) => setFrom(v)} options={FEEDBACK_FROM_OPTIONS.map((o) => ({ value: o, label: o }))} />
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
              <Select value={type} onChange={(v) => setType(v as FeedbackType)} options={FEEDBACK_TYPES.map((t) => ({ value: t, label: t }))} />
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
            onClick={modal.close}
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
      </Modal>
  );
}
