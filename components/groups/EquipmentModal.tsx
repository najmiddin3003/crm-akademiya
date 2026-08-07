"use client";

import { useState } from "react";
import { useToast } from "@/components/ui/Toast";
import { useEscapeClose } from "@/hooks/useEscapeClose";
import type { Equipment } from "@/lib/equipment";

// Jihoz qo'shish / tahrirlash modali (Guruh → Jihozlar, referens
// akademiya.edutizim.uz/group/equipments). `equipment` berilsa — tahrirlash
// (PATCH /api/equipment/:id), aks holda qo'shish (POST /api/equipment).
const inputCls = "w-full h-11 rounded-lg border border-border bg-card px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40";
const labelCls = "block text-[13px] font-medium mb-1.5";

export default function EquipmentModal({
  equipment,
  onClose,
  onSaved,
}: {
  equipment?: Equipment;
  onClose: () => void;
  onSaved: (equipment: Equipment) => void;
}) {
  useEscapeClose(onClose);
  const { showSuccess, showError } = useToast();
  const [name, setName] = useState(equipment?.name || "");
  const [inventoryCode, setInventoryCode] = useState(equipment?.inventoryCode || "");
  const [price, setPrice] = useState(equipment ? String(equipment.price) : "");
  const [saving, setSaving] = useState(false);

  async function save() {
    const trimmed = name.trim();
    if (!trimmed) {
      showError("Jihoz nomini kiriting");
      return;
    }
    setSaving(true);
    const payload = { name: trimmed, inventoryCode: inventoryCode.trim(), price };
    const url = equipment ? `/api/equipment/${equipment.id}` : "/api/equipment";
    const method = equipment ? "PATCH" : "POST";
    try {
      const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const data = await res.json();
      if (!data.ok) {
        showError(data.error || "Saqlanmadi");
        setSaving(false);
        return;
      }
      onSaved(data.equipment as Equipment);
      showSuccess(equipment ? "Jihoz yangilandi" : "Jihoz qo'shildi");
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
        <div className="px-6 pt-5 pb-2">
          <h3 className="text-[16px] font-semibold">{equipment ? "Jihozni tahrirlash" : "Jihoz qo'shish"}</h3>
        </div>

        <div className="px-6 py-2 space-y-3.5">
          <div>
            <label className={labelCls}>Jihoz nomi</label>
            <input value={name} onChange={(e) => setName(e.target.value)} type="text" placeholder="Jihoz nomi" className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Inventar kodi</label>
            <input
              value={inventoryCode}
              onChange={(e) => setInventoryCode(e.target.value)}
              type="text"
              placeholder="Bo'sh qoldirilsa avtomatik yaratiladi"
              className={inputCls}
            />
          </div>
          <div>
            <label className={labelCls}>Narxi (dona uchun)</label>
            <input value={price} onChange={(e) => setPrice(e.target.value)} type="number" min="0" placeholder="Narxi (dona uchun)" className={inputCls} />
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-border">
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
