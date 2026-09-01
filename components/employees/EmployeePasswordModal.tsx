"use client";

import { useEffect, useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { useToast } from "@/components/ui/Toast";
import { useEscapeClose } from "@/hooks/useEscapeClose";
import type { HrEmployeeFull } from "./employeeExtras";

// Xodim profilidagi PAROL oynasi (chap kartadagi kalit ikonkasi).
//
// Joriy parol ko'rsatiladi va admin yangisini qo'yadi.
// Manba: /api/hr-employees/:id/password (faqat administrator uchun).
//
// `onSaved` KERAK EMAS: parol `users` hujjatida, `hr_employees` esa
// o'zgarmaydi — profil sahifasida yangilanadigan holat yo'q.

const inputCls =
  "w-full h-10 rounded-lg border border-border bg-card px-3 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40";

interface PasswordInfo {
  hasAccount: boolean;
  status: string | null;
  hasPassword: boolean;
  password: string | null;
}

export default function EmployeePasswordModal({
  employee,
  onClose,
}: {
  employee: HrEmployeeFull;
  onClose: () => void;
}) {
  useEscapeClose(onClose);
  const { showSuccess, showError } = useToast();
  const [info, setInfo] = useState<PasswordInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  // Parol YOPIQ ochiladi. Profil sahifasi ochiq ofisda, proyektorda va
  // skrinshotda ko'rinadi — uni o'z-o'zidan ochib qo'yish keraksiz xavf.
  const [shown, setShown] = useState(false);
  const [next, setNext] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/hr-employees/${employee.id}/password`)
      .then((r) => r.json())
      .then((d) => {
        if (cancelled) return;
        if (d?.ok) setInfo(d as PasswordInfo);
        else setFailed(true);
      })
      .catch(() => { if (!cancelled) setFailed(true); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [employee.id]);

  async function save() {
    if (next.length < 8) {
      showError("Parol kamida 8 ta belgidan iborat bo'lsin");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/hr-employees/${employee.id}/password`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: next }),
      });
      const d = await res.json();
      if (!d.ok) {
        showError(d.error || "Parol o'zgartirilmadi");
        setSaving(false);
        return;
      }
      showSuccess("Parol o'zgartirildi");
      onClose();
    } catch {
      showError("Serverga ulanib bo'lmadi");
      setSaving(false);
    }
  }

  // Joriy parol o'rnida nima yozilishi — uch xil holat uchun uch xil javob.
  const current = (() => {
    if (loading) return { text: "Yuklanmoqda…", muted: true };
    if (failed) return { text: "O'qib bo'lmadi", muted: true };
    if (!info?.hasAccount) return { text: "Tizim hisobi yo'q", muted: true };
    if (!info.hasPassword) return { text: "Parol hali o'rnatilmagan", muted: true };
    if (info.password === null) return { text: "Parolni o'qib bo'lmadi (shifrlash kaliti mos emas)", muted: true };
    return { text: info.password, muted: false };
  })();

  const noAccount = !loading && !failed && info?.hasAccount === false;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-sm rounded-2xl bg-card border border-border shadow-2xl">
        <div className="px-6 py-4 border-b border-border">
          <h3 className="text-[16px] font-semibold">Parol</h3>
          <p className="text-[12px] text-muted-foreground mt-0.5">{employee.name}</p>
        </div>

        <div className="p-6 space-y-4">
          {noAccount && (
            <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-[12px] text-amber-700">
              Bu xodimda tizim hisobi yo&apos;q — avval unga faollashtirish taklifi yuborilishi kerak.
            </div>
          )}

          <div>
            <label className="block text-[13px] font-medium mb-1.5">Joriy parol</label>
            <div className="relative">
              <input
                type={shown ? "text" : "password"}
                value={current.muted ? "" : current.text}
                placeholder={current.muted ? current.text : undefined}
                readOnly
                className={`${inputCls} ${current.muted ? "text-muted-foreground" : ""}`}
              />
              {!current.muted && (
                <button
                  type="button"
                  onClick={() => setShown((v) => !v)}
                  title={shown ? "Yashirish" : "Ko'rsatish"}
                  className="absolute right-2 top-1/2 -translate-y-1/2 h-7 w-7 rounded-md hover:bg-secondary inline-flex items-center justify-center text-muted-foreground"
                >
                  {shown ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              )}
            </div>
          </div>

          <div>
            <label className="block text-[13px] font-medium mb-1.5">Yangi parol</label>
            <input
              type="text"
              value={next}
              onChange={(e) => setNext(e.target.value)}
              disabled={noAccount}
              placeholder="Kamida 8 ta belgi"
              className={`${inputCls} disabled:opacity-60`}
            />
            {info?.status === "invited" && (
              <p className="mt-1 text-[11px] text-muted-foreground">
                Xodim hali faollashtirilmagan. Parol qo&apos;yilsa hisob darhol ishlaydi va yuborilgan taklif kuchini yo&apos;qotadi.
              </p>
            )}
          </div>
        </div>

        <div className="px-6 py-4 border-t border-border flex justify-end gap-2">
          <button onClick={onClose} className="h-10 px-4 rounded-lg border border-border bg-card text-sm font-medium hover:bg-secondary">
            Orqaga
          </button>
          <button
            onClick={save}
            disabled={saving || noAccount}
            className="h-10 px-6 rounded-lg bg-primary text-white text-sm font-medium hover:opacity-90 disabled:opacity-60"
          >
            {saving ? "Saqlanmoqda…" : "Saqlash"}
          </button>
        </div>
      </div>
    </div>
  );
}
