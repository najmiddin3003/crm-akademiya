"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { useToast } from "@/components/ui/Toast";
import { useEscapeClose } from "@/hooks/useEscapeClose";
import { GROUP_COURSES, GROUP_EDU_TYPES } from "@/constants/groups";
import type { Group } from "@/lib/groups";

// Yangi guruh qo'shish modali (crm-akademiya #group-add-modal, skrinshot 2).
// Saqlash → POST /api/groups.
const selectCls = "filter-select w-full h-10 appearance-none rounded-lg border border-border bg-card px-3 pr-8 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40";
const inputCls = "w-full h-10 rounded-lg border border-border bg-card px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40";
const labelCls = "block text-[13px] font-medium mb-1.5";

function Chevron() {
  return <svg className="icon icon-xs absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-muted-foreground"><use href="#i-chevron-down" /></svg>;
}

export default function AddGroupModal({ onClose, onCreated }: { onClose: () => void; onCreated?: (g: Group) => void }) {
  useEscapeClose(onClose);
  const { showSuccess, showError } = useToast();
  const [name, setName] = useState("");
  const [status, setStatus] = useState("");
  const [course, setCourse] = useState("");
  const [eduType, setEduType] = useState("");
  const [telegram, setTelegram] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [saving, setSaving] = useState(false);

  async function save() {
    const trimmed = name.trim();
    if (!trimmed) {
      showError("Guruh nomini kiriting");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/groups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmed, status: status || "active", course, eduType, telegram: telegram.trim(), startDate, endDate }),
      });
      const data = await res.json();
      if (!data.ok) {
        showError(data.error || "Guruh qo'shilmadi");
        setSaving(false);
        return;
      }
      onCreated?.(data.group as Group);
      showSuccess(`Guruh qo'shildi — ${trimmed}`);
      onClose();
    } catch {
      showError("Serverga ulanib bo'lmadi");
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md rounded-2xl bg-card border border-border shadow-2xl max-h-[90vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-border flex-shrink-0">
          <div>
            <h3 className="text-base font-semibold">Yangi guruh qo&apos;shish</h3>
            <p className="text-[11px] text-muted-foreground mt-0.5"><span className="text-red-500">*</span> Zarurligini bildiradi</p>
          </div>
          <button onClick={onClose} className="h-8 w-8 rounded-full hover:bg-secondary flex items-center justify-center text-muted-foreground" title="Yopish">
            <X className="icon icon-sm" />
          </button>
        </div>

        <div className="p-5 space-y-3.5 overflow-y-auto flex-1">
          <div>
            <label className={labelCls}>Guruh nomi<span className="text-red-500">*</span></label>
            <input value={name} onChange={(e) => setName(e.target.value)} type="text" className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Guruh holati<span className="text-red-500">*</span></label>
            <div className="relative">
              <select value={status} onChange={(e) => setStatus(e.target.value)} className={selectCls}>
                <option value="">Tanlang</option>
                <option value="active">Aktiv guruh</option>
                <option value="frozen">Muzlatilgan</option>
                <option value="archive">Arxiv</option>
              </select>
              <Chevron />
            </div>
          </div>
          <div>
            <label className={labelCls}>Kurs<span className="text-red-500">*</span></label>
            <div className="relative">
              <select value={course} onChange={(e) => setCourse(e.target.value)} className={selectCls}>
                <option value="">Tanlang</option>
                {GROUP_COURSES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
              <Chevron />
            </div>
          </div>
          <div>
            <label className={labelCls}>Ta&apos;lim turi<span className="text-red-500">*</span></label>
            <div className="relative">
              <select value={eduType} onChange={(e) => setEduType(e.target.value)} className={selectCls}>
                <option value="">Tanlang</option>
                {GROUP_EDU_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
              <Chevron />
            </div>
          </div>
          <div>
            <label className={labelCls}>Telegram guruh havolasi</label>
            <input value={telegram} onChange={(e) => setTelegram(e.target.value)} type="text" placeholder="https://t.me/..." className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Boshlanish sanasi</label>
            <input value={startDate} onChange={(e) => setStartDate(e.target.value)} type="date" className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Bitkazish sanasi</label>
            <input value={endDate} onChange={(e) => setEndDate(e.target.value)} type="date" className={inputCls} />
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 p-4 border-t border-border flex-shrink-0">
          <button onClick={onClose} className="inline-flex items-center h-9 px-4 rounded-lg border border-border bg-card hover:bg-secondary text-sm font-medium">Orqaga</button>
          <button onClick={save} disabled={saving} className="inline-flex items-center h-9 px-4 rounded-lg bg-primary text-white text-sm font-medium hover:opacity-90 disabled:opacity-60">{saving ? "Saqlanmoqda…" : "Saqlash"}</button>
        </div>
      </div>
    </div>
  );
}
