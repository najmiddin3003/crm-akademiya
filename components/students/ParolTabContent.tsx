"use client";

import { useEffect, useState } from "react";
import { useToast } from "@/components/ui/Toast";

// O'quvchi profili → "Parol o'rnatish".
//
// Ilgari "Saqlash" tugmasi hech nima qilmasdi va parol maydonida soxta
// "password123" turardi. Endi login/parol POST /api/pupils/:id/password
// orqali saqlanadi: parolning O'ZI emas, bcrypt xeshi yoziladi va u hech
// qachon qaytarilmaydi — shu bois maydon bo'sh ochiladi, "parol
// o'rnatilgan" holati alohida ko'rsatiladi.

interface RoleState {
  login: string;
  hasPassword: boolean;
}

export default function ParolTabContent({ login, pupilId }: { login: string; pupilId?: number }) {
  const { showSuccess, showError } = useToast();
  const [sub, setSub] = useState<"oquvchi" | "otaona">("oquvchi");
  const [saved, setSaved] = useState<{ student: RoleState; parent: RoleState } | null>(null);
  // Har rol uchun alohida qoralama. Effekt bilan sinxronlash o'rniga
  // hosila qiymat: rol almashganda o'sha rolning qiymati ko'rinadi va
  // ikkinchi roldagi yozilgan matn yo'qolmaydi.
  const [drafts, setDrafts] = useState<Record<string, { login: string; password: string }>>({});
  const [saving, setSaving] = useState(false);

  const role = sub === "oquvchi" ? "student" : "parent";

  useEffect(() => {
    if (!pupilId) return;
    let alive = true;
    fetch(`/api/pupils/${pupilId}/password`)
      .then((r) => r.json())
      .then((d) => { if (alive && d.ok) setSaved({ student: d.student, parent: d.parent }); })
      .catch(() => {});
    return () => { alive = false; };
  }, [pupilId]);

  const current = saved?.[role as "student" | "parent"];
  const draft = drafts[role] ?? {
    login: current?.login || (role === "student" ? login : ""),
    password: "",
  };
  const patchDraft = (p: Partial<{ login: string; password: string }>) =>
    setDrafts((d) => ({ ...d, [role]: { ...draft, ...p } }));
  const loginValue = draft.login;
  const password = draft.password;

  const save = async () => {
    if (!pupilId) return;
    if (!loginValue.trim()) {
      showError("Login majburiy");
      return;
    }
    setSaving(true);
    const res = await fetch(`/api/pupils/${pupilId}/password`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role, login: loginValue.trim(), password }),
    }).then((r) => r.json()).catch(() => null);
    setSaving(false);
    if (!res?.ok) {
      showError(res?.error || "Saqlashda xatolik yuz berdi");
      return;
    }
    setSaved((prev) => ({
      student: role === "student" ? { login: res.login, hasPassword: res.passwordChanged || Boolean(prev?.student.hasPassword) } : prev!.student,
      parent: role === "parent" ? { login: res.login, hasPassword: res.passwordChanged || Boolean(prev?.parent.hasPassword) } : prev!.parent,
    }));
    patchDraft({ password: "" });
    showSuccess(res.passwordChanged ? "Login va parol saqlandi" : "Login saqlandi");
  };

  const pill = (active: boolean) =>
    `h-9 px-4 rounded-lg text-sm font-medium transition-colors ${
      active ? "bg-primary text-white" : "bg-secondary/40 hover:bg-secondary/70 text-foreground/80"
    }`;

  return (
    <div className="rounded-2xl bg-card border border-border p-5">
      <div className="flex gap-2 mb-5">
        <button type="button" onClick={() => setSub("oquvchi")} className={pill(sub === "oquvchi")}>
          O&apos;quvchi
        </button>
        <button type="button" onClick={() => setSub("otaona")} className={pill(sub === "otaona")}>
          Ota-ona
        </button>
      </div>

      <div className="space-y-4 max-w-3xl">
        {!pupilId && (
          <div className="rounded-lg border border-amber-400/50 bg-amber-500/10 px-4 py-3 text-[13px]">
            Bu yozuv o&apos;quvchilar bazasida topilmadi — kirish ma&apos;lumotlarini saqlab bo&apos;lmaydi.
          </div>
        )}

        <div>
          <label className="block text-[13px] font-medium mb-1.5">Login</label>
          <input
            type="text"
            value={loginValue}
            onChange={(e) => patchDraft({ login: e.target.value })}
            className="w-full h-11 px-3 rounded-lg border border-border bg-secondary/30 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
          />
        </div>

        <div>
          <label className="block text-[13px] font-medium mb-1.5">
            Parol
            {current?.hasPassword && (
              <span className="ml-2 text-[12px] font-normal text-emerald-600">• o&apos;rnatilgan</span>
            )}
          </label>
          <input
            type="password"
            value={password}
            onChange={(e) => patchDraft({ password: e.target.value })}
            placeholder={current?.hasPassword ? "O'zgartirish uchun yangi parol" : "Kamida 6 belgi"}
            className="w-full h-11 px-3 rounded-lg border border-border bg-secondary/30 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
          />
          <p className="mt-1.5 text-[12px] text-muted-foreground">
            Parol shifrlangan holda saqlanadi va qayta ko&apos;rsatilmaydi. Bo&apos;sh qoldirsangiz
            faqat login yangilanadi.
          </p>
        </div>

        <div className="flex justify-end">
          <button
            type="button"
            disabled={!pupilId || saving}
            onClick={save}
            className="inline-flex items-center h-10 px-5 rounded-lg bg-primary text-white text-sm font-medium hover:opacity-90 disabled:opacity-50 disabled:pointer-events-none"
          >
            {saving ? "Saqlanmoqda..." : "Saqlash"}
          </button>
        </div>
      </div>
    </div>
  );
}
