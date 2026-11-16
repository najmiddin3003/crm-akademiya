"use client";

import { useState } from "react";
import { useT } from "@/components/shared/Language";
import { useToast } from "@/components/ui/Toast";
import V2Dialog from "@/components/v2/form/V2Dialog";
import { Field, Segmented, TextInput } from "@/components/v2/form/fields";
import { primaryBtn, secondaryBtn } from "@/components/v2/ui/buttons";
import type { StudentListRow } from "@/lib/studentListsTypes";

// YANGI VERSIYA — «Manzil qo'shish / tahrirlash» (O'quvchilar manzillari, 30-qism). Rasm yo'q —
// Formalar qoidasi bo'yicha qisqa markaziy oyna. Saqlash — PATCH /api/pupils/:id (mahalla, address,
// addressLandmark, housing). Mahalla — erkin matn, bor mahallalar tavsiya sifatida.

export default function AddressDialogV2({
  row,
  mahallas,
  onClose,
  onSaved,
}: {
  row: StudentListRow;
  mahallas: string[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const { t } = useT();
  const { showError, showSuccess } = useToast();
  const [mahalla, setMahalla] = useState(row.mahalla);
  const [address, setAddress] = useState(row.address);
  const [landmark, setLandmark] = useState(row.landmark);
  const [housing, setHousing] = useState(row.housing || "Doimiy");
  const [saving, setSaving] = useState(false);
  const dirty = mahalla !== row.mahalla || address !== row.address || landmark !== row.landmark || housing !== (row.housing || "Doimiy");

  async function save(close: () => void) {
    if (!mahalla.trim() && !address.trim()) {
      showError(t("Mahalla yoki manzilni kiriting"));
      return;
    }
    setSaving(true);
    const res = await fetch(`/api/pupils/${row.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mahalla: mahalla.trim(), address: address.trim(), addressLandmark: landmark.trim(), housing }),
    })
      .then((r) => r.json())
      .catch(() => null);
    setSaving(false);
    if (!res?.ok) {
      showError(res?.error || t("Saqlab bo'lmadi"));
      return;
    }
    showSuccess(t("Manzil saqlandi"));
    onSaved();
    close();
  }

  return (
    <V2Dialog
      title={row.address || row.mahalla ? t("Manzilni tahrirlash") : t("Manzil qo'shish")}
      subtitle={row.name}
      onClose={onClose}
      dirty={dirty}
      saving={saving}
      width={480}
      footer={(api) => (
        <>
          <button type="button" onClick={api.requestClose} disabled={saving} className={secondaryBtn}>
            {t("Bekor qilish")}
          </button>
          <button type="button" onClick={() => void save(api.close)} disabled={saving} className={`${primaryBtn} disabled:opacity-50`}>
            {t("Saqlash")}
          </button>
        </>
      )}
    >
      <div className="space-y-4">
        <Field label={t("Mahalla")} htmlFor="addr-mahalla">
          <TextInput id="addr-mahalla" list="addr-mahalla-list" value={mahalla} onChange={(e) => setMahalla(e.target.value)} placeholder={t("Masalan: Navbahor")} />
          <datalist id="addr-mahalla-list">
            {mahallas.map((m) => (
              <option key={m} value={m} />
            ))}
          </datalist>
        </Field>
        <Field label={t("Manzil")} htmlFor="addr-street">
          <TextInput id="addr-street" value={address} onChange={(e) => setAddress(e.target.value)} placeholder={t("Ko'cha, uy, xonadon")} />
        </Field>
        <Field label={t("Mo'ljal")} optional htmlFor="addr-landmark">
          <TextInput id="addr-landmark" value={landmark} onChange={(e) => setLandmark(e.target.value)} placeholder={t("Masalan: 21-maktab yonida")} />
        </Field>
        <Field label={t("Turi")}>
          <Segmented
            label={t("Turi")}
            value={housing}
            onChange={setHousing}
            options={[
              { value: "Doimiy", label: t("Doimiy") },
              { value: "Ijara", label: t("Ijara") },
            ]}
          />
        </Field>
      </div>
    </V2Dialog>
  );
}
