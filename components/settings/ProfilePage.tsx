"use client";

import { useEffect, useState } from "react";
import { useToast } from "@/components/ui/Toast";
import { SpinnerBlock } from "@/components/ui/Spinner";
import { useT } from "@/components/shared/Language";

// Sozlamalar → "Profil".
// Joriy foydalanuvchining o'z ma'lumotlari (/api/profile). Faqat to'liq ism
// tahrirlanadi: telefon — login identifikatori, rol esa admin tomonidan
// beriladi, shuning uchun ikkalasi ham disabled ko'rsatiladi.

interface Profile {
  fullName: string;
  phone: string;
  role: string;
}

// Ichki rol qiymati → ko'rinadigan o'zbekcha nom (constants/employees.js
// dagi ROLE_LABELS bilan bir xil yozuv, `employee` qo'shilgan).
const ROLE_LABELS: Record<string, string> = {
  admin: "Administrator",
  moderator: "Moderator",
  teacher: "O'qituvchi",
  employee: "Xodim",
};

export default function ProfilePage() {
  const { t } = useT();
  const { showSuccess, showError } = useToast();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [fullName, setFullName] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/profile")
      .then(async (r) => ({ status: r.status, data: await r.json() }))
      .then(({ status, data }) => {
        if (cancelled) return;
        if (status === 401) {
          showError(t("Avtorizatsiya kerak"));
          return;
        }
        if (!data.ok) {
          showError(t(data.error || "Profilni yuklab bo'lmadi"));
          return;
        }
        setProfile(data.profile as Profile);
        setFullName((data.profile as Profile).fullName || "");
      })
      .catch(() => {
        if (!cancelled) showError(t("Serverga ulanib bo'lmadi"));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [showError, t]);

  const save = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fullName }),
      });
      if (res.status === 401) {
        showError(t("Avtorizatsiya kerak"));
        return;
      }
      const data = await res.json();
      if (!data.ok) {
        showError(t(data.error || "Saqlanmadi"));
        return;
      }
      // Yuqoridagi doira va ism serverdagi qiymat bilan bir xil turishi uchun.
      setProfile((p) => (p ? { ...p, fullName: fullName.trim() } : p));
      setFullName((v) => v.trim());
      showSuccess(t("Profil saqlandi"));
    } catch {
      showError(t("Serverga ulanib bo'lmadi"));
    } finally {
      setSaving(false);
    }
  };

  const initial = (profile?.fullName || "").trim().charAt(0).toUpperCase() || "?";
  const roleLabel = profile ? ROLE_LABELS[profile.role] || profile.role : "";

  return (
    <div className="page-frame container mx-auto max-w-[720px] p-5 space-y-4">
      <h1 className="text-[18px] font-bold tracking-tight">{t("Profil")}</h1>

      {loading ? (
        <div className="rounded-2xl bg-card border border-border p-8">
          <SpinnerBlock />
        </div>
      ) : !profile ? (
        <div className="rounded-2xl bg-card border border-border p-8 text-center text-sm text-muted-foreground">
          {t("Profil ma'lumotlari topilmadi")}
        </div>
      ) : (
        <div className="rounded-2xl bg-card border border-border p-5 space-y-5">
          <div className="flex items-center gap-4">
            <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-primary text-white text-[26px] font-semibold">
              {initial}
            </span>
            <div>
              <div className="text-[15px] font-semibold">{profile.fullName || "—"}</div>
              <div className="text-[13px] text-muted-foreground">{roleLabel}</div>
            </div>
          </div>

          <div className="space-y-4">
            {/* Yorliq uslubi loyihadagi konvensiya bo'yicha — SettingsForm.tsx
                va SecurityPage.tsx dagi kabi <label>, katta harfli guruh
                sarlavhasi emas. */}
            <div>
              <label htmlFor="prof-name" className="block text-[13px] font-medium mb-1.5">
                {t("To'liq ism")}
              </label>
              <input
                id="prof-name"
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder={t("Ism familiya")}
                className="h-10 w-full rounded-lg border border-border bg-card px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
              />
            </div>

            <div>
              <label htmlFor="prof-phone" className="block text-[13px] font-medium mb-1.5">
                {t("Telefon raqam")}
              </label>
              <input
                id="prof-phone"
                type="text"
                value={profile.phone}
                disabled
                className="h-10 w-full rounded-lg border border-border bg-card px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 disabled:opacity-60"
              />
              <p className="mt-1.5 text-[12px] text-muted-foreground">
                {t("Telefon raqam login uchun ishlatiladi, o'zgartirib bo'lmaydi")}
              </p>
            </div>

            <div>
              <label htmlFor="prof-role" className="block text-[13px] font-medium mb-1.5">
                {t("Rol")}
              </label>
              <input
                id="prof-role"
                type="text"
                value={roleLabel}
                disabled
                className="h-10 w-full rounded-lg border border-border bg-card px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 disabled:opacity-60"
              />
            </div>
          </div>

          <div className="flex justify-end">
            <button
              onClick={() => void save()}
              disabled={saving}
              className="h-10 px-6 rounded-lg bg-primary text-white text-sm font-medium hover:opacity-90 disabled:opacity-60"
            >
              {saving ? t("Saqlanmoqda…") : t("Saqlash")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
