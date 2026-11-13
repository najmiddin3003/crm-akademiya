"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { useModalClose } from "@/components/ui/Modal";
import { useT } from "@/components/shared/Language";
import V2Dialog from "@/components/v2/form/V2Dialog";
import { Field, FieldError, TextInput } from "@/components/v2/form/fields";
import V2Select from "@/components/v2/ui/V2Select";
import { primaryBtn, secondaryBtn } from "@/components/v2/ui/buttons";
import { invalidateRooms } from "@/hooks/useRooms";
import type { OverviewBranch } from "@/lib/roomOccupancy";
import { roomBranchId, type Room } from "@/lib/rooms";

// YANGI VERSIYA — XONA QO'SHISH / TAHRIRLASH (23-qism «Sozlamalar · Xonalar»).
// Mantiq eski RoomModal'dan (components/groups/RoomModal.tsx): filial tanlanadi
// (sukut — sahifada tanlangan bino), tahrirda filial faqat O'ZGARGANDA yuboriladi
// (1+2 hovuzida hovuzdosh binodagi xona — qayta yuborilsa server ruxsat so'rardi),
// nom o'zgarsa server guruhlarni ham yangi nomga o'tkazadi (`movedGroups`).
// Server qoidalari o'zgarmagan: bir filialda bir xil nom — 409, ruxsatsiz filial — 403.
// Xato oyna ichida (toast pastki o'ngda «Saqlash» ustiga tushadi).

export interface RoomSaved {
  room: Room;
  /** Toast matni (oyna yopilgach sahifa ko'rsatadi). */
  message: string;
}

export default function RoomDialogV2({
  room,
  branches,
  allowed,
  defaultBranch,
  onClose,
  onSaved,
}: {
  room: Room | null;
  branches: OverviewBranch[];
  allowed: number[];
  defaultBranch: number;
  onClose: () => void;
  onSaved: (saved: RoomSaved) => void;
}) {
  const { t } = useT();
  const modal = useModalClose(onClose, "center");
  const ownBranch = room ? roomBranchId(room) : null;
  const [name, setName] = useState(room?.name ?? "");
  const [branch, setBranch] = useState(String(ownBranch ?? defaultBranch));
  const [capacity, setCapacity] = useState(room ? String(room.capacity || "") : "");
  const [note, setNote] = useState(room?.note ?? "");
  const [nameErr, setNameErr] = useState("");
  const [err, setErr] = useState("");
  const [saving, setSaving] = useState(false);

  // Ruxsat etilgan filiallar + xonaning o'z filiali (hovuzdosh bino ruxsat ro'yxatida bo'lmasligi mumkin).
  const options = branches
    .filter((b) => allowed.includes(b.id) || b.id === ownBranch)
    .map((b) => ({ value: String(b.id), label: b.name }));
  const nameOf = (id: number) => branches.find((b) => b.id === id)?.name ?? "";

  const dirty = room
    ? name.trim() !== room.name || branch !== String(ownBranch) || capacity !== String(room.capacity || "") || note.trim() !== (room.note ?? "")
    : Boolean(name.trim() || capacity || note.trim());

  async function submit() {
    const trimmed = name.trim();
    if (!trimmed) return setNameErr(t("Xona nomini kiriting"));
    if (!branch) return setErr(t("Filialni tanlang"));
    setErr("");
    setSaving(true);
    const branchChanged = !room || Number(branch) !== ownBranch;
    const payload = { name: trimmed, capacity: capacity.trim(), note: note.trim(), ...(branchChanged ? { branchId: Number(branch) } : {}) };
    try {
      const res = await fetch(room ? `/api/rooms/${room.id}` : "/api/rooms", {
        method: room ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) {
        setErr(t(data.error || "Saqlanmadi"));
        setSaving(false);
        return;
      }
      invalidateRooms();
      const saved = data.room as Room;
      const savedBranch = roomBranchId(saved);
      const movedGroups = Number(data.movedGroups) || 0;
      let message: string;
      if (room && savedBranch !== ownBranch) message = t("Xona «{branch}» filialiga o'tkazildi", { branch: nameOf(savedBranch) });
      else if (movedGroups > 0) message = t("Xona yangilandi — {n} ta guruh ham yangi nomga o'tdi", { n: movedGroups });
      else message = room ? t("Xona yangilandi") : t("Xona qo'shildi");
      onSaved({ room: saved, message });
      setSaving(false);
      modal.close();
    } catch {
      setErr(t("Serverga ulanib bo'lmadi"));
      setSaving(false);
    }
  }

  return (
    <V2Dialog
      title={room ? t("Xonani tahrirlash") : t("Xona qo'shish")}
      subtitle={room ? t("Nom o'zgarsa, shu xonadagi guruhlar ham yangi nomga o'tadi") : t("Dars jadvali va bandlik shu xona bo'yicha hisoblanadi")}
      onClose={onClose}
      controller={modal}
      dirty={dirty}
      saving={saving}
      onSubmit={() => void submit()}
      width={480}
      footer={(api) => (
        <>
          <button type="button" onClick={api.requestClose} disabled={saving} className={secondaryBtn}>
            {t("Bekor qilish")}
          </button>
          <button type="button" onClick={() => void submit()} disabled={saving} className={`${primaryBtn} disabled:opacity-60`}>
            {saving && <Loader2 className="size-4 animate-spin" strokeWidth={2} aria-hidden />}
            {room ? t("Saqlash") : t("Xona qo'shish")}
          </button>
        </>
      )}
    >
      <div className="space-y-4">
        <div className="grid grid-cols-1 gap-3 min-[30rem]:grid-cols-[1fr_8rem]">
          <Field label={t("Xona nomi")} htmlFor="room-v2-name" error={nameErr || undefined}>
            <TextInput
              id="room-v2-name"
              value={name}
              state={nameErr ? "error" : "default"}
              onChange={(e) => {
                setName(e.target.value);
                if (nameErr) setNameErr("");
              }}
              maxLength={60}
              placeholder={t("Masalan: 204-xona")}
              autoComplete="off"
            />
          </Field>
          <Field label={t("Sig'im")} htmlFor="room-v2-cap" hint={t("o'quvchi o'rni")}>
            <TextInput
              id="room-v2-cap"
              value={capacity}
              onChange={(e) => setCapacity(e.target.value.replace(/\D/g, "").slice(0, 3))}
              inputMode="numeric"
              placeholder="12"
              autoComplete="off"
            />
          </Field>
        </div>
        <Field label={t("Filial")} htmlFor="room-v2-branch">
          <V2Select id="room-v2-branch" label={t("Filial")} value={branch} options={options} onChange={(v) => v && setBranch(v)} clearable={false} placeholder={t("Filialni tanlang")} />
        </Field>
        <Field label={t("Izoh")} optional htmlFor="room-v2-note">
          <TextInput id="room-v2-note" value={note} onChange={(e) => setNote(e.target.value)} maxLength={200} placeholder={t("Masalan: proyektor bor, 2-qavat")} autoComplete="off" />
        </Field>
        {err && <FieldError>{err}</FieldError>}
      </div>
    </V2Dialog>
  );
}
