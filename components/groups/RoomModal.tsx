"use client";

import { invalidateRooms } from "@/hooks/useRooms";
import { useState } from "react";
import { useToast } from "@/components/ui/Toast";
import type { Room } from "@/lib/rooms";
import Modal, { useModalClose } from "@/components/ui/Modal";

// Xona qo'shish / tahrirlash modali (Guruh → Xonalar, skrinshot 2/3).
// `room` berilsa — tahrirlash (PATCH /api/rooms/:id), aks holda qo'shish
// (POST /api/rooms).
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
  const modal = useModalClose(onClose);
  const { showSuccess, showError } = useToast();
  const [name, setName] = useState(room?.name || "");
  const [capacity, setCapacity] = useState(room ? String(room.capacity) : "");
  const [note, setNote] = useState(room?.note || "");
  const [saving, setSaving] = useState(false);

  async function save() {
    const trimmed = name.trim();
    if (!trimmed) {
      showError("Xona nomini kiriting");
      return;
    }
    setSaving(true);
    const payload = { name: trimmed, capacity, note: note.trim() };
    const url = room ? `/api/rooms/${room.id}` : "/api/rooms";
    const method = room ? "PATCH" : "POST";
    try {
      const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const data = await res.json();
      if (!data.ok) {
        showError(data.error || "Saqlanmadi");
        setSaving(false);
        return;
      }
      // Kesh bekor qilinadi: keyin mount bo'ladigan iste'molchilar
      // yangi ro'yxatni oladi (lib/referenceCache.ts).
      invalidateRooms();
      onSaved(data.room as Room);
      showSuccess(room ? "Xona yangilandi" : "Xona qo'shildi");
      modal.close();
    } catch {
      showError("Serverga ulanib bo'lmadi");
      setSaving(false);
    }
  }

  return (
    <Modal onClose={onClose} controller={modal} bare>
        <div className="px-6 pt-5 pb-2">
          <h3 className="text-[16px] font-semibold">{room ? "Xonani tahrirlash" : "Xona qo'shish"}</h3>
        </div>

        <div className="px-6 py-2 space-y-3.5">
          <div>
            <label className={labelCls}>Xona nomi</label>
            <input value={name} onChange={(e) => setName(e.target.value)} type="text" placeholder="Xona nomi" className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>O&apos;quvchi sig&apos;imi</label>
            <input
              value={capacity}
              onChange={(e) => setCapacity(e.target.value)}
              type="number"
              min="0"
              placeholder="O'quvchi sig'imi"
              className={inputCls}
            />
          </div>
          <div>
            <label className={labelCls}>Izoh</label>
            <input value={note} onChange={(e) => setNote(e.target.value)} type="text" placeholder="Izoh" className={inputCls} />
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
