"use client";

import { useRef, useState } from "react";
import { useToast } from "@/components/ui/Toast";
import { useEscapeClose } from "@/hooks/useEscapeClose";
import type { GroupTask } from "@/lib/groupTasks";
import Select from "@/components/ui/Select";

// "Topshiriq qo'shish" modali (skrinshot 1-2). Saqlash → POST
// /api/groups/:id/tasks. Fayl mahalliy (backendga faqat fayl NOMI yuboriladi —
// fayl saqlash tizimi yo'q).
const inputCls = "w-full h-11 rounded-lg border border-border bg-card px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40";
const labelCls = "block text-[13px] font-medium mb-1.5";

export default function AddTaskModal({ groupId, onClose, onAdded }: { groupId: number; onClose: () => void; onAdded: (task: GroupTask) => void }) {
  useEscapeClose(onClose);
  const { showSuccess, showError } = useToast();
  const [type, setType] = useState("Vazifa");
  const [name, setName] = useState("");
  const [deadline, setDeadline] = useState("");
  const [maxScore, setMaxScore] = useState("");
  const [note, setNote] = useState("");
  const [fileName, setFileName] = useState("");
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  async function save() {
    const trimmed = name.trim();
    if (!trimmed) {
      showError("Topshiriq nomini kiriting");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/groups/${groupId}/tasks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, name: trimmed, deadline, maxScore, note: note.trim(), fileName }),
      });
      const data = await res.json();
      if (!data.ok) {
        showError(data.error || "Topshiriq qo'shilmadi");
        setSaving(false);
        return;
      }
      onAdded(data.task as GroupTask);
      showSuccess("Topshiriq qo'shildi");
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
          <h3 className="text-[16px] font-semibold">Topshiriq qo&apos;shish</h3>
        </div>

        <div className="px-6 py-2 space-y-3.5 overflow-y-auto flex-1">
          <div>
            <label className={labelCls}>Turi<span className="text-rose-500">*</span></label>
            <Select value={type} onChange={(v) => setType(v)} options={[{ value: "Vazifa", label: "Vazifa" }, { value: "Manba", label: "Manba" }]} size="lg" />
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
