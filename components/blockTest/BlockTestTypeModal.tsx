"use client";

import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { useToast } from "@/components/ui/Toast";
import { useEscapeClose } from "@/hooks/useEscapeClose";
import { BLOCK_TEST_KINDS, BLOCK_TEST_SUBJECTS } from "@/constants/blockTest";
import type { BlockTestType, BlockTestSubject } from "@/lib/blockTestTypes";

// "Tur qo'shish" / tahrirlash modali (Blok test → Blok test turlari, referens
// akademiya.edutizim.uz/block-test/types). `type` berilsa — tahrirlash
// (PATCH /api/block-test-types/:id), aks holda qo'shish (POST).
const inputCls = "w-full h-11 rounded-lg border border-border bg-card px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40";
const selectCls = "filter-select w-full h-11 appearance-none rounded-lg border border-border bg-card px-3 pr-9 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40";
const labelCls = "block text-[13px] font-medium mb-1.5";

function Chevron() {
  return <svg className="icon icon-xs absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-muted-foreground"><use href="#i-chevron-down" /></svg>;
}

function emptySubject(): BlockTestSubject {
  return { subject: "", questionsCount: 0, pointsPerCorrect: 0 };
}

export default function BlockTestTypeModal({
  type,
  onClose,
  onSaved,
}: {
  type?: BlockTestType;
  onClose: () => void;
  onSaved: (type: BlockTestType) => void;
}) {
  useEscapeClose(onClose);
  const { showSuccess, showError } = useToast();
  const [name, setName] = useState(type?.name || "");
  const [kind, setKind] = useState(type?.kind || "");
  const [durationMinutes, setDurationMinutes] = useState(type ? String(type.durationMinutes) : "0");
  const [subjects, setSubjects] = useState<BlockTestSubject[]>(type?.subjects?.length ? type.subjects : [emptySubject()]);
  const [active, setActive] = useState(type ? type.active : true);
  const [saving, setSaving] = useState(false);

  function updateSubject(i: number, patch: Partial<BlockTestSubject>) {
    setSubjects((prev) => prev.map((s, idx) => (idx === i ? { ...s, ...patch } : s)));
  }
  function addSubject() {
    setSubjects((prev) => [...prev, emptySubject()]);
  }
  function removeSubject(i: number) {
    setSubjects((prev) => prev.filter((_, idx) => idx !== i));
  }

  async function save() {
    const trimmed = name.trim();
    if (!trimmed) {
      showError("Nomini kiriting");
      return;
    }
    setSaving(true);
    const payload = {
      name: trimmed,
      kind,
      durationMinutes,
      subjects: subjects.filter((s) => s.subject.trim()),
      active,
    };
    const url = type ? `/api/block-test-types/${type.id}` : "/api/block-test-types";
    const method = type ? "PATCH" : "POST";
    try {
      const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const data = await res.json();
      if (!data.ok) {
        showError(data.error || "Saqlanmadi");
        setSaving(false);
        return;
      }
      onSaved(data.type as BlockTestType);
      showSuccess(type ? "Tur yangilandi" : "Tur qo'shildi");
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
          <h3 className="text-[16px] font-semibold">{type ? "Turni tahrirlash" : "Tur qo'shish"}</h3>
        </div>

        <div className="px-6 py-2 space-y-3.5 overflow-y-auto flex-1">
          <div>
            <label className={labelCls}>Nomi</label>
            <input value={name} onChange={(e) => setName(e.target.value)} type="text" placeholder="Nomi" className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Turi (kodi)</label>
            <div className="relative">
              <select value={kind} onChange={(e) => setKind(e.target.value)} className={selectCls}>
                <option value="">Tanlang</option>
                {BLOCK_TEST_KINDS.map((k) => <option key={k.value} value={k.value}>{k.label}</option>)}
              </select>
              <Chevron />
            </div>
          </div>
          <div>
            <label className={labelCls}>Davomiyligi (daqiqa)</label>
            <input value={durationMinutes} onChange={(e) => setDurationMinutes(e.target.value)} type="number" min="0" className={inputCls} />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-[13px] font-medium">Fanlar</label>
              <button type="button" onClick={addSubject} className="h-7 w-7 rounded-md bg-primary/10 text-primary flex items-center justify-center hover:bg-primary/20" title="Fan qo'shish">
                <Plus className="w-4 h-4" />
              </button>
            </div>
            <div className="space-y-3">
              {subjects.map((s, i) => (
                <div key={i} className="rounded-lg border border-border p-3 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[12px] text-muted-foreground font-medium">Fan {i + 1}</span>
                    {subjects.length > 1 && (
                      <button type="button" onClick={() => removeSubject(i)} className="text-rose-500 hover:text-rose-600" title="O'chirish">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                  <div>
                    <label className="block text-[12px] text-muted-foreground mb-1">Fan</label>
                    <div className="relative">
                      <select value={s.subject} onChange={(e) => updateSubject(i, { subject: e.target.value })} className={`${selectCls} h-10`}>
                        <option value="">Tanlang</option>
                        {BLOCK_TEST_SUBJECTS.map((f) => <option key={f} value={f}>{f}</option>)}
                      </select>
                      <Chevron />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[12px] text-muted-foreground mb-1">Savollar soni</label>
                      <input
                        value={s.questionsCount}
                        onChange={(e) => updateSubject(i, { questionsCount: parseInt(e.target.value, 10) || 0 })}
                        type="number"
                        min="0"
                        className={`${inputCls} h-10`}
                      />
                    </div>
                    <div>
                      <label className="block text-[12px] text-muted-foreground mb-1">Har bir to&apos;g&apos;ri javob uchun ball</label>
                      <input
                        value={s.pointsPerCorrect}
                        onChange={(e) => updateSubject(i, { pointsPerCorrect: parseFloat(e.target.value) || 0 })}
                        type="number"
                        min="0"
                        className={`${inputCls} h-10`}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <label className="flex items-center gap-2.5 cursor-pointer pt-1">
            <button
              type="button"
              onClick={() => setActive((a) => !a)}
              className={`relative w-9 h-5 rounded-full transition-colors ${active ? "bg-primary" : "bg-secondary"}`}
            >
              <span className={`absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${active ? "translate-x-4" : ""}`} />
            </button>
            <span className="text-sm">Faol</span>
          </label>
        </div>

        <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-border flex-shrink-0">
          <button onClick={onClose} className="inline-flex items-center h-9 px-4 rounded-lg border border-border bg-card hover:bg-secondary text-sm font-medium">
            Bekor qilish
          </button>
          <button onClick={save} disabled={saving} className="inline-flex items-center h-9 px-5 rounded-lg bg-primary text-white text-sm font-medium hover:opacity-90 disabled:opacity-60">
            {saving ? "Saqlanmoqda…" : "Saqlash"}
          </button>
        </div>
      </div>
    </div>
  );
}
