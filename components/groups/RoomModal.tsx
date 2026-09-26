"use client";

import { invalidateRooms } from "@/hooks/useRooms";
import { useState } from "react";
import { useToast } from "@/components/ui/Toast";
import { roomBranchId, type Room } from "@/lib/rooms";
import Modal, { useModalClose } from "@/components/ui/Modal";
import Select from "@/components/ui/Select";
import { useBranch } from "@/components/shared/BranchContext";
import { useT } from "@/components/shared/Language";

// Xona qo'shish / tahrirlash modali (Guruh → Xonalar, skrinshot 2/3).
// `room` berilsa — tahrirlash (PATCH /api/rooms/:id), aks holda qo'shish
// (POST /api/rooms).
//
// FILIAL shu yerda tanlanadi, sukut — navbardagi filial. Variantlar —
// navbardagi kabi foydalanuvchiga RUXSAT ETILGAN filiallar (useBranch);
// server ham aynan shu ro'yxatga solishtiradi (lib/roomBranch.ts).
const inputCls = "w-full h-11 rounded-lg border border-border bg-card px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40";
const labelCls = "block text-[13px] font-medium mb-1.5";

export default function RoomModal({
  room,
  onClose,
  onSaved,
}: {
  room?: Room;
  onClose: () => void;
  onSaved: (room: Room) => void;
}) {
  const { t } = useT();
  const modal = useModalClose(onClose);
  const { showSuccess, showError } = useToast();
  const { branchId: currentBranchId, branches, loading: branchesLoading } = useBranch();
  const [branch, setBranch] = useState(room ? String(roomBranchId(room)) : "");
  // Qo'shishda sukut holatga YOZILMAYDI: filiallar oyna ochilgandan keyin
  // kelsa ham tanlov bo'sh qolmasin.
  const branchValue = branch || (currentBranchId !== null ? String(currentBranchId) : "");
  const [name, setName] = useState(room?.name || "");
  const [capacity, setCapacity] = useState(room ? String(room.capacity) : "");
  const [note, setNote] = useState(room?.note || "");
  const [saving, setSaving] = useState(false);

  async function save() {
    const trimmed = name.trim();
    if (!trimmed) {
      showError(t("Xona nomini kiriting"));
      return;
    }
    if (!branchValue) {
      showError(t("Filialni tanlang"));
      return;
    }
    setSaving(true);
    const payload = { name: trimmed, capacity, note: note.trim(), branchId: Number(branchValue) };
    const url = room ? `/api/rooms/${room.id}` : "/api/rooms";
    const method = room ? "PATCH" : "POST";
    try {
      const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const data = await res.json();
      if (!data.ok) {
        showError(t(data.error || "Saqlanmadi"));
        setSaving(false);
        return;
      }
      const saved = data.room as Room;
      // Kesh bekor qilinadi: keyin mount bo'ladigan iste'molchilar
      // yangi ro'yxatni oladi (lib/referenceCache.ts).
      invalidateRooms();
      onSaved(saved);
      // Xonalar ro'yxati navbardagi filial bo'yicha — boshqa filialga
      // tushgan xona undan chiqib ketadi, qayerga ketganini xabar aytadi.
      const savedBranch = roomBranchId(saved);
      const branchName = branches.find((b) => b.id === savedBranch)?.name ?? "";
      // Nom o'zgarsa server guruhlarni ham yangi nomga o'tkazadi (lib/roomBranch.ts).
      const movedGroups = Number(data.movedGroups) || 0;
      if (room && savedBranch !== roomBranchId(room)) {
        showSuccess(t("Xona «{branch}» filialiga o'tkazildi", { branch: branchName }));
      } else if (!room && currentBranchId !== null && savedBranch !== currentBranchId) {
        showSuccess(t("Xona «{branch}» filialiga qo'shildi", { branch: branchName }));
      } else if (movedGroups > 0) {
        showSuccess(t("Xona yangilandi — {n} ta guruh ham yangi nomga o'tdi", { n: movedGroups }));
      } else {
        showSuccess(room ? t("Xona yangilandi") : t("Xona qo'shildi"));
      }
      modal.close();
    } catch {
      showError(t("Serverga ulanib bo'lmadi"));
      setSaving(false);
    }
  }

  return (
    <Modal onClose={onClose} controller={modal} bare>
        <div className="px-6 pt-5 pb-2">
          <h3 className="text-[16px] font-semibold">{room ? t("Xonani tahrirlash") : t("Xona qo'shish")}</h3>
        </div>

        <div className="px-6 py-2 space-y-3.5">
          <div>
            <label className={labelCls}>{t("Filial")}</label>
            <Select
              value={branchValue}
              onChange={(v) => setBranch(v)}
              options={branches.map((b) => ({ value: String(b.id), label: b.name }))}
              placeholder={t("Filialni tanlang")}
              loading={branchesLoading}
              size="lg"
            />
          </div>
          <div>
            <label className={labelCls}>{t("Xona nomi")}</label>
            <input value={name} onChange={(e) => setName(e.target.value)} type="text" placeholder={t("Xona nomi")} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>{t("O'quvchi sig'imi")}</label>
            <input
              value={capacity}
              onChange={(e) => setCapacity(e.target.value)}
              type="number"
              min="0"
              placeholder={t("O'quvchi sig'imi")}
              className={inputCls}
            />
          </div>
          <div>
            <label className={labelCls}>{t("Izoh")}</label>
            <input value={note} onChange={(e) => setNote(e.target.value)} type="text" placeholder={t("Izoh")} className={inputCls} />
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-border">
          <button onClick={modal.close} className="inline-flex items-center h-9 px-4 rounded-lg border border-border bg-card hover:bg-secondary text-sm font-medium">
            {t("Orqaga")}
          </button>
          <button onClick={save} disabled={saving} className="inline-flex items-center h-9 px-5 rounded-lg bg-primary text-white text-sm font-medium hover:opacity-90 disabled:opacity-60">
            {saving ? t("Saqlanmoqda…") : t("Saqlash")}
          </button>
        </div>
      </Modal>
  );
}
