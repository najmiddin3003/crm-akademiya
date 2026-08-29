"use client";

import { useState } from "react";
import { useEscapeClose } from "@/hooks/useEscapeClose";
import { useToast } from "@/components/ui/Toast";
import { useBranches } from "@/hooks/useBranches";
import type { HrEmployee } from "@/lib/hrEmployees";

// Xodim profilidagi "Tahrirlash" tugmasi ochadigan oyna.
//
// Ilgari profil sahifasida xodimning O'ZINI tahrirlash imkoni yo'q edi:
// to'rtinchi tugma ish haqi sozlamasini ochardi, "Parol qo'shish" esa
// shunchaki demo toast chiqarardi. Bu oyna PATCH /api/hr-employees/:id
// orqali asosiy maydonlarni yangilaydi.

const ROLES: { value: string; label: string }[] = [
  { value: "teacher", label: "O'qituvchi" },
  { value: "moderator", label: "Moderator" },
  { value: "admin", label: "Administrator" },
];

const GENDERS: { value: string; label: string }[] = [
  { value: "male", label: "Erkak" },
  { value: "female", label: "Ayol" },
];

const inputCls =
  "w-full h-11 px-3 rounded-lg border border-border bg-secondary/30 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40";

export default function EmployeeProfileEditModal({
  employee,
  onClose,
  onSaved,
}: {
  employee: HrEmployee;
  onClose: () => void;
  onSaved: (emp: HrEmployee) => void;
}) {
  useEscapeClose(onClose);
  const { showSuccess, showError } = useToast();
  const { branches } = useBranches();

  const [name, setName] = useState(employee.name ?? "");
  const [phone, setPhone] = useState(employee.phone ?? "");
  const [turi, setTuri] = useState(employee.turi ?? "teacher");
  const [gender, setGender] = useState(employee.gender ?? "male");
  const [filial, setFilial] = useState(employee.filial ?? "");
  const [email, setEmail] = useState(employee.email ?? "");
  const [kurs, setKurs] = useState(employee.kurs ?? "");
  const [degree, setDegree] = useState(employee.degree ?? "");
  const [percent, setPercent] = useState(employee.percent ?? "");
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!name.trim()) {
      showError("Ism majburiy");
      return;
    }
    setSaving(true);
    const res = await fetch(`/api/hr-employees/${employee.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: name.trim(), phone: phone.trim(), turi, gender,
        filial, email: email.trim(), kurs: kurs.trim(),
        degree: degree.trim(), percent: percent.trim(),
      }),
    }).then((r) => r.json()).catch(() => null);
    setSaving(false);
    if (!res?.ok) {
      showError(res?.error || "Saqlashda xatolik yuz berdi");
      return;
    }
    showSuccess("Xodim ma'lumotlari saqlandi");
    onSaved(res.employee as HrEmployee);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div
        className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl border border-border bg-card p-5 shadow-2xl space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-lg font-semibold">Xodimni tahrirlash</h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-[13px] font-medium mb-1.5">F.I.SH.</label>
            <input value={name} onChange={(e) => setName(e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className="block text-[13px] font-medium mb-1.5">Telefon</label>
            <input value={phone} onChange={(e) => setPhone(e.target.value)} className={`${inputCls} tabular-nums`} />
          </div>
          <div>
            <label className="block text-[13px] font-medium mb-1.5">Lavozimi</label>
            <select value={turi} onChange={(e) => setTuri(e.target.value)} className={inputCls}>
              {ROLES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
            </select>
            <p className="mt-1 text-[11.5px] text-muted-foreground">
              Xodim qaysi bo&apos;limlarni ko&apos;rishi ham shu lavozimdan olinadi
              (Boshqaruv → Rollar). Alohida xodimga ruxsat berilmaydi.
            </p>
          </div>
          <div>
            <label className="block text-[13px] font-medium mb-1.5">Jinsi</label>
            <select value={gender} onChange={(e) => setGender(e.target.value)} className={inputCls}>
              {GENDERS.map((g) => <option key={g.value} value={g.value}>{g.label}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-[13px] font-medium mb-1.5">Filial</label>
            <select value={filial} onChange={(e) => setFilial(e.target.value)} className={inputCls}>
              <option value="">Tanlang</option>
              {branches.map((b) => <option key={b.id} value={b.name}>{b.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-[13px] font-medium mb-1.5">Elektron pochta</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={inputCls} />
          </div>
        </div>

        {/* Quyidagilar referensda ham faqat o'qituvchida to'ldiriladi. */}
        {turi === "teacher" && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-[13px] font-medium mb-1.5">Kurs</label>
              <input value={kurs} onChange={(e) => setKurs(e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className="block text-[13px] font-medium mb-1.5">Darajasi</label>
              <input value={degree} onChange={(e) => setDegree(e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className="block text-[13px] font-medium mb-1.5">Oladigan foizi</label>
              <input value={percent} onChange={(e) => setPercent(e.target.value)} className={`${inputCls} tabular-nums`} />
            </div>
          </div>
        )}

        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="h-10 rounded-lg border border-border bg-card px-5 text-sm hover:bg-secondary">
            Bekor qilish
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={save}
            className="h-10 rounded-lg bg-primary px-5 text-sm font-medium text-white hover:opacity-90 disabled:opacity-60"
          >
            {saving ? "Saqlanmoqda..." : "Saqlash"}
          </button>
        </div>
      </div>
    </div>
  );
}
