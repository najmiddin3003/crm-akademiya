"use client";

import { useState } from "react";
import { useToast } from "@/components/ui/Toast";
import type { SeasonalAssessment } from "@/lib/seasonalAssessments";
import Modal, { useModalClose } from "@/components/ui/Modal";

// Mavsumiy baholash ro'yxatidagi bitta yozuvni tahrirlash (ball/izoh) —
// jadvaldagi soat-tarix ikonkasi bosilganda ochiladi. Oy/kurs/guruh/o'quvchi
// o'zgarmaydi (yozuvning o'zi shu kombinatsiya uchun yaratilgan).
const inputCls = "w-full h-11 rounded-lg border border-border bg-secondary/40 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40";
const labelCls = "block text-[13px] font-medium mb-1.5";

export default function SeasonalAssessmentEditModal({
  assessment,
  onClose,
  onSaved,
}: {
  assessment: SeasonalAssessment;
  onClose: () => void;
  onSaved: (a: SeasonalAssessment) => void;
}) {
  const modal = useModalClose(onClose);
  const { showSuccess, showError } = useToast();
  const [ball, setBall] = useState(String(assessment.ball));
  const [izoh, setIzoh] = useState(assessment.izoh);
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    try {
      const res = await fetch(`/api/seasonal-assessments/${assessment.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ball: Number(ball) || 0, izoh }),
      });
      const data = await res.json();
      if (!data.ok) {
        showError(data.error || "Saqlanmadi");
        setSaving(false);
        return;
      }
      onSaved(data.assessment as SeasonalAssessment);
      showSuccess("Baho yangilandi");
      modal.close();
    } catch {
      showError("Serverga ulanib bo'lmadi");
      setSaving(false);
    }
  }

  return (
    <Modal onClose={onClose} controller={modal} bare>
        <div className="px-6 pt-5 pb-2">
          <h3 className="text-[16px] font-semibold">Bahoni tahrirlash</h3>
          <p className="text-[12px] text-muted-foreground mt-0.5">{assessment.studentName} — {assessment.course} / {assessment.groupName}</p>
        </div>

        <div className="px-6 py-2 space-y-3.5">
          <div>
            <label className={labelCls}>Ball</label>
            <input value={ball} onChange={(e) => setBall(e.target.value)} type="number" min="0" className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Izoh</label>
            <input value={izoh} onChange={(e) => setIzoh(e.target.value)} type="text" className={inputCls} />
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-border">
          <button onClick={modal.close} className="inline-flex items-center h-9 px-4 rounded-lg border border-border bg-card hover:bg-secondary text-sm font-medium">
            Orqaga
          </button>
          <button onClick={save} disabled={saving} className="inline-flex items-center h-9 px-5 rounded-lg bg-primary text-white text-sm font-medium hover:opacity-90 disabled:opacity-60">
            {saving ? "Saqlanmoqda…" : "Saqlash"}
          </button>
        </div>
      </Modal>
  );
}
