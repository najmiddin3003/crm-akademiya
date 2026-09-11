"use client";

import { useEffect, useMemo, useState } from "react";
import { useToast } from "@/components/ui/Toast";
import { useEscapeClose } from "@/hooks/useEscapeClose";
import type { Pupil, PupilListItem } from "@/lib/pupilsData";
import { loadPupilsCached } from "@/hooks/useStudents";
import Select from "@/components/ui/Select";

// "O'quvchini tanlang" modali (skrinshot 5). Serverdagi o'quvchilar
// (/api/pupils) ro'yxatidan birini tanlab, guruhga qo'shadi
// (POST /api/groups/:id/students). Allaqachon guruhda bo'lganlar ro'yxatda
// ko'rsatilmaydi.
export interface AddStudentModalProps {
  groupId: number;
  existingIds: number[];
  onClose: () => void;
  onAdded: (pupil: Pupil) => void;
}

export default function AddStudentModal({ groupId, existingIds, onClose, onAdded }: AddStudentModalProps) {
  useEscapeClose(onClose);
  const { showSuccess, showError } = useToast();
  const [pupils, setPupils] = useState<PupilListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    // Bu yerda faqat ism/telefon ko'rsatiladi -> yengil ro'yxat, ustiga u
    // umumiy keshdan keladi (hooks/useStudents.ts).
    loadPupilsCached(true)
      .then((list) => { if (!cancelled) setPupils(list); })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const available = useMemo(() => pupils.filter((p) => !existingIds.includes(p.id)), [pupils, existingIds]);

  async function save() {
    const pupilId = Number(selected);
    if (!pupilId) {
      showError("O'quvchini tanlang");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/groups/${groupId}/students`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pupilId }),
      });
      const data = await res.json();
      if (!data.ok) {
        showError(data.error || "Qo'shilmadi");
        setSaving(false);
        return;
      }
      onAdded(data.student as Pupil);
      showSuccess("O'quvchi guruhga qo'shildi");
      onClose();
    } catch {
      showError("Serverga ulanib bo'lmadi");
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md rounded-2xl bg-card border border-border shadow-2xl">
        <div className="px-6 pt-5 pb-2 text-center">
          <h3 className="text-[17px] font-bold tracking-tight">O&apos;quvchini tanlang</h3>
        </div>
        <div className="px-6 py-4">
          <label className="block text-[13px] font-medium mb-1.5">O&apos;quvchini tanlang</label>
          <Select value={selected} onChange={(v) => setSelected(v)} options={available.map((p) => ({ value: String(p.id), label: `${p.firstName} ${p.lastName} ${p.phone ? ` — ${p.phone}` : ""}` }))} placeholder={loading ? "Yuklanmoqda…" : available.length ? "Tanlang" : "O'quvchilar yo'q"} clearable size="lg" disabled={loading} />
          {!loading && available.length === 0 && (
            <p className="mt-2 text-[12px] text-muted-foreground">Serverda qo&apos;shiladigan o&apos;quvchi yo&apos;q. Avval Lidlar → &quot;O&apos;quvchi qo&apos;shish&quot; orqali o&apos;quvchi qo&apos;shing.</p>
          )}
        </div>
        <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-border">
          <button onClick={save} disabled={saving || loading} className="inline-flex items-center h-9 px-5 rounded-lg bg-primary text-white text-sm font-medium hover:opacity-90 disabled:opacity-60">{saving ? "Saqlanmoqda…" : "Saqlash"}</button>
        </div>
      </div>
    </div>
  );
}
