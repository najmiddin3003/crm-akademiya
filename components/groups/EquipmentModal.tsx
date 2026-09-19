"use client";

import { useState } from "react";
import { useToast } from "@/components/ui/Toast";
import type { Equipment } from "@/lib/equipment";
import Modal, { useModalClose } from "@/components/ui/Modal";
import { useT } from "@/components/shared/Language";

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
  const { t } = useT();
  const modal = useModalClose(onClose);
  const { showSuccess, showError } = useToast();
  const [name, setName] = useState(equipment?.name || "");
  const [inventoryCode, setInventoryCode] = useState(equipment?.inventoryCode || "");
  const [price, setPrice] = useState(equipment ? String(equipment.price) : "");
  const [saving, setSaving] = useState(false);

  async function save() {
    const trimmed = name.trim();
    if (!trimmed) {
      showError(t("Jihoz nomini kiriting"));
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
        showError(t(data.error || "Saqlanmadi"));
        setSaving(false);
        return;
      }
      onSaved(data.equipment as Equipment);
      showSuccess(equipment ? t("Jihoz yangilandi") : t("Jihoz qo'shildi"));
      modal.close();
    } catch {
      showError(t("Serverga ulanib bo'lmadi"));
      setSaving(false);
    }
  }

  return (
    <Modal onClose={onClose} controller={modal} bare>
        <div className="px-6 pt-5 pb-2">
          <h3 className="text-[16px] font-semibold">{equipment ? t("Jihozni tahrirlash") : t("Jihoz qo'shish")}</h3>
        </div>

        <div className="px-6 py-2 space-y-3.5">
          <div>
            <label className={labelCls}>{t("Jihoz nomi")}</label>
            <input value={name} onChange={(e) => setName(e.target.value)} type="text" placeholder={t("Jihoz nomi")} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>{t("Inventar kodi")}</label>
            <input
              value={inventoryCode}
              onChange={(e) => setInventoryCode(e.target.value)}
              type="text"
              placeholder={t("Bo'sh qoldirilsa avtomatik yaratiladi")}
              className={inputCls}
            />
          </div>
          <div>
            <label className={labelCls}>{t("Narxi (dona uchun)")}</label>
            <input value={price} onChange={(e) => setPrice(e.target.value)} type="number" min="0" placeholder={t("Narxi (dona uchun)")} className={inputCls} />
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-border">
          <button onClick={modal.close} className="inline-flex items-center h-9 px-4 rounded-lg border border-border bg-card hover:bg-secondary text-sm font-medium">
            {t("Bekor qilish")}
          </button>
          <button onClick={save} disabled={saving} className="inline-flex items-center h-9 px-5 rounded-lg bg-primary text-white text-sm font-medium hover:opacity-90 disabled:opacity-60">
            {saving ? t("Saqlanmoqda…") : t("Saqlash")}
          </button>
        </div>
      </Modal>
  );
}
