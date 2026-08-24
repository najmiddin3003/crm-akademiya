"use client";

import { useRef, useState } from "react";
import { useToast } from "@/components/ui/Toast";
import { useEscapeClose } from "@/hooks/useEscapeClose";
import { useTaskTypes } from "@/hooks/useTaskTypes";
import type { GroupTask } from "@/lib/groupTasks";

// Vazifa qo'shish / tahrirlash modali (skrinshot 2). `task` berilsa — tahrirlash
// (inputlar oldingi qiymatlar bilan to'ldiriladi), PATCH /api/group-tasks/:id.
// Aks holda — qo'shish, POST /api/group-tasks (guruhsiz).
const inputCls = "w-full h-11 rounded-lg border border-border bg-card px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40";
const labelCls = "block text-[13px] font-medium mb-1.5";

// "30.05.2026 | 06:03" → "2026-05-30T06:03" (datetime-local uchun).
function deadlineToInput(s: string): string {
  const m = s.match(/(\d{2})\.(\d{2})\.(\d{4})(?:\s*\|\s*(\d{2}):(\d{2}))?/);
  if (!m) return "";
  const [, d, mo, y, hh = "00", mm = "00"] = m;
  return `${y}-${mo}-${d}T${hh}:${mm}`;
}

export default function TaskModal({ task, onClose, onSaved }: { task?: GroupTask; onClose: () => void; onSaved: (task: GroupTask) => void }) {
  // Topshiriq turlari — Topshiriqlar sahifasidagi bilan bir manba
  // (/api/task-types), ilgari constants'dagi qattiq ro'yxat edi.
  const { types } = useTaskTypes();
  const typeNames = types.map((t) => t.name).filter(Boolean);
  useEscapeClose(onClose);
  const { showSuccess, showError } = useToast();
  const [type, setType] = useState(task?.type || "Imtihon");
  const [name, setName] = useState(task?.name || "");
  const [deadline, setDeadline] = useState(task ? deadlineToInput(task.deadline) : "");
  const [maxScore, setMaxScore] = useState(task ? String(task.maxScore) : "");
  const [note, setNote] = useState(task?.note || "");
  const [fileName, setFileName] = useState(task?.fileName || "");
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  async function save() {
    const trimmed = name.trim();
    if (!trimmed) {
      showError("Nomini kiriting");
      return;
    }
    setSaving(true);
    const payload = { type, name: trimmed, deadline, maxScore, note: note.trim(), fileName };
    const url = task ? `/api/group-tasks/${task.id}` : "/api/group-tasks";
    const method = task ? "PATCH" : "POST";
    try {
      const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const data = await res.json();
      if (!data.ok) {
        showError(data.error || "Saqlanmadi");
        setSaving(false);
        return;
      }
      onSaved(data.task as GroupTask);
      showSuccess(task ? "Vazifa yangilandi" : "Vazifa qo'shildi");
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
        <div className="px-6 pt-5 pb-2 flex-shrink-0">
          <h3 className="text-[16px] font-semibold">{task ? "Vazifani tahrirlash" : "Vazifa qo'shish"}</h3>
        </div>

        <div className="px-6 py-2 space-y-3.5 overflow-y-auto flex-1">
          <div>
            <label className={labelCls}>Turi<span className="text-rose-500">*</span></label>
            <div className="relative">
              <select value={type} onChange={(e) => setType(e.target.value)} className={`${inputCls} appearance-none pr-9`}>
                {typeNames.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
              <svg className="icon icon-xs absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-muted-foreground"><use href="#i-chevron-down" /></svg>
            </div>
          </div>
          <div>
            <label className={labelCls}>Nomi<span className="text-rose-500">*</span></label>
            <input value={name} onChange={(e) => setName(e.target.value)} type="text" className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Topshirish muddati<span className="text-rose-500">*</span></label>
            <input value={deadline} onChange={(e) => setDeadline(e.target.value)} type="datetime-local" className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Maksimal ball<span className="text-rose-500">*</span></label>
            <input value={maxScore} onChange={(e) => setMaxScore(e.target.value)} type="number" min="0" className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Izoh</label>
            <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40" />
          </div>
          <div>
            <button type="button" onClick={() => fileRef.current?.click()} className="w-full h-11 rounded-lg border border-border bg-card px-3 text-sm text-left text-muted-foreground hover:bg-secondary/30">
              {fileName || "Fayl tanlang"}
            </button>
            <input ref={fileRef} type="file" className="hidden" onChange={(e) => setFileName(e.target.files?.[0]?.name || "")} />
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-border flex-shrink-0">
          <button onClick={onClose} className="inline-flex items-center h-9 px-4 rounded-lg border border-border bg-card hover:bg-secondary text-sm font-medium">Orqaga</button>
          <button onClick={save} disabled={saving} className="inline-flex items-center h-9 px-5 rounded-lg bg-primary text-white text-sm font-medium hover:opacity-90 disabled:opacity-60">{saving ? "Saqlanmoqda…" : "Saqlash"}</button>
        </div>
      </div>
    </div>
  );
}
