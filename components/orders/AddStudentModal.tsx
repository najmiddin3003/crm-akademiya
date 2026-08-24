"use client";

import { useState } from "react";
import Button from "@/components/ui/Button";
import PanelSelect from "@/components/orders/PanelSelect";
import { useEscapeClose } from "@/hooks/useEscapeClose";
import { usePupils } from "@/components/orders/PupilsContext";
import { useToast } from "@/components/ui/Toast";
import { useSettingsListNames } from "@/hooks/useSettingsList";
import { STUDENT_CATEGORIES } from "@/constants";
import type { Pupil } from "@/lib/pupilsData";

// "O'quvchi qo'shish" tugmasi bosilganda ochiladigan alohida modal — akademiya.edutizim.uz
// dagi "Yangi buyurtma" panelining o'zida joylashgan xuddi shu nomdagi tugma ortidan
// chiqqan referens skrinshotga mos. Bu modal AddOrderModal ustidan (undan yuqori
// z-index bilan) ochiladi, drawer esa orqada ochiq qoladi.
//
// "Saqlash" bosilganda POST /api/pupils orqali MongoDB'ga ("pupils" kolleksiyasi)
// haqiqiy saqlanadi — natijada qaytgan Pupil ota komponentga uzatiladi.

// +998 doim ko'rinib turadi va o'chirib bo'lmaydi (components/auth/PhoneField.tsx
// bilan bir xil g'oya — prefiks alohida <span>, inputning qiymati emas), lekin
// bu yerda ilovaning boshqa joylarida ishlatiladigan "94 408 57 97" formatida
// (bo'sh joy bilan ajratilgan) ko'rsatiladi, auth sahifalaridagi qavs-chizilgan
// "(94) 408-57-97" formatidan farqli o'laroq.
function formatLocalPhone(digits: string): string {
  const d = digits.slice(0, 9);
  const p1 = d.slice(0, 2);
  const p2 = d.slice(2, 5);
  const p3 = d.slice(5, 7);
  const p4 = d.slice(7, 9);
  return [p1, p2, p3, p4].filter(Boolean).join(" ");
}

function PhoneInput({ label, value, onChange }: { label: string; value: string; onChange: (digits: string) => void }) {
  return (
    <div>
      <label className="block text-[13px] font-medium mb-1.5">{label}</label>
      <div className="auth-phone">
        <span className="auth-phone-prefix">+998</span>
        <input
          type="tel"
          inputMode="numeric"
          value={formatLocalPhone(value)}
          onChange={(e) => onChange(e.target.value.replace(/\D/g, "").slice(0, 9))}
          placeholder="94 408 57 97"
          className="auth-phone-input"
        />
      </div>
    </div>
  );
}

export interface AddStudentModalProps {
  onClose: () => void;
  onSave: (pupil: Pupil) => void;
}

export default function AddStudentModal({ onClose, onSave }: AddStudentModalProps) {
  // O'quvchi kategoriyalari — Sozlamalar → Sotuv va marketing → Kategoriya.
  // Sozlamada ro'yxat bo'sh bo'lsa constants'dagi standart uchlik ishlatiladi.
  const { names: categoryNames } = useSettingsListNames("student-categories", STUDENT_CATEGORIES);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [category, setCategory] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [showExtra, setShowExtra] = useState(false);
  const [extraPhone, setExtraPhone] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const { createPupil } = usePupils();
  const { showSuccess, showError } = useToast();
  useEscapeClose(onClose);

  const handleSave = async () => {
    if (!firstName.trim()) {
      setError("Ism majburiy");
      return;
    }
    setSaving(true);
    setError(null);
    const pupil = await createPupil({
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      phone: formatLocalPhone(phone),
      extraPhone: showExtra ? formatLocalPhone(extraPhone) : "",
      category,
      birthDate,
    });
    setSaving(false);
    if (!pupil) {
      setError("Saqlashda xatolik yuz berdi");
      showError("O'quvchi qo'shishda xatolik yuz berdi");
      return;
    }
    showSuccess("O'quvchi muvaffaqiyatli qo'shildi");
    onSave(pupil);
  };

  return (
    <div
      className="fixed inset-0 flex items-center justify-center bg-black/50 p-4"
      style={{ zIndex: 1100 }}
      onClick={(e) => {
        e.stopPropagation();
        onClose();
      }}
    >
      <div
        className="w-full max-w-md rounded-2xl border border-border bg-card shadow-2xl p-5 space-y-4 max-h-[92vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div>
          <h3 className="text-lg font-semibold">Yangi o&apos;quvchi qo&apos;shish</h3>
          <p className="text-xs text-muted-foreground mt-1">* Zarurligini bildiradi</p>
        </div>

        <div>
          <label className="block text-[13px] font-medium mb-1.5">
            Ism<span className="text-red-500"> *</span>
          </label>
          <input
            value={firstName}
            onChange={(e) => {
              setFirstName(e.target.value);
              setError(null);
            }}
            placeholder="Ism"
            className={`h-11 w-full rounded-lg border bg-secondary/30 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 ${error === "Ism majburiy" ? "border-red-400 ring-2 ring-red-400" : "border-border"}`}
          />
        </div>

        <div>
          <label className="block text-[13px] font-medium mb-1.5">Familiya</label>
          <input
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            placeholder="Familiya"
            className="h-11 w-full rounded-lg border border-border bg-secondary/30 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
          />
        </div>

        <PhoneInput label="Telefon raqam" value={phone} onChange={setPhone} />

        <PanelSelect label="Kategoriyani tanlang" value={category} onChange={setCategory} options={categoryNames} placeholder="Kategoriyani tanlang" />

        <div>
          <label className="block text-[13px] font-medium mb-1.5">Tug&apos;ilgan sanasi</label>
          <input
            type="date"
            value={birthDate}
            onChange={(e) => setBirthDate(e.target.value)}
            className="w-full h-11 px-3 rounded-lg border border-border bg-secondary/30 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
          />
        </div>

        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <input
            type="checkbox"
            checked={showExtra}
            onChange={(e) => setShowExtra(e.target.checked)}
            className="h-4 w-4 rounded border-border"
          />
          Qo&apos;shimcha ma&apos;lumotlar
        </label>

        {showExtra && <PhoneInput label="Qo'shimcha telefon raqam" value={extraPhone} onChange={setExtraPhone} />}

        {error && error !== "Ism majburiy" && <div className="text-sm text-red-600">⚠ {error}</div>}

        <div className="flex justify-end gap-2 pt-1">
          <Button variant="outline" onClick={onClose}>
            Orqaga
          </Button>
          <Button variant="primary" onClick={handleSave} disabled={saving}>
            {saving ? "Saqlanmoqda..." : "Saqlash"}
          </Button>
        </div>
      </div>
    </div>
  );
}
