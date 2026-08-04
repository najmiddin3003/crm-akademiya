"use client";

import { useEffect, useState } from "react";
import Button from "@/components/ui/Button";
import { useEscapeClose } from "@/hooks/useEscapeClose";
import PhoneField from "@/components/auth/PhoneField";

export interface EmployeeEditRow {
  id: string;
  fullName: string;
  phone: string;
  position: string | null;
  status: "invited" | "active" | "frozen" | "blocked";
}

const STATUS_OPTIONS: { key: EmployeeEditRow["status"]; label: string }[] = [
  { key: "active", label: "Faol" },
  { key: "frozen", label: "Muzlatilgan" },
  { key: "blocked", label: "Bloklangan" },
];

export interface EmployeeEditModalProps {
  employee: EmployeeEditRow;
  onClose: () => void;
  onSaved: () => void;
}

// Admin uchun xodimni to'liq tahrirlash: F.I.Sh./telefon/lavozim, holat
// (faol/muzlatilgan/bloklangan) va yangi parol o'rnatish. Joriy parol
// (agar o'rnatilgan bo'lsa) yangisini qo'yishdan oldin ko'rsatiladi.
// O'chirish endi jadval qatoridagi ikonka orqali amalga oshiriladi.
export default function EmployeeEditModal({ employee, onClose, onSaved }: EmployeeEditModalProps) {
  const [fullName, setFullName] = useState(employee.fullName);
  const [phone, setPhone] = useState(employee.phone.startsWith("998") ? employee.phone.slice(3) : employee.phone);
  const [position, setPosition] = useState(employee.position || "");
  const [status, setStatus] = useState<EmployeeEditRow["status"]>(
    employee.status === "invited" ? "active" : employee.status
  );
  const [newPassword, setNewPassword] = useState("");

  const [currentPassword, setCurrentPassword] = useState<string | null>(null);
  const [passwordLoading, setPasswordLoading] = useState(employee.status !== "invited");
  const [passwordVisible, setPasswordVisible] = useState(true);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEscapeClose(onClose);

  useEffect(() => {
    if (employee.status === "invited") return;
    let active = true;
    (async () => {
      try {
        const res = await fetch(`/api/employees/${employee.id}/password`);
        const data = await res.json();
        if (active && data.ok) setCurrentPassword(data.password);
      } finally {
        if (active) setPasswordLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [employee.id, employee.status]);

  const handleSave = async () => {
    setError("");
    if (!fullName.trim()) {
      setError("F.I.Sh. kiriting");
      return;
    }
    if (phone.length < 9) {
      setError("To'liq telefon raqamni kiriting");
      return;
    }
    if (newPassword && newPassword.length < 8) {
      setError("Yangi parol kamida 8 ta belgidan iborat bo'lishi kerak");
      return;
    }

    const body: Record<string, string> = {
      fullName: fullName.trim(),
      phone,
      position,
    };
    if (employee.status !== "invited") body.status = status;
    if (newPassword) body.new_password = newPassword;

    setSaving(true);
    try {
      const res = await fetch(`/api/employees/${employee.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setError(data.error || "Saqlanmadi");
        return;
      }
      onSaved();
    } catch {
      setError("Serverga ulanib bo'lmadi");
    } finally {
      setSaving(false);
    }
  };

  const inputCls =
    "h-9 w-full rounded-lg border border-border bg-background px-3 text-sm outline-none focus:border-primary";

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div
        className="w-full max-w-md rounded-2xl border border-border bg-card shadow-2xl p-5 space-y-4 max-h-[92vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-lg font-semibold">Xodimni tahrirlash</h3>

        <div>
          <label className="mb-1.5 block text-[13px] font-medium text-foreground/80">F.I.Sh.</label>
          <input className={inputCls} value={fullName} onChange={(e) => setFullName(e.target.value)} />
        </div>

        <PhoneField value={phone} onChange={setPhone} />

        <div>
          <label className="mb-1.5 block text-[13px] font-medium text-foreground/80">Lavozim</label>
          <input className={inputCls} value={position} onChange={(e) => setPosition(e.target.value)} />
        </div>

        {employee.status !== "invited" && (
          <div>
            <label className="mb-1.5 block text-[13px] font-medium text-foreground/80">Holat</label>
            <div className="grid grid-cols-3 gap-2">
              {STATUS_OPTIONS.map((opt) => (
                <button
                  key={opt.key}
                  type="button"
                  onClick={() => setStatus(opt.key)}
                  className={`h-9 rounded-lg border text-[13px] font-medium ${
                    status === opt.key ? "border-primary bg-primary/10 text-primary" : "border-border bg-background hover:bg-secondary"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        )}

        <div>
          <label className="mb-1.5 block text-[13px] font-medium text-foreground/80">Joriy parol</label>
          {employee.status === "invited" ? (
            <p className="text-[13px] text-muted-foreground">Hali parol o&apos;rnatilmagan (taklif kutilmoqda)</p>
          ) : (
            <div className="relative">
              <input
                readOnly
                type={passwordVisible ? "text" : "password"}
                className={`${inputCls} pr-10`}
                value={passwordLoading ? "Yuklanmoqda..." : currentPassword || "—"}
              />
              {!passwordLoading && currentPassword && (
                <button
                  type="button"
                  onClick={() => setPasswordVisible((v) => !v)}
                  className="absolute right-0 top-0 flex h-9 w-9 items-center justify-center text-muted-foreground hover:text-foreground"
                  title={passwordVisible ? "Yashirish" : "Ko'rsatish"}
                >
                  {passwordVisible ? (
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
                      <path d="M17.94 17.94A10.94 10.94 0 0 1 12 20c-7 0-11-8-11-8a21.6 21.6 0 0 1 5.06-6.06M9.9 4.24A10.4 10.4 0 0 1 12 4c7 0 11 8 11 8a21.6 21.6 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                      <line x1="1" y1="1" x2="23" y2="23" />
                    </svg>
                  ) : (
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                  )}
                </button>
              )}
            </div>
          )}
        </div>

        <div>
          <label className="mb-1.5 block text-[13px] font-medium text-foreground/80">Yangi parol</label>
          <input
            type="text"
            className={inputCls}
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder="Bo'sh qoldirsa parol o'zgarmaydi"
          />
        </div>

        {error && <div className="text-sm text-red-600">⚠ {error}</div>}

        <div className="flex items-center justify-end gap-2 pt-1">
          <Button type="button" variant="outline" onClick={onClose} disabled={saving}>
            Bekor qilish
          </Button>
          <Button type="button" variant="primary" onClick={handleSave} disabled={saving}>
            {saving ? "Saqlanmoqda..." : "Saqlash"}
          </Button>
        </div>
      </div>
    </div>
  );
}
