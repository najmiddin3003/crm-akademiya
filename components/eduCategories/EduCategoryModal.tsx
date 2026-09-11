"use client";

import { invalidateEduCategories } from "@/hooks/useEduCategories";
import { useState } from "react";
import { useToast } from "@/components/ui/Toast";
import type { EduCategory } from "@/lib/eduCategories";
import Modal, { useModalClose } from "@/components/ui/Modal";

// Kategoriya qo'shish / tahrirlash modali (O'quv bo'limi → Kategoriya).
// `category` berilsa — tahrirlash (PATCH /api/edu-categories/:id), aks holda
// qo'shish (POST /api/edu-categories).
const inputCls = "w-full h-11 rounded-lg border border-border bg-secondary/40 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40";

export default function EduCategoryModal({
  category,
  onClose,
  onSaved,
}: {
  category?: EduCategory;
  onClose: () => void;
  onSaved: (category: EduCategory) => void;
}) {
  const modal = useModalClose(onClose);
  const { showSuccess, showError } = useToast();
  const [name, setName] = useState(category?.name || "");
  const [saving, setSaving] = useState(false);

  async function save() {
    const trimmed = name.trim();
    if (!trimmed) {
      showError("Kategoriya nomini kiriting");
      return;
    }
    setSaving(true);
    const url = category ? `/api/edu-categories/${category.id}` : "/api/edu-categories";
    const method = category ? "PATCH" : "POST";
    try {
      const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: trimmed }) });
      const data = await res.json();
      if (!data.ok) {
        showError(data.error || "Saqlanmadi");
        setSaving(false);
        return;
      }
      // Kesh bekor qilinadi: keyin mount bo'ladigan iste'molchilar
      // yangi ro'yxatni oladi (lib/referenceCache.ts).
      invalidateEduCategories();
      onSaved(data.category as EduCategory);
      showSuccess(category ? "Kategoriya yangilandi" : "Kategoriya qo'shildi");
      modal.close();
    } catch {
      showError("Serverga ulanib bo'lmadi");
      setSaving(false);
    }
  }

  return (
    <Modal onClose={onClose} controller={modal} bare panelClassName="p-6">
        <div>
          <label className="block text-[13px] font-medium mb-1.5">Nomi<span className="text-rose-500">*</span></label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && save()}
            type="text"
            autoFocus
            className={inputCls}
          />
        </div>

        <div className="flex items-center justify-end gap-2 mt-6">
          <button onClick={modal.close} disabled={saving} className="inline-flex items-center h-9 px-5 rounded-lg border border-border bg-card hover:bg-secondary text-sm font-medium disabled:opacity-60">
            Orqaga
          </button>
          <button onClick={save} disabled={saving} className="inline-flex items-center h-9 px-5 rounded-lg bg-primary text-white text-sm font-medium hover:opacity-90 disabled:opacity-60">
            {saving ? "Saqlanmoqda…" : "Saqlash"}
          </button>
        </div>
      </Modal>
  );
}
