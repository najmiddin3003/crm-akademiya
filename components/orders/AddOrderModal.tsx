"use client";

import { useState } from "react";
import Button from "@/components/ui/Button";
import { useEscapeClose } from "@/hooks/useEscapeClose";
import { COURSES, MODERATORS, ORDER_STAGES, TEACHERS, type OrderStageKey } from "@/lib/ordersData";

// Ported from crm-akademiya/src/app.js openAddOrderModal()/saveNewOrder() (~line 24166).
// Deviation: the original's "Sozlamalar" tab (custom order/student field manager)
// isn't ported — only the "Asosiy" tab (the actual order fields) is here.

export interface NewOrderValues {
  firstName: string;
  lastName: string;
  phone: string;
  course: string;
  teacher: string;
  moderator: string;
  note: string;
  stage: OrderStageKey;
}

export interface AddOrderModalProps {
  onClose: () => void;
  onSave: (values: NewOrderValues) => void;
}

export default function AddOrderModal({ onClose, onSave }: AddOrderModalProps) {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [course, setCourse] = useState("");
  const [teacher, setTeacher] = useState("");
  const [moderator, setModerator] = useState("");
  const [note, setNote] = useState("");
  const [stage, setStage] = useState<OrderStageKey>("bir_oylay");
  const [error, setError] = useState<string | null>(null);
  useEscapeClose(onClose);

  const handleSave = () => {
    if (!course) {
      setError("Kurs majburiy");
      return;
    }
    if (!firstName.trim() && !lastName.trim()) {
      setError("Ism yoki Familiya kerak");
      return;
    }
    onSave({ firstName: firstName.trim(), lastName: lastName.trim(), phone: phone.trim(), course, teacher, moderator, note, stage });
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-2xl border border-border bg-card shadow-2xl p-5 space-y-4 max-h-[92vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-lg font-semibold">Buyurtma qo&apos;shish</h3>

        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1 block">Bosqich</label>
          <div className="grid grid-cols-2 gap-2">
            {ORDER_STAGES.map((st) => (
              <button
                key={st.key}
                type="button"
                onClick={() => setStage(st.key)}
                className={`h-9 rounded-lg border text-sm font-medium flex items-center justify-center gap-1.5 ${stage === st.key ? "border-primary bg-primary/10 text-primary" : "border-border bg-background hover:bg-secondary"}`}
              >
                <span>{st.emoji}</span>{st.label}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Ism</label>
            <input value={firstName} onChange={(e) => { setFirstName(e.target.value); setError(null); }} className="h-9 w-full rounded-lg border border-border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Familiya</label>
            <input value={lastName} onChange={(e) => { setLastName(e.target.value); setError(null); }} className="h-9 w-full rounded-lg border border-border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
        </div>

        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1 block">Telefon</label>
          <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} className="h-9 w-full rounded-lg border border-border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>

        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1 block">Kurs *</label>
          <select value={course} onChange={(e) => { setCourse(e.target.value); setError(null); }} className={`h-9 w-full rounded-lg border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${error === "Kurs majburiy" ? "border-red-400 ring-2 ring-red-400" : "border-border"}`}>
            <option value="">Tanlang</option>
            {COURSES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>

        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1 block">O&apos;qituvchi</label>
          <select value={teacher} onChange={(e) => setTeacher(e.target.value)} className="h-9 w-full rounded-lg border border-border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
            <option value="">Tanlang</option>
            {TEACHERS.filter(Boolean).map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>

        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1 block">Mas&apos;ul shaxs</label>
          <select value={moderator} onChange={(e) => setModerator(e.target.value)} className="h-9 w-full rounded-lg border border-border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
            <option value="">Tanlang</option>
            {MODERATORS.map((m) => <option key={m} value={m}>{m}</option>)}
          </select>
        </div>

        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1 block">Eslatma</label>
          <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>

        {error && <div className="text-sm text-red-600">⚠ {error}</div>}

        <div className="flex justify-end gap-2 pt-1">
          <Button variant="outline" onClick={onClose}>Bekor qilish</Button>
          <Button variant="primary" onClick={handleSave}>Saqlash</Button>
        </div>
      </div>
    </div>
  );
}
